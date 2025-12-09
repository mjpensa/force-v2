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
export function logPerformanceMetrics(label = 'Performance Metrics') {
}
export function reportWebVitals(callback) {
  if (!('PerformanceObserver' in window)) return;
  const getRating = (value, thresholds) => value <= thresholds[0] ? 'good' : value <= thresholds[1] ? 'needs-improvement' : 'poor';
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      callback({ name: 'LCP', value: last.renderTime || last.loadTime, rating: getRating(last.renderTime || last.loadTime, [2500, 4000]) });
    }).observe({ entryTypes: ['largest-contentful-paint'] });
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        callback({ name: 'FID', value: entry.processingStart - entry.startTime, rating: getRating(entry.processingStart - entry.startTime, [100, 300]) });
      });
    }).observe({ entryTypes: ['first-input'] });
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) clsValue += entry.value;
      callback({ name: 'CLS', value: clsValue, rating: getRating(clsValue, [0.1, 0.25]) });
    }).observe({ entryTypes: ['layout-shift'] });
  } catch (e) {}
}
export function debounce(func, wait) {
  let timeout;
  return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}
export function throttle(func, limit) {
  let inThrottle;
  return (...args) => { if (!inThrottle) { func(...args); inThrottle = true; setTimeout(() => (inThrottle = false), limit); } };
}
export default { markPerformance, measurePerformance, logPerformanceMetrics, reportWebVitals, debounce, throttle };
