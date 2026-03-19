const metrics = { marks: new Map(), measures: new Map() };
export function markPerformance(name) {
  const timestamp = performance.now();
  metrics.marks.set(name, timestamp);
  if (performance.mark) performance.mark(name);
  return timestamp;
}
export function measurePerformance(name, startMark, endMark) {
  const startTime = metrics.marks.get(startMark);
  const endTime = metrics.marks.get(endMark);
  if (!startTime || !endTime) return 0;
  const duration = endTime - startTime;
  metrics.measures.set(name, duration);
  return duration;
}
