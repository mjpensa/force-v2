const marks = new Map();
export function markPerformance(name) {
  const timestamp = performance.now();
  marks.set(name, timestamp);
  if (performance.mark) performance.mark(name);
  return timestamp;
}
export function measurePerformance(name, startMark, endMark) {
  const startTime = marks.get(startMark);
  const endTime = marks.get(endMark);
  if (!startTime || !endTime) return 0;
  return endTime - startTime;
}
