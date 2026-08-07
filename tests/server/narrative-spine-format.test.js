import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatNarrativeSpine } from '../../server/prompts/narrative-spine.js';

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'golden');
const spineCaptures = readdirSync(GOLDEN_DIR).filter(f => /^narrative-spine-\d+\.json$/.test(f));
const load = f => JSON.parse(readFileSync(join(GOLDEN_DIR, f), 'utf8')).data;

describe('formatNarrativeSpine', () => {
  it('has real captures to test against', () => {
    expect(spineCaptures.length).toBeGreaterThan(0);
  });

  // The bug this pins: the template interpolated five fields the model never returns, so
  // every downstream prompt carried `[Evidence: undefined] [Stake: undefined]` and
  // `Central tension: "undefined" vs "undefined"` under a header declaring the block
  // AUTHORITATIVE. Six occurrences per run, on real data, for months.
  it.each(spineCaptures)('emits no literal "undefined" for %s', file => {
    const out = formatNarrativeSpine(load(file));
    expect(out).not.toMatch(/undefined/);
  });

  it.each(spineCaptures)('still carries the substance it does have for %s', file => {
    const spine = load(file);
    const out = formatNarrativeSpine(spine);
    expect(out).toContain(spine.coreThesis);
    for (const claim of spine.keyClaims ?? []) {
      if (claim?.claim) expect(out).toContain(claim.claim);
    }
  });

  describe('field-by-field omission', () => {
    const full = {
      coreThesis: 'Thesis',
      keyClaims: [{ claim: 'Claim one', evidence: 'Evidence one', stake: 'Stake one' }],
      tensionPair: { force1: 'Speed', force2: 'Safety' },
      analyticalFramework: 'Framework',
      recommendedAction: 'Act now',
    };

    it('renders every field when all are present', () => {
      const out = formatNarrativeSpine(full);
      expect(out).toContain('Core thesis: "Thesis"');
      expect(out).toContain('[Evidence: Evidence one]');
      expect(out).toContain('[Stake: Stake one]');
      expect(out).toContain('Central tension: "Speed" vs "Safety"');
      expect(out).toContain('Analytical framework: Framework');
      expect(out).toContain('Recommended action: "Act now"');
    });

    it('drops the evidence and stake brackets rather than emitting undefined', () => {
      const out = formatNarrativeSpine({ ...full, keyClaims: [{ claim: 'Bare claim' }] });
      expect(out).toContain('1. Bare claim');
      expect(out).not.toMatch(/Evidence|Stake|undefined/);
    });

    it('drops the tension line when only one force is present', () => {
      const out = formatNarrativeSpine({ ...full, tensionPair: { force1: 'Speed' } });
      expect(out).not.toMatch(/Central tension|undefined/);
    });

    it.each(['analyticalFramework', 'recommendedAction', 'coreThesis'])(
      'drops the %s line when absent',
      field => {
        const partial = { ...full };
        delete partial[field];
        expect(formatNarrativeSpine(partial)).not.toMatch(/undefined/);
      }
    );

    it('returns empty string when nothing but the header would remain', () => {
      expect(formatNarrativeSpine({})).toBe('');
      expect(formatNarrativeSpine({ keyClaims: [] })).toBe('');
    });

    it('returns empty string for a null spine', () => {
      expect(formatNarrativeSpine(null)).toBe('');
    });
  });
});
