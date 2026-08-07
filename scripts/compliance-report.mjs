#!/usr/bin/env node
/**
 * Phase 2 gate artifact: measure how well the CURRENT prompts actually perform.
 *
 * Runs every working validator and quality heuristic over the whole golden corpus with
 * zero API calls. Until now nobody could answer "are the prompts any good" — the slides
 * validator was inert, nothing checked schema conformance, and the quality regexes were
 * reachable only through a validator that never fired.
 *
 * This is the baseline every later prompt claim is measured against. Re-run it after a
 * prompt rewrite and compare; a rewrite that does not move these numbers did not do
 * anything, whatever it looks like in a diff.
 *
 * Usage: node scripts/compliance-report.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

import { validateSlideOutput, countSlides, validateExecutiveSummary, checkWeakOpener } from '../server/generators.js';
import { formatNarrativeSpine } from '../server/prompts/narrative-spine.js';
import { geminiToJsonSchema, formatErrors } from '../server/schema-guard.js';
import { SCHEMA_REGISTRY } from '../tests/__helpers__/schema-registry.js';
import { SLIDE_LIMITS } from '../Public/shared/slide-limits.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = join(ROOT, 'tests', 'golden');
const manifest = JSON.parse(readFileSync(join(GOLDEN, 'manifest.json'), 'utf8'));
const load = file => JSON.parse(readFileSync(join(GOLDEN, file), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const asJson = process.argv.includes('--json');
const report = { generatedFrom: manifest.length, sections: {} };

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(0)}%` : 'n/a');
const out = [];
const say = line => out.push(line);

// ---------------------------------------------------------------- schema conformance
{
  const rows = [];
  for (const m of manifest) {
    const schema = SCHEMA_REGISTRY[m.generator];
    if (!schema) continue;
    const validate = ajv.compile(geminiToJsonSchema(schema));
    const ok = validate(load(m.file).data);
    rows.push({ file: m.file, generator: m.generator, ok, errors: ok ? [] : formatErrors(validate.errors) });
  }
  const failing = rows.filter(r => !r.ok);
  report.sections.schemaConformance = { total: rows.length, conforming: rows.length - failing.length, failing };

  say('## Schema conformance');
  say('');
  say(`${rows.length - failing.length} of ${rows.length} captures satisfy the schema the app declared.`);
  say('');
  if (failing.length) {
    for (const f of failing) {
      say(`- **${f.file}** (${f.generator})`);
      f.errors.forEach(e => say(`  - ${e}`));
    }
    say('');
    say('Gemini does not enforce `required`. Any consumer reading these fields gets undefined.');
  }
  say('');
}

// ---------------------------------------------------------------- slide quality
{
  const rows = [];
  for (const m of manifest.filter(m => m.generator === 'slides')) {
    const data = load(m.file).data;
    const { issues } = validateSlideOutput(data);
    const byField = {};
    issues.forEach(i => { byField[i.field] = (byField[i.field] ?? 0) + 1; });

    const slides = (data.sections ?? []).flatMap(s => s.slides ?? []);
    const lengths = slides.flatMap(s =>
      ['paragraph1', 'paragraph2', 'paragraph3'].map(f => s[f]?.length).filter(Boolean)
    ).sort((a, b) => a - b);
    const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0;
    const overMax = lengths.filter(l => l > SLIDE_LIMITS.PARAGRAPH_MAX).length;
    const outsideTarget = lengths.filter(
      l => l < SLIDE_LIMITS.PARAGRAPH_TARGET_MIN || l > SLIDE_LIMITS.PARAGRAPH_TARGET_MAX
    ).length;

    rows.push({
      file: m.file, slideCount: countSlides(data), issues: issues.length, byField,
      paragraphs: lengths.length, median, overMax, outsideTarget,
    });
  }
  report.sections.slideQuality = rows;

  say('## Slide rule compliance');
  say('');
  for (const r of rows) {
    say(`**${r.file}** — ${r.slideCount} slides, ${r.issues} issues`);
    say(`- by field: ${Object.entries(r.byField).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
    say(`- paragraphs outside the ${SLIDE_LIMITS.PARAGRAPH_TARGET_MIN}-${SLIDE_LIMITS.PARAGRAPH_TARGET_MAX} target: ${r.outsideTarget}/${r.paragraphs} (${pct(r.outsideTarget, r.paragraphs)})`);
    say(`- paragraphs over the ${SLIDE_LIMITS.PARAGRAPH_MAX} ceiling: ${r.overMax}/${r.paragraphs} (${pct(r.overMax, r.paragraphs)})`);
    say(`- median paragraph length: ${r.median} chars`);
    say('');
  }
}

// ---------------------------------------------------------------- narrative spine
{
  const rows = [];
  for (const m of manifest.filter(m => m.generator === 'narrative-spine')) {
    const spine = load(m.file).data;
    const rendered = formatNarrativeSpine(spine);
    rows.push({
      file: m.file,
      undefinedCount: (rendered.match(/undefined/g) ?? []).length,
      renderedChars: rendered.length,
      present: ['coreThesis', 'keyClaims', 'tensionPair', 'analyticalFramework', 'recommendedAction']
        .filter(f => spine[f] !== undefined),
      claimsWithEvidence: (spine.keyClaims ?? []).filter(c => c?.evidence).length,
      claims: (spine.keyClaims ?? []).length,
    });
  }
  report.sections.narrativeSpine = rows;

  say('## Narrative spine (injected into every downstream prompt)');
  say('');
  for (const r of rows) {
    say(`**${r.file}** — renders ${r.renderedChars} chars, ${r.undefinedCount} literal "undefined"`);
    say(`- schema fields present: ${r.present.join(', ') || 'none'}`);
    say(`- claims carrying evidence: ${r.claimsWithEvidence}/${r.claims}`);
    say('');
  }
}

// ---------------------------------------------------------------- document editorial
{
  const rows = [];
  for (const m of manifest.filter(m => m.generator === 'document')) {
    const doc = load(m.file).data;
    const summary = doc.executiveSummary;
    const result = summary ? validateExecutiveSummary(summary) : null;
    const openers = (doc.sections ?? [])
      .map(s => s.paragraphs?.[0] ?? s.researchSummary)
      .filter(Boolean)
      .map(checkWeakOpener);
    rows.push({
      file: m.file,
      sections: (doc.sections ?? []).length,
      execSummaryIssues: result ? (result.issues?.length ?? 0) : 'no executiveSummary',
      weakOpeners: openers.filter(o => o.isWeak).length,
      strongOpeners: openers.filter(o => o.isStrong).length,
      openersChecked: openers.length,
    });
  }
  report.sections.document = rows;

  say('## Document editorial quality');
  say('');
  for (const r of rows) {
    say(`**${r.file}** — ${r.sections} sections`);
    say(`- executive summary issues: ${r.execSummaryIssues}`);
    say(`- section openers: ${r.weakOpeners} weak, ${r.strongOpeners} strong, of ${r.openersChecked}`);
    say('');
  }
}

// ---------------------------------------------------------------- domain leakage
{
  // The prompt layer is saturated with one fictional case (JPMorgan / ISDA CDM / DRR /
  // $2.3M / Q2 2025), 45 occurrences. If that prior leaks into output on unrelated topics,
  // the prompts are teaching content rather than form.
  const MARKERS = /\b(JPMorgan|ISDA|CDM|DRR)\b/g;
  const rows = [];
  for (const m of manifest) {
    const text = JSON.stringify(load(m.file).data);
    const hits = text.match(MARKERS) ?? [];
    if (hits.length) {
      const counts = {};
      hits.forEach(h => { counts[h] = (counts[h] ?? 0) + 1; });
      rows.push({ file: m.file, generator: m.generator, counts, total: hits.length });
    }
  }
  report.sections.domainLeakage = rows;

  say('## Domain-prior leakage');
  say('');
  say('The prompt layer bakes in one fictional case (JPMorgan / ISDA CDM / DRR). Captures');
  say('mentioning those terms whose source research was on another topic indicate the prior');
  say('is teaching content, not just form.');
  say('');
  if (rows.length === 0) {
    say('No occurrences in any capture.');
  } else {
    rows.sort((a, b) => b.total - a.total);
    for (const r of rows) {
      say(`- **${r.file}** (${r.generator}): ${Object.entries(r.counts).map(([k, v]) => `${k} x${v}`).join(', ')}`);
    }
  }
  say('');
}

// ---------------------------------------------------------------- emit
if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('# Phase 2 Compliance Report');
  console.log('');
  console.log(`Baseline measured over ${manifest.length} captured responses in tests/golden/.`);
  console.log('Produced with zero API calls. Re-run after any prompt change and compare.');
  console.log('');
  console.log(out.join('\n'));
}
