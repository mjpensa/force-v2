import { describe, it, expect } from '@jest/globals';
import {
  checkAcronym, toSentenceCase, normalizeBodyText,
  sanitizeText, truncateToSentence, formatTitle,
  formatSectionTitle, formatBody, enforceTitleLineCount
} from '../../Public/shared/text-utils.js';

describe('Text Utilities', () => {
  describe('checkAcronym', () => {
    it('returns uppercase form for known upper acronyms', () => {
      expect(checkAcronym('cdm')).toBe('CDM');
      expect(checkAcronym('api')).toBe('API');
      expect(checkAcronym('roi')).toBe('ROI');
    });

    it('returns mixed case for known mixed acronyms', () => {
      expect(checkAcronym('saas')).toBe('SaaS');
      expect(checkAcronym('fpml')).toBe('FpML');
      expect(checkAcronym('devops')).toBe('DevOps');
    });

    it('returns null for non-acronym words', () => {
      expect(checkAcronym('hello')).toBeNull();
      expect(checkAcronym('market')).toBeNull();
    });

    it('handles trailing punctuation', () => {
      expect(checkAcronym('api,')).toBe('API,');
      expect(checkAcronym('saas.')).toBe('SaaS.');
      expect(checkAcronym('roi;')).toBe('ROI;');
    });

    it('handles slash compounds', () => {
      expect(checkAcronym('api/sdk')).toBe('API/SDK');
      expect(checkAcronym('UI/UX')).toBe('UI/UX');
    });

    it('returns null for empty or falsy input', () => {
      expect(checkAcronym('')).toBeNull();
      expect(checkAcronym(null)).toBeNull();
      expect(checkAcronym(undefined)).toBeNull();
    });
  });

  describe('toSentenceCase', () => {
    it('capitalizes first word and lowercases the rest', () => {
      expect(toSentenceCase('the future is bright')).toBe('The future is bright');
    });

    it('preserves known acronyms within sentence', () => {
      expect(toSentenceCase('BUILDING API SOLUTIONS')).toBe('Building API solutions');
    });

    it('preserves short all-caps words via dynamic fallback', () => {
      // 2-5 char all-caps words hit checkAcronym's dynamic fallback
      expect(toSentenceCase('THE FUTURE OF AI AND ML')).toBe('THE future OF AI AND ML');
    });

    it('returns empty string for falsy input', () => {
      expect(toSentenceCase('')).toBe('');
      expect(toSentenceCase(null)).toBe('');
    });
  });

  describe('normalizeBodyText', () => {
    it('corrects 3+ char all-caps words that are not acronyms', () => {
      // normalizeBodyText targets \b([A-Z]{3,})\b — "IS" (2 chars) is untouched
      const result = normalizeBodyText('THE MARKET IS GROWING');
      expect(result).toBe('THE Market IS Growing');
    });

    it('preserves known acronyms in text', () => {
      const result = normalizeBodyText('Our API and SDK are ready');
      expect(result).toBe('Our API and SDK are ready');
    });
  });

  describe('sanitizeText', () => {
    it('strips bold markdown', () => {
      expect(sanitizeText('some **bold** text')).toBe('some bold text');
    });

    it('strips italic markdown', () => {
      expect(sanitizeText('some *italic* text')).toBe('some italic text');
    });

    it('strips underscore markdown', () => {
      expect(sanitizeText('some_text_here')).toBe('some text here');
    });

    it('preserves normal text without markdown', () => {
      expect(sanitizeText('plain text here')).toBe('plain text here');
    });
  });

  describe('truncateToSentence', () => {
    it('truncates at sentence boundary within maxLength', () => {
      const text = 'First sentence. Second sentence. Third sentence is longer.';
      const result = truncateToSentence(text, 35);
      expect(result).toBe('First sentence. Second sentence.');
    });

    it('returns full text if under maxLength', () => {
      const text = 'Short text.';
      expect(truncateToSentence(text, 400)).toBe('Short text.');
    });

    it('handles text with no sentence endings', () => {
      const text = 'A '.repeat(250).trim();
      const result = truncateToSentence(text, 50);
      expect(result.length).toBeLessThanOrEqual(55);
      expect(result.endsWith('.')).toBe(true);
    });
  });

  describe('formatTitle', () => {
    it('applies sentence case to title text', () => {
      expect(formatTitle('Growing the API market')).toBe('Growing the API market');
    });

    it('enforces line count limits', () => {
      const title = 'Line one\nLine two\nLine three\nLine four\nLine five\nLine six';
      const result = formatTitle(title, 4);
      const lineCount = result.split('\n').length;
      expect(lineCount).toBeLessThanOrEqual(4);
    });
  });

  describe('formatSectionTitle', () => {
    it('corrects acronyms without changing other casing', () => {
      expect(formatSectionTitle('Building saas Solutions')).toBe('Building SaaS Solutions');
    });
  });

  describe('formatBody', () => {
    it('combines and normalizes two paragraphs', () => {
      const result = formatBody('First paragraph.', 'Second paragraph.');
      expect(result).toContain('First paragraph.');
      expect(result).toContain('Second paragraph.');
      expect(result.split('\n').length).toBe(2);
    });

    it('handles a single paragraph when second is empty', () => {
      const result = formatBody('Only paragraph.', '');
      expect(result).toBe('Only paragraph.');
    });
  });

  describe('enforceTitleLineCount', () => {
    it('merges lines when exceeding maxLines', () => {
      const title = 'A\nB\nC\nD\nE';
      const result = enforceTitleLineCount(title, 3);
      expect(result.split('\n').length).toBe(3);
    });

    it('returns empty string for falsy input', () => {
      expect(enforceTitleLineCount('')).toBe('');
      expect(enforceTitleLineCount(null)).toBe('');
    });
  });
});
