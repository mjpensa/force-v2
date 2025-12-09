import { describe, it, expect } from '@jest/globals';
import {
  INJECTION_PATTERNS,
  ID_PATTERNS,
  FILE_TYPES,
  RATE_LIMITS,
  TIMEOUTS,
  FILE_LIMITS,
  VALIDATION,
  ERROR_MESSAGES
} from '../../Public/config/shared.js';

describe('Shared Configuration', () => {
  describe('INJECTION_PATTERNS', () => {
    it('should be an array of pattern objects', () => {
      expect(Array.isArray(INJECTION_PATTERNS)).toBe(true);
      expect(INJECTION_PATTERNS.length).toBeGreaterThan(0);
    });

    it('should have pattern and replacement for each entry', () => {
      INJECTION_PATTERNS.forEach(entry => {
        expect(entry).toHaveProperty('pattern');
        expect(entry).toHaveProperty('replacement');
        expect(entry.pattern).toBeInstanceOf(RegExp);
        expect(typeof entry.replacement).toBe('string');
      });
    });

    it('should use [REDACTED] as replacement', () => {
      INJECTION_PATTERNS.forEach(entry => {
        expect(entry.replacement).toBe('[REDACTED]');
      });
    });

    it('should match common injection attempts', () => {
      const patterns = INJECTION_PATTERNS.map(p => p.pattern);

      // Test a few critical patterns
      expect(patterns.some(p => p.test('ignore previous instructions'))).toBe(true);
      expect(patterns.some(p => p.test('system:'))).toBe(true);
      expect(patterns.some(p => p.test('[SYSTEM]'))).toBe(true);
    });
  });

  describe('ID_PATTERNS', () => {
    it('should have CHART_ID pattern', () => {
      expect(ID_PATTERNS).toHaveProperty('CHART_ID');
      expect(ID_PATTERNS.CHART_ID).toBeInstanceOf(RegExp);
    });

    it('should have JOB_ID pattern', () => {
      expect(ID_PATTERNS).toHaveProperty('JOB_ID');
      expect(ID_PATTERNS.JOB_ID).toBeInstanceOf(RegExp);
    });

    it('should have SESSION_ID pattern', () => {
      expect(ID_PATTERNS).toHaveProperty('SESSION_ID');
      expect(ID_PATTERNS.SESSION_ID).toBeInstanceOf(RegExp);
    });

    it('should validate 32-character hex strings', () => {
      const validId = 'a1b2c3d4e5f6789012345678abcdef12';
      expect(ID_PATTERNS.CHART_ID.test(validId)).toBe(true);
      expect(ID_PATTERNS.JOB_ID.test(validId)).toBe(true);
      expect(ID_PATTERNS.SESSION_ID.test(validId)).toBe(true);
    });

    it('should reject invalid IDs', () => {
      expect(ID_PATTERNS.CHART_ID.test('invalid')).toBe(false);
      expect(ID_PATTERNS.CHART_ID.test('')).toBe(false);
      expect(ID_PATTERNS.CHART_ID.test('a1b2c3d4')).toBe(false);
    });
  });

  describe('FILE_TYPES', () => {
    it('should have MIMES array', () => {
      expect(Array.isArray(FILE_TYPES.MIMES)).toBe(true);
      expect(FILE_TYPES.MIMES.length).toBeGreaterThan(0);
    });

    it('should have EXTENSIONS array', () => {
      expect(Array.isArray(FILE_TYPES.EXTENSIONS)).toBe(true);
      expect(FILE_TYPES.EXTENSIONS.length).toBeGreaterThan(0);
    });

    it('should include markdown MIME type', () => {
      expect(FILE_TYPES.MIMES).toContain('text/markdown');
    });

    it('should include text/plain MIME type', () => {
      expect(FILE_TYPES.MIMES).toContain('text/plain');
    });

    it('should include DOCX MIME type', () => {
      expect(FILE_TYPES.MIMES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should include PDF MIME type', () => {
      expect(FILE_TYPES.MIMES).toContain('application/pdf');
    });

    it('should include common extensions', () => {
      expect(FILE_TYPES.EXTENSIONS).toContain('md');
      expect(FILE_TYPES.EXTENSIONS).toContain('txt');
      expect(FILE_TYPES.EXTENSIONS).toContain('docx');
      expect(FILE_TYPES.EXTENSIONS).toContain('pdf');
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have WINDOW_MS as number', () => {
      expect(typeof RATE_LIMITS.WINDOW_MS).toBe('number');
      expect(RATE_LIMITS.WINDOW_MS).toBeGreaterThan(0);
    });

    it('should have MAX_REQUESTS as number', () => {
      expect(typeof RATE_LIMITS.MAX_REQUESTS).toBe('number');
      expect(RATE_LIMITS.MAX_REQUESTS).toBeGreaterThan(0);
    });

    it('should have STRICT_MAX_REQUESTS less than MAX_REQUESTS', () => {
      expect(RATE_LIMITS.STRICT_MAX_REQUESTS).toBeLessThan(RATE_LIMITS.MAX_REQUESTS);
    });
  });

  describe('TIMEOUTS', () => {
    it('should have REQUEST_MS as number', () => {
      expect(typeof TIMEOUTS.REQUEST_MS).toBe('number');
      expect(TIMEOUTS.REQUEST_MS).toBeGreaterThan(0);
    });

    it('should have RESPONSE_MS as number', () => {
      expect(typeof TIMEOUTS.RESPONSE_MS).toBe('number');
      expect(TIMEOUTS.RESPONSE_MS).toBeGreaterThan(0);
    });
  });

  describe('FILE_LIMITS', () => {
    it('should have MAX_SIZE_BYTES as number', () => {
      expect(typeof FILE_LIMITS.MAX_SIZE_BYTES).toBe('number');
      expect(FILE_LIMITS.MAX_SIZE_BYTES).toBeGreaterThan(0);
    });

    it('should have MAX_SIZE_MB consistent with bytes', () => {
      expect(FILE_LIMITS.MAX_SIZE_BYTES).toBe(FILE_LIMITS.MAX_SIZE_MB * 1024 * 1024);
    });

    it('should have MAX_COUNT as positive number', () => {
      expect(typeof FILE_LIMITS.MAX_COUNT).toBe('number');
      expect(FILE_LIMITS.MAX_COUNT).toBeGreaterThan(0);
    });
  });

  describe('VALIDATION', () => {
    it('should have MAX_QUESTION_LENGTH as number', () => {
      expect(typeof VALIDATION.MAX_QUESTION_LENGTH).toBe('number');
      expect(VALIDATION.MAX_QUESTION_LENGTH).toBeGreaterThan(0);
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have SESSION_NOT_FOUND message', () => {
      expect(typeof ERROR_MESSAGES.SESSION_NOT_FOUND).toBe('string');
      expect(ERROR_MESSAGES.SESSION_NOT_FOUND.length).toBeGreaterThan(0);
    });

    it('should have INVALID_CHART_ID message', () => {
      expect(typeof ERROR_MESSAGES.INVALID_CHART_ID).toBe('string');
    });

    it('should have CHART_NOT_FOUND message', () => {
      expect(typeof ERROR_MESSAGES.CHART_NOT_FOUND).toBe('string');
    });

    it('should have FILE_TOO_LARGE message', () => {
      expect(typeof ERROR_MESSAGES.FILE_TOO_LARGE).toBe('string');
    });

    it('should have RATE_LIMIT_EXCEEDED message', () => {
      expect(typeof ERROR_MESSAGES.RATE_LIMIT_EXCEEDED).toBe('string');
    });
  });

  describe('Frozen Objects', () => {
    it('should have frozen INJECTION_PATTERNS', () => {
      expect(Object.isFrozen(INJECTION_PATTERNS)).toBe(true);
    });

    it('should have frozen ID_PATTERNS', () => {
      expect(Object.isFrozen(ID_PATTERNS)).toBe(true);
    });

    it('should have frozen FILE_TYPES', () => {
      expect(Object.isFrozen(FILE_TYPES)).toBe(true);
    });

    it('should have frozen RATE_LIMITS', () => {
      expect(Object.isFrozen(RATE_LIMITS)).toBe(true);
    });

    it('should have frozen ERROR_MESSAGES', () => {
      expect(Object.isFrozen(ERROR_MESSAGES)).toBe(true);
    });
  });
});
