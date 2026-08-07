#!/usr/bin/env node
/**
 * Build a labeled golden corpus from real Gemini responses.
 *
 * Source of truth is `.gemini-cache/`, but that directory is volatile: DiskCache
 * has a 7-day TTL and unlinks expired entries on read. This script copies each
 * entry out to tests/golden/ (permanent, committed) and labels it by generator,
 * inferred from the response shape rather than the prompt — cache entries only
 * retain the first 50 chars of their prompt.
 *
 * Usage: node scripts/build-golden-corpus.mjs [--from <dir>]
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'tests', 'golden');

const fromFlag = process.argv.indexOf('--from');
const SRC_DIR = fromFlag !== -1 ? process.argv[fromFlag + 1] : join(ROOT, '.gemini-cache');

/**
 * Classify by top-level key set, using tests/fixtures/responses/*.json as the
 * reference shapes. Deriving the signatures from the fixtures rather than
 * hand-writing them keeps this correct when a generator's schema changes —
 * the fixtures are already maintained alongside the prompts.
 */
const FIXTURE_DIR = join(ROOT, 'tests', 'fixtures', 'responses');

/**
 * A signature is the set of top-level keys plus `key.subkey` tokens for every
 * array-of-object field. Top-level keys alone are not enough to separate the
 * generators: `document` and `slides` both emit exactly `{title, sections}`,
 * and only differ one level down (`sections[].heading` vs `sections[].swimlane`).
 */
function signatureOf(obj) {
  const tokens = new Set();
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return tokens;
  for (const [key, value] of Object.entries(obj)) {
    tokens.add(key);
    if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
      for (const sub of Object.keys(value[0])) tokens.add(`${key}.${sub}`);
    }
  }
  return tokens;
}

const signatures = [];
for (const f of (await readdir(FIXTURE_DIR)).filter(f => f.endsWith('.json'))) {
  const shape = JSON.parse(await readFile(join(FIXTURE_DIR, f), 'utf8'));
  signatures.push({ name: f.replace('.json', ''), tokens: signatureOf(shape) });
}

function classify(data) {
  const tokens = signatureOf(data);
  if (tokens.size === 0) return 'unclassified';
  let best = null;
  for (const sig of signatures) {
    // Cache entries may omit optional fields, so reward matched tokens and
    // penalise tokens the fixture does not know about.
    const matched = [...tokens].filter(t => sig.tokens.has(t)).length;
    if (matched === 0) continue;
    const unknown = tokens.size - matched;
    const score = matched - unknown;
    if (!best || score > best.score) best = { name: sig.name, score };
  }
  return best && best.score > 0 ? best.name : 'unclassified';
}

const files = (await readdir(SRC_DIR)).filter(f => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`No cache entries found in ${SRC_DIR}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const counts = new Map();
const manifest = [];
const now = Date.now();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

for (const file of files) {
  const entry = JSON.parse(await readFile(join(SRC_DIR, file), 'utf8'));
  const kind = classify(entry.data);
  const n = (counts.get(kind) ?? 0) + 1;
  counts.set(kind, n);

  const name = `${kind}-${n}.json`;
  await writeFile(
    join(OUT_DIR, name),
    JSON.stringify({ generator: kind, capturedAt: entry.timestamp, promptPrefix: entry.prompt, data: entry.data }, null, 2)
  );

  manifest.push({
    file: name,
    generator: kind,
    sourceHash: file.replace('.json', ''),
    capturedAt: new Date(entry.timestamp).toISOString(),
    expiredInCache: now - entry.timestamp > TTL_MS,
    bytes: JSON.stringify(entry.data).length,
  });
}

manifest.sort((a, b) => a.generator.localeCompare(b.generator) || a.file.localeCompare(b.file));
await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

const rescued = manifest.filter(m => m.expiredInCache).length;
console.log(`Wrote ${manifest.length} golden files to tests/golden/`);
console.log(`  ${rescued} were already past the 7-day cache TTL (rescued from deletion)`);
console.log('\nBy generator:');
for (const [kind, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(2)}  ${kind}`);
}
