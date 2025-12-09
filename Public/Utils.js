/**
 * Utils - Backwards compatibility module
 *
 * This file re-exports utilities from the utils/ directory for
 * backwards compatibility with existing imports.
 *
 * For new code, prefer importing from specific modules:
 * - utils/fetch.js - HTTP fetch utilities
 * - utils/dom.js - DOM manipulation utilities
 * - utils/date.js - Date calculation utilities
 * - utils/analysis-builders.js - Analysis HTML builders
 * - utils/performance.js - Performance measurement
 * - utils/assets.js - Asset loading and legend building
 */

export * from './utils/index.js';
