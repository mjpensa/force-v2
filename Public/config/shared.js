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
  MAX_REQUESTS: 100
};

export const TIMEOUTS = {
  REQUEST_MS: 120000, // 2 minutes
  RESPONSE_MS: 120000
};

export const FILE_LIMITS = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB per file
  MAX_SIZE_MB: 10,
  MAX_COUNT: 500, // Server allows up to 500 for folder uploads
  MAX_FIELD_SIZE_BYTES: 200 * 1024 * 1024 // 200MB total
};

export const VALIDATION = {
  MAX_QUESTION_LENGTH: 1000
};

export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: 'File too large. Maximum size is 10MB per file.',
  TOO_MANY_FILES: 'Too many files. Maximum is 500 files per upload.',
  FIELD_TOO_LARGE: 'Field value too large. Maximum total size is 200MB.',
  RATE_LIMIT_EXCEEDED: 'Too many requests from this IP, please try again later.'
};

Object.freeze(INJECTION_PATTERNS);
Object.freeze(FILE_TYPES);
Object.freeze(RATE_LIMITS);
Object.freeze(TIMEOUTS);
Object.freeze(FILE_LIMITS);
Object.freeze(VALIDATION);
Object.freeze(ERROR_MESSAGES);
