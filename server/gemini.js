import { CONFIG, getGeminiApiUrl } from './config.js';
import { jsonrepair } from 'jsonrepair';
const API_URL = getGeminiApiUrl();

function isRateLimitError(error) {
  return error.message && error.message.includes('status: 429');
}
function createQuotaErrorMessage(errorData) {
  try {
    if (errorData && errorData.error && errorData.error.message) {
      const msg = errorData.error.message;
      if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        const retryDelayMatch = msg.match(/retry in ([\d.]+)s/);
        const retryTime = retryDelayMatch ? Math.ceil(parseFloat(retryDelayMatch[1])) : null;
        if (retryTime && retryTime > 60) {
          return `API quota exceeded. The free tier has limits on requests per minute. Please wait ${Math.ceil(retryTime / 60)} minute(s) and try again, or upgrade your API plan at https://ai.google.dev/pricing`;
        } else if (retryTime) {
          return `API quota exceeded. Please wait ${retryTime} seconds and try again, or upgrade your API plan at https://ai.google.dev/pricing`;
        }
        return 'API quota exceeded. You have reached the free tier limit. Please wait a few minutes and try again, or upgrade your API plan at https://ai.google.dev/pricing';
      }
    }
  } catch (e) {
  }
  return 'API rate limit exceeded. Please try again in a few minutes.';
}
export async function retryWithBackoff(operation, retryCount = CONFIG.API.RETRY_COUNT, onRetry = null) {
  let lastError = null;
  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isRateLimit = isRateLimitError(error);
      if (isRateLimit) {
        if (error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED')) {
          throw error; // Fail immediately for quota exhaustion
        }
      }
      if (attempt >= retryCount - 1) {
        throw error; // Throw the last error
      }
      if (onRetry) {
        onRetry(attempt + 1, error);
      }
      let delayMs;
      if (isRateLimit) {
        delayMs = CONFIG.API.RETRY_BASE_DELAY_MS * Math.pow(2, attempt + 1);
      } else {
        delayMs = CONFIG.API.RETRY_BASE_DELAY_MS * (attempt + 1);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error('All retry attempts failed.');
}
export async function callGeminiForJson(payload, retryCount = CONFIG.API.RETRY_COUNT, onRetry = null) {
  return retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT_MS);
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('API call timed out. The request took too long to complete.');
      }
      throw error;
    }
    clearTimeout(timeoutId);
    if (!response.ok) {
      let errorText = 'Unknown error';
      let errorData = null;
      try {
        errorText = await response.text();
        try {
          errorData = JSON.parse(errorText);
        } catch (jsonError) {
        }
      } catch (e) {
      }
      if (response.status === 429 && errorData) {
        const friendlyMessage = createQuotaErrorMessage(errorData);
        throw new Error(`API call failed with status: ${response.status} - ${friendlyMessage}`);
      }
      throw new Error(`API call failed with status: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error('Invalid response from AI API');
    }
    const safetyRatings = result.candidates[0].safetyRatings;
    if (safetyRatings) {
      const blockedRating = safetyRatings.find(rating => rating.blocked);
      if (blockedRating) {
        throw new Error(`API call blocked due to safety rating: ${blockedRating.category}`);
      }
    }
    if (!result.candidates[0].content.parts || !Array.isArray(result.candidates[0].content.parts) || result.candidates[0].content.parts.length === 0) {
      throw new Error('No content parts in Gemini response');
    }
    let extractedJsonText = result.candidates[0].content.parts[0].text;
    extractedJsonText = extractedJsonText.trim();
    if (extractedJsonText.startsWith('```json')) {
      extractedJsonText = extractedJsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (extractedJsonText.startsWith('```')) {
      extractedJsonText = extractedJsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    try {
      return JSON.parse(extractedJsonText);
    } catch (parseError) {
      const positionMatch = parseError.message.match(/position (\d+)/);
      const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0;
      if (errorPosition > 0) {
        const contextStart = Math.max(0, errorPosition - 200);
        const contextEnd = Math.min(extractedJsonText.length, errorPosition + 200);
      }
      try {
        const repairedJsonText = jsonrepair(extractedJsonText);
        const repairedData = JSON.parse(repairedJsonText);
        const isChartData = repairedData.title && repairedData.timeColumns && repairedData.data;
        const isTaskAnalysis = repairedData.taskName && repairedData.status;
        if (isChartData) {
          if (!repairedData.data || !Array.isArray(repairedData.data)) {
            throw new Error('Repaired JSON structure is invalid - missing data array');
          }
          if (!repairedData.timeColumns || !Array.isArray(repairedData.timeColumns)) {
            throw new Error('Repaired JSON structure is invalid - missing timeColumns array');
          }
          if (repairedData.data.length < 2) {
          }
          for (let i = 0; i < repairedData.data.length; i++) {
            const item = repairedData.data[i];
            if (!item.title || typeof item.isSwimlane !== 'boolean' || !item.entity) {
              throw new Error(`Repaired JSON data item ${i} is invalid - missing required properties`);
            }
          }
        } else if (isTaskAnalysis) {
        } else {
        }
        return repairedData;
      } catch (repairError) {
        throw parseError; // Throw the original error
      }
    }
  }, retryCount, onRetry);
}
export async function callGeminiForText(payload, retryCount = CONFIG.API.RETRY_COUNT) {
  return retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT_MS);
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('API call timed out. The request took too long to complete.');
      }
      throw error;
    }
    clearTimeout(timeoutId);
    if (!response.ok) {
      let errorText = 'Unknown error';
      let errorData = null;
      try {
        errorText = await response.text();
        try {
          errorData = JSON.parse(errorText);
        } catch (jsonError) {
        }
      } catch (e) {
      }
      if (response.status === 429 && errorData) {
        const friendlyMessage = createQuotaErrorMessage(errorData);
        throw new Error(`API call failed with status: ${response.status} - ${friendlyMessage}`);
      }
      throw new Error(`API call failed with status: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error('Invalid response from AI API');
    }
    const safetyRatings = result.candidates[0].safetyRatings;
    if (safetyRatings) {
      const blockedRating = safetyRatings.find(rating => rating.blocked);
      if (blockedRating) {
        throw new Error(`API call blocked due to safety rating: ${blockedRating.category}`);
      }
    }
    if (!result.candidates[0].content.parts || !Array.isArray(result.candidates[0].content.parts) || result.candidates[0].content.parts.length === 0) {
      throw new Error('No content parts in Gemini response');
    }
    return result.candidates[0].content.parts[0].text; // Return raw text
  }, retryCount);
}
