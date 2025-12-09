import {
  INJECTION_PATTERNS,
  ID_PATTERNS,
  FILE_TYPES,
  RATE_LIMITS,
  TIMEOUTS,
  FILE_LIMITS,
  VALIDATION,
  ERROR_MESSAGES
} from './config/shared.js';

/**
 * Client Configuration
 *
 * Client-specific UI settings. Shared patterns are imported from
 * config/shared.js to maintain a single source of truth.
 */

export const CONFIG = {
  COLORS: {
    TODAY_LINE: '#BA3930',
    TASK_HOVER: '#354259',
    SWIMLANE_BG: '#0c2340',
    GRID_BORDER: '#0D0D0D',
    DRAG_HOVER: 'rgba(186, 57, 48, 0.1)',
    PRIMARY: '#BA3930',
    BAR_COLORS: {
      PRIORITY_RED: 'priority-red',
      MEDIUM_RED: 'medium-red',
      MID_GREY: 'mid-grey',
      LIGHT_GREY: 'light-grey',
      WHITE: 'white',
      DARK_BLUE: 'dark-blue'
    }
  },
  SIZES: {
    BAR_HEIGHT: 4, // SCALED: Was 6, 10, 14 - reduced for thinner bars
    POINT_RADIUS: 4, // SCALED: Was 5
    LOGO_HEIGHT: 28, // SCALED: Was 40 - significantly reduced for compact display
    MAX_FILE_SIZE_MB: FILE_LIMITS.MAX_SIZE_MB,
    MAX_TOTAL_SIZE_MB: FILE_LIMITS.MAX_TOTAL_SIZE_MB,
    MAX_FILE_COUNT: FILE_LIMITS.MAX_COUNT_UI,
    MAX_QUESTION_LENGTH: VALIDATION.MAX_QUESTION_LENGTH
  },
  EXPORT: {
    ASPECT_RATIO: { width: 9, height: 16 }, // Target aspect ratio for exports (9:16 portrait)
    SCALE: 2, // Resolution scale factor for high-quality exports
    BACKGROUND_COLOR: '#0c2340' // Background color for padding areas
  },
  API: {
    TIMEOUT_MS: TIMEOUTS.REQUEST_MS,
    RETRY_COUNT: 3,
    RATE_LIMIT_WINDOW_MS: RATE_LIMITS.WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS: RATE_LIMITS.MAX_REQUESTS,
    STRICT_RATE_LIMIT_MAX_REQUESTS: RATE_LIMITS.STRICT_MAX_REQUESTS,
    SESSION_EXPIRATION_MS: 60 * 60 * 1000, // 1 hour
    CLEANUP_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes
  },
  FILES: {
    SUPPORTED_MIMES: FILE_TYPES.MIMES,
    SUPPORTED_EXTENSIONS: FILE_TYPES.EXTENSIONS
  },
  UI: {
    ERROR_MESSAGES: {
      NO_CHART_DATA: 'No chart data found. Please close this tab and try generating the chart again.',
      CHART_NOT_FOUND: 'Chart Not Found',
      CHART_EXPIRED: 'This chart may have expired or the link is invalid.',
      CHART_AVAILABILITY: 'Charts are available for 30 days after generation.',
      SESSION_NOT_FOUND: ERROR_MESSAGES.SESSION_NOT_FOUND,
      INVALID_CHART_ID: ERROR_MESSAGES.INVALID_CHART_ID,
      FILE_TOO_LARGE: ERROR_MESSAGES.FILE_TOO_LARGE,
      TOO_MANY_FILES: 'Too many files. Maximum is 10 files per upload.', // UI uses different limit
      FIELD_TOO_LARGE: 'Field value too large. Maximum total size is 50MB.', // UI uses different limit
      RATE_LIMIT_EXCEEDED: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
      STRICT_RATE_LIMIT_EXCEEDED: ERROR_MESSAGES.STRICT_RATE_LIMIT_EXCEEDED
    },
    LOADING_MESSAGES: {
      GENERATING: 'Generating...',
      LOADING: 'Loading...'
    }
  },
  PATTERNS: {
    CHART_ID: ID_PATTERNS.CHART_ID,
    INJECTION_PATTERNS: INJECTION_PATTERNS
  }
};

Object.freeze(CONFIG);
Object.freeze(CONFIG.COLORS);
Object.freeze(CONFIG.COLORS.BAR_COLORS);
Object.freeze(CONFIG.SIZES);
Object.freeze(CONFIG.EXPORT);
Object.freeze(CONFIG.EXPORT.ASPECT_RATIO);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.FILES);
Object.freeze(CONFIG.UI);
Object.freeze(CONFIG.UI.ERROR_MESSAGES);
Object.freeze(CONFIG.UI.LOADING_MESSAGES);
Object.freeze(CONFIG.PATTERNS);

// Re-export shared config for convenience
export {
  INJECTION_PATTERNS,
  ID_PATTERNS,
  FILE_TYPES,
  RATE_LIMITS,
  TIMEOUTS,
  FILE_LIMITS,
  VALIDATION,
  ERROR_MESSAGES
};
