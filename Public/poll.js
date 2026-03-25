/**
 * Shared polling utility for content generation status.
 * Replaces: PollingService class, _pollForProcessingComplete, pollForPhase2Content.
 *
 * @param {string} sessionId - Session to poll
 * @param {string} viewName - View type to check (roadmap, slides, document, research-analysis)
 * @param {Object} [options]
 * @param {Function} [options.onTick] - Called each poll cycle: (attempt, elapsedMs) => void
 * @param {number} [options.baseInterval=2000] - Initial poll interval in ms
 * @param {number} [options.maxInterval=15000] - Maximum poll interval in ms
 * @param {number} [options.backoffFactor=1.2] - Backoff multiplier (applied every 5 attempts)
 * @param {number} [options.maxAttempts=120] - Maximum poll attempts before timeout
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
 * @returns {Promise<Object>} Resolves with { status: 'completed', data: {...} }
 * @throws {Error} On timeout, server error, generation failure, or abort
 */
export async function pollUntilReady(sessionId, viewName, options = {}) {
  const {
    onTick,
    baseInterval = 2000,
    maxInterval = 15000,
    backoffFactor = 1.2,
    maxAttempts = 120,
    signal
  } = options;

  const startTime = Date.now();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      const err = new Error('Polling aborted');
      err.name = 'AbortError';
      throw err;
    }

    if (onTick) {
      onTick(attempt, Date.now() - startTime);
    }

    try {
      const response = await fetch(`/api/content/${sessionId}/${viewName}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => `Server error: ${response.status}`);
        throw new Error(errorText.substring(0, 200));
      }

      const result = await response.json();

      if (result.status === 'completed' && result.data) {
        return result;
      }

      if (result.status === 'error' || result.status === 'failed') {
        throw new Error(result.error || `${viewName} generation failed`);
      }

      // Still processing — wait with backoff
      const interval = Math.min(
        baseInterval * Math.pow(backoffFactor, Math.floor(attempt / 5)),
        maxInterval
      );

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, interval);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            const err = new Error('Polling aborted');
            err.name = 'AbortError';
            reject(err);
          }, { once: true });
        }
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;

      // Network errors: continue polling (transient)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const interval = Math.min(baseInterval * 2, maxInterval);
        await new Promise(resolve => setTimeout(resolve, interval));
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Timed out waiting for ${viewName} after ${maxAttempts} attempts`);
}
