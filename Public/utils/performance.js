/**
 * Performance timer for measuring operations
 */
export class PerformanceTimer {
  constructor(operationName) {
    this.operationName = operationName;
    this.startTime = performance.now();
    this.marks = [];
  }

  mark(label) {
    const elapsed = Math.round(performance.now() - this.startTime);
    this.marks.push({ label, elapsed });
  }

  end() {
    const duration = Math.round(performance.now() - this.startTime);
    return duration;
  }
}
