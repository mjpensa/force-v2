import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSlideOutput, countSlides, correctionPreservesContent } from '../../server/generators.js';
import { SLIDE_LIMITS } from '../../server/constants/slide-limits.js';

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'golden');
const golden = name => JSON.parse(readFileSync(join(GOLDEN_DIR, `${name}.json`), 'utf8')).data;

const slide = over => ({
  tagline: 'Short',
  title: 'One\nTwo\nThree',
  paragraph1: 'x'.repeat(400),
  paragraph2: 'x'.repeat(400),
  ...over,
});
const deck = slides => ({ title: 'Deck', sections: [{ swimlane: 'A', sectionTitle: 'S', slides }] });

describe('validateSlideOutput', () => {
  // The regression that mattered: it read data.slides, which slidesSchema never emits, so
  // against a real 50-slide deck it returned one issue — "No slides array found" — and the
  // correction pass (gated at >= 3) could never fire.
  describe('against real captured decks', () => {
    it.each(['slides-1', 'slides-2'])('walks sections[].slides for %s', name => {
      const data = golden(name);
      expect(countSlides(data)).toBeGreaterThan(20);

      const { issues } = validateSlideOutput(data);
      expect(issues.length).toBeGreaterThan(2);
      expect(issues.map(i => i.message)).not.toContain('No slides array found');
      expect(issues.every(i => typeof i.slideIndex === 'number' && i.slideIndex > 0)).toBe(true);
    });

    it('numbers slides continuously across sections', () => {
      const data = golden('slides-1');
      const { issues } = validateSlideOutput(data);
      const maxIndex = Math.max(...issues.map(i => i.slideIndex));
      expect(maxIndex).toBeLessThanOrEqual(countSlides(data));
      // More than one section contributes issues, so numbering cannot be per-section.
      expect(new Set(issues.map(i => i.slideIndex)).size).toBeGreaterThan(1);
    });
  });

  it('reports no issues for a compliant deck', () => {
    expect(validateSlideOutput(deck([slide()])).valid).toBe(true);
  });

  it('flags an over-long tagline', () => {
    const { issues } = validateSlideOutput(deck([slide({ tagline: 'x'.repeat(SLIDE_LIMITS.TAGLINE_MAX + 1) })]));
    expect(issues.map(i => i.field)).toContain('tagline');
  });

  // Previously split on the two-character sequence backslash-n, so it never matched a real
  // newline in parsed JSON and the rule was inert.
  it('counts title lines on real newlines', () => {
    const { issues } = validateSlideOutput(deck([slide({ title: 'a\nb\nc\nd\ne' })]));
    const titleIssue = issues.find(i => i.field === 'title');
    expect(titleIssue).toBeDefined();
    expect(titleIssue.message).toContain('5 lines');
  });

  it('does not flag a literal backslash-n as a line break', () => {
    const { issues } = validateSlideOutput(deck([slide({ title: 'a\\nb\\nc\\nd\\ne' })]));
    expect(issues.find(i => i.field === 'title')).toBeUndefined();
  });

  it('flags paragraphs outside the accepted band, including paragraph3', () => {
    const { issues } = validateSlideOutput(
      deck([slide({ paragraph1: 'x'.repeat(100), paragraph3: 'x'.repeat(600) })])
    );
    const fields = issues.map(i => i.field);
    expect(fields).toContain('paragraph1');
    expect(fields).toContain('paragraph3');
  });

  it('returns a structured issue, not a bare string, when sections are missing', () => {
    const { valid, issues } = validateSlideOutput({ title: 'Deck' });
    expect(valid).toBe(false);
    expect(issues[0]).toMatchObject({ field: 'sections' });
  });
});

describe('correctionPreservesContent', () => {
  const before = deck([slide({ tagline: 'One' }), slide({ tagline: 'Two' })]);

  it('accepts a correction that only rewords', () => {
    const after = deck([slide({ tagline: 'Uno' }), slide({ tagline: 'Dos' })]);
    expect(correctionPreservesContent(before, after)).toBe(true);
  });

  // The accept condition used to be "fewer issues than before", which a response that
  // dropped half the deck satisfies trivially — fewer slides, fewer violations.
  it('rejects a correction that drops slides', () => {
    expect(correctionPreservesContent(before, deck([slide({ tagline: 'One' })]))).toBe(false);
  });

  it('rejects a correction that drops a section', () => {
    expect(correctionPreservesContent(before, { title: 'Deck', sections: [] })).toBe(false);
  });

  it('rejects a correction that empties a populated field', () => {
    const after = deck([slide({ tagline: 'One', paragraph2: '' }), slide({ tagline: 'Two' })]);
    expect(correctionPreservesContent(before, after)).toBe(false);
  });

  it('rejects malformed correction output', () => {
    expect(correctionPreservesContent(before, null)).toBe(false);
    expect(correctionPreservesContent(before, { sections: 'nope' })).toBe(false);
  });
});
