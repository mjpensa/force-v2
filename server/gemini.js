import { GoogleGenerativeAI } from '@google/generative-ai';
import { CONFIG } from './config.js';
import { jsonrepair } from 'jsonrepair';
import { modelRotator } from './model-rotation.js';

/**
 * The single Gemini call path.
 *
 * There used to be two. This module had retry, markdown-fence stripping and jsonrepair;
 * generators.js had jsonrepair only, no retry, its own timeout mechanism, and its own
 * getGenerativeModel call site. The two disagreed about what counts as a rate limit, so the
 * content pipeline — the expensive one, the one that issues 10-12 calls per run — was the
 * half without retry.
 *
 * That is not theoretical. Capturing speaker-notes on 2026-08-07 lost a call to a transient
 * 503 after the outline pass had already succeeded: one wasted request out of a 20-per-day
 * free-tier budget, which a single retry would have saved.
 */

export const genAI = new GoogleGenerativeAI(process.env.API_KEY);

/**
 * Retryable rate limiting — the per-minute kind. Worth backing off and trying again.
 */
export function isRateLimited(error) {
  const msg = error?.message ?? '';
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
}

/**
 * Terminal quota exhaustion — the per-day kind. Retrying cannot help and each attempt is
 * itself billed against the budget, so this must never be retried.
 *
 * Kept separate from isRateLimited on purpose: a bare 429 is usually a burst limit and
 * should back off, while a 429 naming quota means the day is over. Collapsing the two
 * either burns quota on doomed retries or gives up on recoverable bursts.
 */
export function isQuotaExhausted(error) {
  const msg = error?.message ?? '';
  return msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
}

/**
 * Thrown when the model stopped because it ran out of output budget. Its own class so the
 * retry loop can refuse to retry it — see retryWithBackoff.
 */
export class TruncatedResponseError extends Error {
  constructor(label, finishReason) {
    super(
      `${label}: response truncated by the model (finishReason: ${finishReason}). ` +
      `The output hit its token ceiling, so the JSON is incomplete. Raise maxOutputTokens, ` +
      `lower thinkingBudget, or reduce what the schema asks for — retrying will not help.`
    );
    this.name = 'TruncatedResponseError';
    this.finishReason = finishReason;
  }
}

export async function retryWithBackoff(operation, retryCount = CONFIG.API.RETRY_COUNT, onRetry = null) {
  let lastError = null;
  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (isQuotaExhausted(error)) throw error;
      // Same reasoning as quota: the next attempt hits the same ceiling, and each one is
      // billed. Surface it instead of spending the budget three times over.
      if (error instanceof TruncatedResponseError) throw error;
      if (attempt >= retryCount - 1) throw error;
      if (onRetry) onRetry(attempt + 1, error);
      const delayMs = isRateLimited(error)
        ? CONFIG.API.RETRY_BASE_DELAY_MS * Math.pow(2, attempt + 1)
        : CONFIG.API.RETRY_BASE_DELAY_MS * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error('All retry attempts failed.');
}

/**
 * One request to the model. `generationConfig` carries responseSchema for the structured
 * generators; the free-text callers omit it.
 *
 * The timeout is passed as an SDK request option rather than raced with a Promise, so the
 * underlying HTTP request is actually abandoned instead of left running while the race
 * result is discarded.
 */

async function callOnce(payload, { generationConfig, timeoutMs = CONFIG.API.TIMEOUT_MS, label = 'response' } = {}) {
  const modelId = modelRotator.current();
  const model = genAI.getGenerativeModel(
    generationConfig ? { model: modelId, generationConfig } : { model: modelId },
    { timeout: timeoutMs, apiVersion: 'v1beta' }
  );
  const result = await model.generateContent(payload);

  // Gemini reports truncation on every response and this was never read. Combined with
  // jsonrepair closing the braces afterwards, a truncated response parsed clean and looked
  // like a complete one: narrative-spine silently lost 3 of 5 required fields for months,
  // and a 24-slide speaker-notes run lost the last slide's notes entirely. Failing here
  // makes the ceiling visible instead of quietly delivering a partial deliverable.
  const finishReason = result.response?.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    throw new TruncatedResponseError(label, finishReason);
  }

  return result.response.text();
}

/**
 * Parse a model response as JSON.
 *
 * Fence stripping and jsonrepair both stay. jsonrepair is NOT dead code despite
 * responseMimeType/responseSchema being set — it was observed salvaging a malformed
 * gemini-2.5-flash speaker-notes response on 2026-08-07, the first real generation after
 * logging was added to this path.
 */
export function parseModelJson(text, label = 'response') {
  let jsonText = String(text).trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    try {
      const repaired = JSON.parse(jsonrepair(jsonText));
      console.warn(`[${label}] jsonrepair salvaged a malformed response`);
      return repaired;
    } catch {
      throw parseError; // the original parse error is the useful one
    }
  }
}

/**
 * Structured call: retries, honors a schema, and returns parsed JSON.
 * Used by the content generators.
 */
export async function callModelForJson(payload, {
  generationConfig,
  timeoutMs,
  retryCount = CONFIG.API.RETRY_COUNT,
  onRetry = null,
  label = 'response',
} = {}) {
  return retryWithBackoff(
    async () => parseModelJson(await callOnce(payload, { generationConfig, timeoutMs, label }), label),
    retryCount,
    onRetry
  );
}

export async function callGeminiForJson(payload, retryCount = CONFIG.API.RETRY_COUNT, onRetry = null) {
  return callModelForJson(payload, { retryCount, onRetry });
}

export async function callGeminiForText(payload, retryCount = CONFIG.API.RETRY_COUNT) {
  return retryWithBackoff(async () => callOnce(payload), retryCount);
}
