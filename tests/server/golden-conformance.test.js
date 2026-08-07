import { describe, it, expect } from '@jest/globals';
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geminiToJsonSchema, formatErrors } from '../__helpers__/gemini-schema.js';
import { SCHEMA_REGISTRY } from '../__helpers__/schema-registry.js';

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'golden');
const manifest = JSON.parse(readFileSync(join(GOLDEN_DIR, 'manifest.json'), 'utf8'));
const golden = file => JSON.parse(readFileSync(join(GOLDEN_DIR, file), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Known non-conformance: real Gemini output that violates the schema the app declared.
 *
 * The app's core assumption is that `responseSchema` guarantees shape, so nothing validates
 * the parsed result. That assumption is false — these are captures of actual production
 * responses, including one captured 2026-08-07, that omit fields the schema marks required.
 *
 * This list may only SHRINK. The unused-entry test below fails if an entry stops matching,
 * which forces you to delete it when the underlying defect is fixed rather than leaving
 * stale debt behind. Adding an entry should require a deliberate decision.
 */
const KNOWN_NONCONFORMING = {
  // Every downstream prompt embeds formatNarrativeSpine's output under the header
  // "NARRATIVE SPINE (AUTHORITATIVE — align all content to this)". With these five fields
  // absent the formatter interpolates the literal string "undefined" six times.
  // Scheduled: guard the formatter now (Phase 2), fix the prompt in Phase 4.
  'narrative-spine': [
    '/ missing:analyticalFramework',
    '/ missing:recommendedAction',
    '/ missing:tensionPair',
    '/keyClaims/* missing:evidence',
    '/keyClaims/* missing:stake',
  ],
  // speakerNotesSchema is 344 lines and the model fills a fraction of it. Every consumer of
  // these fields renders nothing or "undefined". Revisit when slides/speaker-notes prompts
  // are rewritten in Phase 5.
  'speaker-notes': [
    '/slides/* missing:anticipatedQuestions',
    '/slides/* missing:generationTransparency',
    '/slides/* missing:sourceAttribution',
    '/slides/* missing:storyContext',
    '/slides/*/narrative missing:keyPhrase',
  ],
};

describe('schema registry', () => {
  it('has an entry for every generator in the golden manifest', () => {
    const missing = [...new Set(manifest.map(m => m.generator))].filter(g => !SCHEMA_REGISTRY[g]);
    expect(missing).toEqual([]);
  });

  it('compiles every registered schema', () => {
    const failures = [];
    for (const [name, schema] of Object.entries(SCHEMA_REGISTRY)) {
      try {
        ajv.compile(geminiToJsonSchema(schema));
      } catch (err) {
        failures.push(`${name}: ${err.message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('golden corpus conformance', () => {
  it.each(manifest.map(m => [m.file, m.generator]))(
    '%s conforms to its schema (modulo known gaps)',
    (file, generator) => {
      const validate = ajv.compile(geminiToJsonSchema(SCHEMA_REGISTRY[generator]));
      const ok = validate(golden(file).data);
      const errors = ok ? [] : formatErrors(validate.errors);
      const allowed = KNOWN_NONCONFORMING[generator] ?? [];
      const unexpected = errors.filter(e => !allowed.includes(e));
      expect(unexpected).toEqual([]);
    }
  );

  // Without this, a fixed defect leaves a stale allowlist entry that would silently permit
  // the defect to return.
  it('has no unused allowlist entries', () => {
    const seen = new Set();
    for (const m of manifest) {
      const validate = ajv.compile(geminiToJsonSchema(SCHEMA_REGISTRY[m.generator]));
      if (!validate(golden(m.file).data)) {
        formatErrors(validate.errors).forEach(e => seen.add(`${m.generator}::${e}`));
      }
    }
    const unused = Object.entries(KNOWN_NONCONFORMING).flatMap(([gen, errs]) =>
      errs.filter(e => !seen.has(`${gen}::${e}`)).map(e => `${gen}::${e}`)
    );
    expect(unused).toEqual([]);
  });
});

describe('nullable handling', () => {
  // Regression guard for the false positive that motivated the converter: ajv ignores the
  // OpenAPI `nullable` keyword, so without conversion a legitimately-null field reads as a
  // type error. competitive-analysis.marketOverview.marketSize is exactly that case.
  it('accepts null for a nullable field', () => {
    const schema = {
      type: 'object',
      properties: { marketSize: { type: 'string', nullable: true } },
      required: ['marketSize'],
    };
    const validate = ajv.compile(geminiToJsonSchema(schema));
    expect(validate({ marketSize: null })).toBe(true);
    expect(validate({ marketSize: 'large' })).toBe(true);
  });

  it('still rejects null for a non-nullable field', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
    const validate = ajv.compile(geminiToJsonSchema(schema));
    expect(validate({ name: null })).toBe(false);
  });
});
