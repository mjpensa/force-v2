/**
 * Shared Configuration
 *
 * Common patterns and values used by both server and client.
 * This is the single source of truth for duplicated configurations.
 */

/**
 * Security injection patterns to detect and sanitize prompt injection attempts
 */
export const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, replacement: '[REDACTED]' },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, replacement: '[REDACTED]' },
  { pattern: /forget\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, replacement: '[REDACTED]' },
  { pattern: /system\s*:/gi, replacement: '[REDACTED]' },
  { pattern: /\[SYSTEM\]/gi, replacement: '[REDACTED]' },
  { pattern: /\{SYSTEM\}/gi, replacement: '[REDACTED]' },
  { pattern: /new\s+instructions?\s*:/gi, replacement: '[REDACTED]' },
  { pattern: /override\s+instructions?/gi, replacement: '[REDACTED]' },
  { pattern: /you\s+are\s+now\s+/gi, replacement: '[REDACTED]' },
  { pattern: /act\s+as\s+if\s+you\s+are\s+/gi, replacement: '[REDACTED]' },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+/gi, replacement: '[REDACTED]' }
];

/**
 * ID validation patterns
 */
export const ID_PATTERNS = {
  CHART_ID: /^[a-f0-9]{32}$/i,
  JOB_ID: /^[a-f0-9]{32}$/i,
  SESSION_ID: /^[a-f0-9]{32}$/i
};

/**
 * Supported file types for upload
 */
export const FILE_TYPES = {
  MIMES: [
    'text/markdown',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream', // Some browsers send .md files with this MIME type
    'application/pdf'
  ],
  EXTENSIONS: ['md', 'txt', 'docx', 'pdf']
};

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  STRICT_MAX_REQUESTS: 20 // For resource-intensive endpoints
};

/**
 * Request timeouts
 */
export const TIMEOUTS = {
  REQUEST_MS: 120000, // 2 minutes
  RESPONSE_MS: 120000
};

/**
 * File size limits
 */
export const FILE_LIMITS = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB per file
  MAX_SIZE_MB: 10,
  MAX_TOTAL_SIZE_MB: 50,
  MAX_COUNT: 500, // Server allows up to 500 for folder uploads
  MAX_COUNT_UI: 10, // UI default for simple uploads
  MAX_FIELD_SIZE_BYTES: 200 * 1024 * 1024 // 200MB total
};

/**
 * Validation limits
 */
export const VALIDATION = {
  MAX_QUESTION_LENGTH: 1000
};

/**
 * Common error messages used by both server and client
 */
export const ERROR_MESSAGES = {
  SESSION_NOT_FOUND: 'Session not found or expired. Please regenerate the chart.',
  INVALID_CHART_ID: 'Invalid chart ID format',
  CHART_NOT_FOUND: 'Chart not found or expired. Charts are available for 30 days after generation.',
  FILE_TOO_LARGE: 'File too large. Maximum size is 10MB per file.',
  TOO_MANY_FILES: 'Too many files. Maximum is 500 files per upload.',
  FIELD_TOO_LARGE: 'Field value too large. Maximum total size is 200MB.',
  RATE_LIMIT_EXCEEDED: 'Too many requests from this IP, please try again later.',
  STRICT_RATE_LIMIT_EXCEEDED: 'Too many chart generation requests. Please try again in 15 minutes.'
};

Object.freeze(INJECTION_PATTERNS);
Object.freeze(ID_PATTERNS);
Object.freeze(FILE_TYPES);
Object.freeze(RATE_LIMITS);
Object.freeze(TIMEOUTS);
Object.freeze(FILE_LIMITS);
Object.freeze(VALIDATION);
Object.freeze(ERROR_MESSAGES);
