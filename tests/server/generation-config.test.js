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
