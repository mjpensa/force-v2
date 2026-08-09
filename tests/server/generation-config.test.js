import { describe, it, expect } from '@jest/globals';
import { GENERATION_CONFIGS } from '../../server/generators.js';

/**
 * On Gemini 2.5 thinking tokens count against maxOutputTokens. A config whose thinkingBudget
 * meets or exceeds its output cap therefore cannot produce a complete response — the model
 * is cut off mid-object.
 *
 * NARRATIVE_SPINE_CONFIG shipped as thinkingBudget 4096 against maxOutputTokens 2048. The
 * failure was invisible because jsonrepair closed the truncated JSON and it parsed cleanly:
 * both golden captures stop in exact schema order after keyClaims, one carries an
 * empty-string key with value "null" (jsonrepair completing a document cut mid-key), and
 * nothing validated the result until the schema guard landed.
 *
 * It was expensive because that object is the narrative spine, injected into every
 * downstream prompt under a header declaring it AUTHORITATIVE. Removing the cap took it from
 * 2 of 5 required fields and 1 claim to 5 of 5 and 3 claims with evidence and stakes —
 * verified live, captured as narrative-spine-3.json.
 */
describe('generation configs', () => {
  it.each(Object.entries(GENERATION_CONFIGS))(
    '%s leaves room for output beyond its thinking budget',
    (_name, config) => {
      if (config.maxOutputTokens === undefined) return; // uses the model default
      expect(config.thinkingBudget).toBeLessThan(config.maxOutputTokens);
    }
  );

  it.each(Object.entries(GENERATION_CONFIGS))(
    '%s leaves a workable margin, not just a nominal one',
    (_name, config) => {
      if (config.maxOutputTokens === undefined) return;
      // Thinking plus a plausible response has to fit. A cap only marginally above the
      // thinking budget truncates the same way, just less obviously.
      expect(config.maxOutputTokens - config.thinkingBudget).toBeGreaterThanOrEqual(4096);
    }
  );

  it('narrative-spine no longer caps output below its thinking budget', () => {
    expect(GENERATION_CONFIGS.NARRATIVE_SPINE_CONFIG.maxOutputTokens).toBeUndefined();
  });
});

describe('truncation detection', () => {
  /**
   * Gemini sets finishReason: MAX_TOKENS on every response it cut short, and the code read
   * it nowhere. jsonrepair then closed the braces, so a truncated response parsed cleanly
   * and was indistinguishable from a complete one.
   *
   * Two real deliverables were silently damaged by that combination: narrative-spine lost
   * 3 of 5 required fields on every run, and a 24-slide speaker-notes generation lost the
   * final slide's notes — slides 0-22 carry all 13 fields, slide 23 carries 4.
   */
  it('is not retried, because the ceiling will be hit again', async () => {
    const { retryWithBackoff, TruncatedResponseError } = await import('../../server/gemini.js');
    let attempts = 0;
    const op = async () => {
      attempts += 1;
      throw new TruncatedResponseError('Slides', 'MAX_TOKENS');
    };
    await expect(retryWithBackoff(op, 3)).rejects.toThrow(TruncatedResponseError);
    expect(attempts).toBe(1);
  });

  it('says what to change, since the caller cannot fix it by retrying', async () => {
    const { TruncatedResponseError } = await import('../../server/gemini.js');
    const err = new TruncatedResponseError('SpeakerNotes', 'MAX_TOKENS');
    expect(err.message).toContain('SpeakerNotes');
    expect(err.message).toContain('maxOutputTokens');
    expect(err.message).toContain('thinkingBudget');
    expect(err.finishReason).toBe('MAX_TOKENS');
  });

  it('still retries ordinary transient failures', async () => {
    const { retryWithBackoff } = await import('../../server/gemini.js');
    let attempts = 0;
    const op = async () => {
      attempts += 1;
      if (attempts < 2) throw new Error('503 Service Unavailable');
      return 'ok';
    };
    await expect(retryWithBackoff(op, 3)).resolves.toBe('ok');
    expect(attempts).toBe(2);
  });
});
