/**
 * Performance measurement utilities
 */

/**
 * Performance timer for measuring operations
 */
export class PerformanceTimer {
  constructor(operationName) {
    this.operationName = operationName;
    this.startTime = performance.now();
    this.marks = [];
  }

  /**
   * Add a timing mark
   * @param {string} label - Label for the mark
   */
  mark(label) {
    const elapsed = Math.round(performance.now() - this.startTime);
    this.marks.push({ label, elapsed });
  }

  /**
   * End the timer and return duration
   * @returns {number} - Duration in milliseconds
   */
  end() {
    const duration = Math.round(performance.now() - this.startTime);
    return duration;
  }

  /**
   * Get all marks
   * @returns {Array} - Array of {label, elapsed} objects
   */
  getMarks() {
    return this.marks;
  }
}

/**
 * Measure an async operation
 * @param {string} label - Label for the operation
 * @param {Function} fn - Async function to measure
 * @returns {Promise<any>} - Result of the function
 */
export async function measureAsync(label, fn) {
  const timer = new PerformanceTimer(label);
  try {
    const result = await fn();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    throw error;
  }
}
