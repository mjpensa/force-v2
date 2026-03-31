import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModelRotator } from '../../server/model-rotation.js';

let rotator;

beforeEach(() => {
  rotator = new ModelRotator();
});

describe('ModelRotator', () => {
  describe('current', () => {
    it('returns the first model by default', () => {
      expect(rotator.current()).toBe('gemini-2.5-flash');
    });
  });

  describe('rotate', () => {
    it('advances to the next model', () => {
      const next = rotator.rotate();
      expect(next).toBe('gemini-2.5-pro');
      expect(rotator.current()).toBe('gemini-2.5-pro');
    });

    it('wraps around after the last model', () => {
      rotator.rotate(); // -> pro
      const wrapped = rotator.rotate(); // -> flash
      expect(wrapped).toBe('gemini-2.5-flash');
    });
  });

  describe('handleError', () => {
    it('rotates on 429 rate limit error', () => {
      const result = rotator.handleError(new Error('HTTP 429 Too Many Requests'));
      expect(result).toBe('gemini-2.5-pro');
    });

    it('rotates on quota error', () => {
      const result = rotator.handleError(new Error('quota exceeded'));
      expect(result).toBe('gemini-2.5-pro');
    });

    it('rotates on RESOURCE_EXHAUSTED error', () => {
      const result = rotator.handleError(new Error('RESOURCE_EXHAUSTED'));
      expect(result).toBe('gemini-2.5-pro');
    });

    it('re-throws non-rate-limit errors without rotating', () => {
      const err = new Error('network timeout');
      expect(() => rotator.handleError(err)).toThrow('network timeout');
      expect(rotator.current()).toBe('gemini-2.5-flash');
    });
  });

  describe('all models exhausted', () => {
    it('throws when all models are exhausted', () => {
      rotator.handleError(new Error('429')); // exhaust flash, move to pro
      expect(() => rotator.handleError(new Error('429'))).toThrow('All Gemini models exhausted');
    });
  });

  describe('reset', () => {
    it('clears exhausted set and resets to first model', () => {
      rotator.handleError(new Error('429')); // exhaust flash
      rotator.reset();

      expect(rotator.current()).toBe('gemini-2.5-flash');
      // Should be able to rotate freely again
      const next = rotator.rotate();
      expect(next).toBe('gemini-2.5-pro');
    });
  });

  describe('custom model list', () => {
    it('accepts a custom model list', () => {
      const custom = new ModelRotator(['model-a', 'model-b']);
      expect(custom.current()).toBe('model-a');
      expect(custom.rotate()).toBe('model-b');
      expect(custom.rotate()).toBe('model-a');
    });
  });
});
