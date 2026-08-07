#!/usr/bin/env node
/**
 * Dependency audit gate.
 *
 * CI previously ran `npm audit --audit-level=moderate || true`. The `|| true` meant the step
 * could not fail, which is the same class of dead gate as the lint job that grepped for
 * console.log and exited 0. At the time this replaced it there were 16 vulnerabilities, 12 of
 * them high, and nobody had been told.
 *
 * Most were fixed by a plain `npm audit fix`. What remains cannot be fixed and cannot be
 * ignored by npm itself:
 *
 *   - `npm audit --audit-level=high` fails on advisories with no available patch, so the gate
 *     is permanently red and gets switched off again.
 *   - Lowering the threshold to `critical` keeps CI green by agreeing to ignore an entire
 *     severity class, including genuinely new and fixable high findings.
 *
 * So this fails on anything at or above the threshold except an explicit allowlist, in the
 * same spirit as the schema-conformance allowlist: each entry names the advisory, why it is
 * survivable here, and what would remove it. The list can only shrink.
 *
 * Run: node scripts/audit-gate.mjs [--threshold=high]
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];

/**
 * Advisories accepted for now. Removing an entry must be preferred to adding one.
 *
 * Every entry needs `reason` (why it cannot hurt this app) and `removeWhen` (the concrete
 * event that should delete it), so a stale exception is visible as a stale exception.
 */
const ALLOWLIST = [
  {
    id: 'GHSA-w3rx-r6r6-pgpr',
    module: 'image-size',
    reason:
      'DoS via infinite loop in the ICNS parser. Reached only through pptxgenjs, and the ' +
      'sole image this app ever hands pptxgenjs is Public/Red BIP Logo.png, a repo-controlled ' +
      'PNG (ppt-export-service-v2.js:149-152). No user-supplied image reaches image-size, and ' +
      'ICNS is never parsed. No patched version exists in any release line; npm audit fix ' +
      "--force resolves it by downgrading pptxgenjs 4.0.1 -> 1.1.5, three majors back.",
    removeWhen: 'image-size ships a patched release, or pptxgenjs drops the dependency.',
  },
  {
    id: 'GHSA-5p2g-fcmc-qvqq',
    module: 'image-size',
    reason:
      'DoS via infinite loops in the JXL and HEIF parsers. Same reachability as ' +
      'GHSA-w3rx-r6r6-pgpr: only a repo-controlled PNG is ever parsed, never JXL or HEIF.',
    removeWhen: 'image-size ships a patched release, or pptxgenjs drops the dependency.',
  },
];

const thresholdArg = process.argv.find((a) => a.startsWith('--threshold='));
const threshold = thresholdArg ? thresholdArg.split('=')[1] : 'high';
const minIndex = SEVERITY_ORDER.indexOf(threshold);
if (minIndex === -1) {
  console.error(`Unknown threshold "${threshold}". Expected one of: ${SEVERITY_ORDER.join(', ')}`);
  process.exit(2);
}

// Dev-only advisories are excluded: they describe tooling that never runs in production, and
// the build here invokes esbuild as a bundler, not as its (vulnerable) dev server.
const { stdout } = await promisify(execFile)(
  'npm',
  ['audit', '--json', '--omit=dev'],
  { maxBuffer: 32 * 1024 * 1024 }
).catch((e) => ({ stdout: e.stdout })); // npm exits non-zero when findings exist

let report;
try {
  report = JSON.parse(stdout);
} catch {
  console.error('Could not parse `npm audit --json` output. Raw output follows:\n');
  console.error(String(stdout).slice(0, 2000));
  process.exit(2);
}

const allowedIds = new Set(ALLOWLIST.map((a) => a.id));
const blocking = [];
const allowedHits = new Set();

for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  if (SEVERITY_ORDER.indexOf(vuln.severity) < minIndex) continue;

  // `via` holds advisory objects for direct findings and plain module-name strings for
  // packages that are only vulnerable through a dependency. A package whose every advisory
  // is allowlisted is itself covered; so is one that is only implicated transitively.
  const advisories = (vuln.via ?? []).filter((v) => typeof v === 'object');
  if (advisories.length === 0) continue;

  const unallowed = advisories.filter((a) => !allowedIds.has(advisoryId(a)));
  for (const a of advisories) if (allowedIds.has(advisoryId(a))) allowedHits.add(advisoryId(a));
  if (unallowed.length > 0) blocking.push({ name, severity: vuln.severity, advisories: unallowed });
}

function advisoryId(advisory) {
  const url = advisory.url ?? '';
  const match = url.match(/GHSA-[a-z0-9-]+/i);
  return match ? match[0] : String(advisory.source ?? advisory.title ?? url);
}

console.log(`Audit gate: failing on ${threshold}+ in production dependencies.`);
console.log(`Allowlisted advisories: ${ALLOWLIST.length}\n`);

for (const entry of ALLOWLIST) {
  const stillPresent = allowedHits.has(entry.id);
  console.log(`  ${stillPresent ? '•' : '✓ RESOLVED'} ${entry.id} (${entry.module})`);
  if (!stillPresent) {
    console.log(`      No longer reported — delete this allowlist entry. ${entry.removeWhen}`);
  }
}

if (blocking.length === 0) {
  console.log('\nNo blocking vulnerabilities.');
  process.exit(0);
}

console.error(`\n${blocking.length} blocking vulnerabilit${blocking.length === 1 ? 'y' : 'ies'}:\n`);
for (const b of blocking) {
  console.error(`  ${b.name} (${b.severity})`);
  for (const a of b.advisories) console.error(`      ${advisoryId(a)}  ${a.title ?? ''}\n      ${a.url ?? ''}`);
}
console.error('\nFix them, or add an allowlist entry in scripts/audit-gate.mjs with a reason.');
process.exit(1);
