import { describe, it, expect } from '@jest/globals';
import {
  getCurrentDateContext,
  assembleResearchContent,
  extractKeyStats,
  getAcronymRules,
  getSourceExtractionRules,
  formatDateContext,
  validatePromptInputs,
  NARRATIVE_POSITIONS
} from '../../server/prompts/common.js';

describe('Prompt Common Utilities', () => {
  describe('getCurrentDateContext', () => {
    it('returns an object with required temporal fields', () => {
      const ctx = getCurrentDateContext();
      expect(ctx).toHaveProperty('fullDate');
      expect(ctx).toHaveProperty('month');
      expect(ctx).toHaveProperty('year');
      expect(ctx).toHaveProperty('currentQuarter');
      expect(ctx).toHaveProperty('nextQuarter');
      expect(ctx).toHaveProperty('quarterPlusTwo');
      expect(ctx).toHaveProperty('endOfYear');
      expect(ctx).toHaveProperty('nextYear');
    });

    it('returns current year as a number', () => {
      const ctx = getCurrentDateContext();
      expect(typeof ctx.year).toBe('number');
      expect(ctx.year).toBe(new Date().getFullYear());
    });

    it('returns quarter string starting with Q', () => {
      const ctx = getCurrentDateContext();
      expect(ctx.currentQuarter).toMatch(/^Q[1-4] \d{4}$/);
      expect(ctx.nextQuarter).toMatch(/^Q[1-4] \d{4}$/);
    });

    it('returns fullDate in YYYY-MM-DD format', () => {
      const ctx = getCurrentDateContext();
      expect(ctx.fullDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('assembleResearchContent', () => {
    it('joins files with === delimiters and filenames', () => {
      const files = [
        { filename: 'report.md', content: 'Report body here' },
        { filename: 'data.txt', content: 'Data content' }
      ];
      const result = assembleResearchContent(files);
      expect(result).toContain('=== report.md ===');
      expect(result).toContain('Report body here');
      expect(result).toContain('=== data.txt ===');
      expect(result).toContain('Data content');
    });

    it('handles empty array', () => {
      const result = assembleResearchContent([]);
      expect(result).toBe('');
    });

    it('handles single file', () => {
      const result = assembleResearchContent([{ filename: 'a.md', content: 'only one' }]);
      expect(result).toBe('=== a.md ===\nonly one');
    });
  });

  describe('extractKeyStats', () => {
    it('finds percentage patterns', () => {
      const result = extractKeyStats('Revenue grew 15% year over year which is significant.');
      expect(result.stats).toContain('15%');
    });

    it('finds currency patterns', () => {
      const result = extractKeyStats('Total revenue reached $2.5M in the last quarter period.');
      expect(result.stats).toContain('$2.5M');
    });

    it('finds multiplier patterns', () => {
      const result = extractKeyStats('The platform achieved 3x growth compared to last year.');
      expect(result.stats).toMatch(/3x/i);
    });

    it('extracts authoritative sources', () => {
      const result = extractKeyStats('According to Gartner, the market will grow. According to McKinsey, costs will drop.');
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.sources.some(s => /Gartner/i.test(s))).toBe(true);
    });

    it('returns empty arrays for content with no stats', () => {
      const result = extractKeyStats('This is a plain sentence with no numbers or sources.');
      expect(result.stats).toBe('');
      expect(result.sources).toEqual([]);
      expect(result.contextualStats).toEqual([]);
    });

    it('returns empty results for null/undefined input', () => {
      const result = extractKeyStats(null);
      expect(result.stats).toBe('');
      expect(result.sources).toEqual([]);
      expect(result.contextualStats).toEqual([]);
    });

    it('extracts contextual stat sentences', () => {
      const result = extractKeyStats('Market share increased to 45% in the reporting period. No stats here short. Revenue hit $10M during fiscal year two thousand twenty four.');
      expect(result.contextualStats.length).toBeGreaterThan(0);
      expect(result.contextualStats[0]).toContain('45%');
    });
  });

  describe('getAcronymRules', () => {
    it('returns string containing acronym lists', () => {
      const rules = getAcronymRules();
      expect(typeof rules).toBe('string');
      expect(rules).toContain('API');
      expect(rules).toContain('FpML');
      expect(rules).toContain('SaaS');
    });

    it('full version includes tagline exception', () => {
      const rules = getAcronymRules(false);
      expect(rules).toContain('TAGLINE EXCEPTION');
      expect(rules).toContain('FALLBACK RULE');
    });

    it('short version omits tagline exception', () => {
      const rules = getAcronymRules(true);
      expect(rules).not.toContain('TAGLINE EXCEPTION');
      expect(rules).toContain('ALL CAPS acronyms');
    });
  });

  describe('getSourceExtractionRules', () => {
    it('full variant returns categories and citation patterns', () => {
      const rules = getSourceExtractionRules('full');
      expect(rules).toContain('AUTHORITATIVE SOURCE CATEGORIES');
      expect(rules).toContain('CITATION PATTERNS');
      expect(rules).toContain('ANTI-PATTERNS');
    });

    it('compact variant returns categories with extraction guidance', () => {
      const rules = getSourceExtractionRules('compact');
      expect(rules).toContain('SOURCE EXTRACTION');
      expect(rules).toContain('NEVER use the uploaded filename');
      expect(rules).not.toContain('ANTI-PATTERNS');
    });

    it('minimal variant returns short enforcement rules', () => {
      const rules = getSourceExtractionRules('minimal');
      expect(rules).toContain('SOURCE CITATION RULES');
      expect(rules).not.toContain('AUTHORITATIVE SOURCE CATEGORIES');
    });
  });

  describe('formatDateContext', () => {
    const dateCtx = getCurrentDateContext();

    it('slides variant returns temporal context block', () => {
      const result = formatDateContext(dateCtx, 'slides');
      expect(result).toContain('TEMPORAL CONTEXT');
      expect(result).toContain(dateCtx.currentQuarter);
      expect(result).toContain('Planning horizon');
    });

    it('document variant returns date context with deadline guidance', () => {
      const result = formatDateContext(dateCtx, 'document');
      expect(result).toContain('CURRENT DATE CONTEXT');
      expect(result).toContain(String(dateCtx.nextYear));
      expect(result).toContain('NEVER use past dates');
    });

    it('slides and document variants produce different output', () => {
      const slides = formatDateContext(dateCtx, 'slides');
      const doc = formatDateContext(dateCtx, 'document');
      expect(slides).not.toBe(doc);
    });
  });

  describe('validatePromptInputs', () => {
    it('throws if userPrompt is empty', () => {
      expect(() => validatePromptInputs('', [{ filename: 'a.md', content: 'x' }])).toThrow('userPrompt is required');
    });

    it('throws if researchFiles is empty', () => {
      expect(() => validatePromptInputs('topic', [])).toThrow('At least one research file');
    });

    it('returns filtered valid files', () => {
      const files = [
        { filename: 'good.md', content: 'has content' },
        { filename: 'empty.md', content: '   ' },
        null
      ];
      const result = validatePromptInputs('topic', files);
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('good.md');
    });
  });
});
