// Fetch utilities
export { fetchJSON } from './fetch.js';

// DOM utilities
export {
  safeGetElement,
  safeQuerySelector,
  isSafeUrl,
  createButton,
  createModal
} from './dom.js';

// Date utilities
export {
  getWeek,
  findTodayColumnPosition
} from './date.js';

// Analysis builders
export {
  buildAnalysisSection,
  buildAnalysisList,
  buildTimelineScenarios,
  buildRiskAnalysis,
  buildImpactAnalysis,
  buildSchedulingContext,
  buildProgressIndicators,
  buildAccelerators
} from './analysis-builders.js';

// Performance utilities
export {
  PerformanceTimer,
  measureAsync
} from './performance.js';

// Asset utilities
export {
  loadFooterSVG,
  buildLegend
} from './assets.js';
