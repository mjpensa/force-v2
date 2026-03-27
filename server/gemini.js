import { GoogleGenerativeAI } from '@google/generative-ai';
import { CONFIG } from './config.js';
import { jsonrepair } from 'jsonrepair';
import { modelRotator } from './model-rotation.js';

export const genAI = new GoogleGenerativeAI(process.env.API_KEY);

function isRateLimitError(error) {
  return error.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'));
}

async function retryWithBackoff(operation, retryCount = CONFIG.API.RETRY_COUNT, onRetry = null) {
  let lastError = null;
  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isRateLimit = isRateLimitError(error);
      if (isRateLimit && (error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED'))) {
        throw error;
      }
      if (attempt >= retryCount - 1) throw error;
      if (onRetry) onRetry(attempt + 1, error);
      const delayMs = isRateLimit
        ? CONFIG.API.RETRY_BASE_DELAY_MS * Math.pow(2, attempt + 1)
        : CONFIG.API.RETRY_BASE_DELAY_MS * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error('All retry attempts failed.');
}

async function _callGemini(payload) {
  const model = genAI.getGenerativeModel(
    { model: modelRotator.current() },
    { timeout: CONFIG.API.TIMEOUT_MS, apiVersion: 'v1beta' }
  );
  const result = await model.generateContent(payload);
  return result.response.text();
}

export async function callGeminiForJson(payload, retryCount = CONFIG.API.RETRY_COUNT, onRetry = null) {
  return retryWithBackoff(async () => {
    const text = await _callGemini(payload);
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    try {
      return JSON.parse(jsonText);
    } catch (parseError) {
      try {
        return JSON.parse(jsonrepair(jsonText));
      } catch (_) {
        throw parseError;
      }
    }
  }, retryCount, onRetry);
}

export async function callGeminiForText(payload, retryCount = CONFIG.API.RETRY_COUNT) {
  return retryWithBackoff(async () => {
    return await _callGemini(payload);
  }, retryCount);
}
