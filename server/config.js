import 'dotenv/config';
import {
  INJECTION_PATTERNS,
  FILE_TYPES,
  RATE_LIMITS,
  TIMEOUTS,
  FILE_LIMITS,
  VALIDATION,
  ERROR_MESSAGES
} from '../Public/config/shared.js';

function validateEnvironment() {
  if (process.env.NODE_ENV === 'test') {
    if (!process.env.API_KEY) {
      process.env.API_KEY = 'test_api_key_for_testing';
    }
    return;
  }
  const required = ['API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    missing.forEach(key => console.error(`  ${key}=your_value_here`));
    process.exit(1);
  }
}

validateEnvironment();

export const CONFIG = {
  SERVER: {
    PORT: parseInt(process.env.PORT, 10) || 3000,
    TRUST_PROXY_HOPS: 1 // Railway uses single proxy layer
  },
  API: {
    GEMINI_MODEL: 'gemini-2.5-flash',
    RETRY_COUNT: 3,
    RETRY_BASE_DELAY_MS: 1000, // 1 second base delay
    TIMEOUT_MS: 300000, // 5 minutes - under typical proxy timeouts to prevent 502 errors
    MAX_OUTPUT_TOKENS_ANALYSIS: 65536,
    MAX_OUTPUT_TOKENS_QA: 8192,
    THINKING_BUDGET_ANALYSIS: 24576, // Maximum thinking tokens for task analysis (complex reasoning)
    TEMPERATURE_STRUCTURED: 0,
    TEMPERATURE_QA: 0.1,
    TOP_P: 0.1,
    TOP_K: 1,
    SEED: 42 // Fixed seed for deterministic output - same inputs produce same outputs
  },
  FILES: {
    MAX_SIZE_BYTES: FILE_LIMITS.MAX_SIZE_BYTES,
    MAX_COUNT: FILE_LIMITS.MAX_COUNT,
    MAX_FIELD_SIZE_BYTES: FILE_LIMITS.MAX_FIELD_SIZE_BYTES,
    ALLOWED_MIMES: FILE_TYPES.MIMES,
    ALLOWED_EXTENSIONS: FILE_TYPES.EXTENSIONS
  },
  TIMEOUTS: {
    REQUEST_MS: TIMEOUTS.REQUEST_MS,
    RESPONSE_MS: TIMEOUTS.RESPONSE_MS
  },
  RATE_LIMIT: {
    WINDOW_MS: RATE_LIMITS.WINDOW_MS,
    MAX_REQUESTS: RATE_LIMITS.MAX_REQUESTS,
  },
  CACHE: {
    STATIC_ASSETS_MAX_AGE: 86400 // 1 day in seconds
  },
  SECURITY: {
    INJECTION_PATTERNS: INJECTION_PATTERNS
  },
  VALIDATION: {
    MAX_QUESTION_LENGTH: VALIDATION.MAX_QUESTION_LENGTH
  },
  ERRORS: {
    MISSING_TASK_NAME: 'Missing taskName or entity',
    QUESTION_REQUIRED: 'Question is required and must be non-empty',
    ENTITY_REQUIRED: 'Entity is required',
    TASK_NAME_REQUIRED: 'Task name is required',
    QUESTION_TOO_LONG: 'Question too long (max 1000 characters)',
    FILE_TOO_LARGE: ERROR_MESSAGES.FILE_TOO_LARGE,
    TOO_MANY_FILES: ERROR_MESSAGES.TOO_MANY_FILES,
    FIELD_TOO_LARGE: ERROR_MESSAGES.FIELD_TOO_LARGE,
    RATE_LIMIT_EXCEEDED: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    INVALID_FILE_EXTENSION: (ext) => `Invalid file extension: .${ext}. Only .md, .txt, and .docx files are allowed.`,
    INVALID_FILE_TYPE: (type) => `Invalid file type: ${type}. Only .md, .txt, and .docx files are allowed.`
  }
};

Object.freeze(CONFIG);
Object.freeze(CONFIG.SERVER);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.FILES);
Object.freeze(CONFIG.TIMEOUTS);
Object.freeze(CONFIG.RATE_LIMIT);
Object.freeze(CONFIG.CACHE);
Object.freeze(CONFIG.SECURITY);
Object.freeze(CONFIG.VALIDATION);
Object.freeze(CONFIG.ERRORS);

