import { CONFIG } from './config.js';
import { safeGetElement, loadFooterSVG } from './Utils.js';
import { GanttChart } from './GanttChart.js';
import { TaskAnalyzer } from './analysis/TaskAnalyzer.js';
let ganttData = null;
let footerSVG = '';
let errorDisplayed = false; // Track if an error message has already been shown
const taskAnalyzer = new TaskAnalyzer();
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const chartId = urlParams.get('id');
  if (chartId) {
    await loadChartFromServer(chartId);
  }
  if (ganttData) {
    footerSVG = await loadFooterSVG();
    renderChart();
  } else if (!errorDisplayed) {
    displayNoChartDataMessage();
  }
});
async function loadChartFromServer(chartId) {
  const maxRetries = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 2), 5000)));
      }
      const response = await fetch(`/chart/${chartId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Chart not found (404). It may have expired or the link is invalid.`);
        }
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      ganttData = await response.json();
      if (!ganttData || typeof ganttData !== 'object') {
        throw new Error('Invalid chart data structure');
      }
      if (!ganttData.timeColumns || !Array.isArray(ganttData.timeColumns)) {
        throw new Error('Invalid timeColumns in chart data');
      }
      if (!ganttData.data || !Array.isArray(ganttData.data)) {
        throw new Error('Invalid data array in chart data');
      }
      return;
    } catch (error) {
      lastError = error;
      if (error.message.includes('404')) {
        break;
      }
      if (attempt === maxRetries) {
        break;
      }
    }
  }
  console.error('Failed to load chart:', {
    name: lastError?.name,
    message: lastError?.message,
    chartId: chartId,
    timestamp: new Date().toISOString()
  });
  ganttData = null; // Ensure ganttData is null after error
  errorDisplayed = true; // Mark that we're displaying a specific error
  displayChartNotFoundMessage();
}
function renderChart() {
  const container = document.getElementById('chart-root');
  if (!container) {
    return;
  }
  const chart = new GanttChart(
    container,
    ganttData,
    footerSVG,
    handleTaskClick
  );
  chart.render();
}
function handleTaskClick(taskIdentifier) {
  taskAnalyzer.showAnalysis(taskIdentifier);
}
function displayChartNotFoundMessage() {
  const container = safeGetElement('chart-root', 'displayChartNotFoundMessage');
  if (container) {
    container.innerHTML = `
      <div style="font-family: sans-serif; text-align: center; margin-top: 40px;">
        <h1>${CONFIG.UI.ERROR_MESSAGES.CHART_NOT_FOUND}</h1>
        <p style="color: #666;">${CONFIG.UI.ERROR_MESSAGES.CHART_EXPIRED}</p>
        <p style="color: #666;">${CONFIG.UI.ERROR_MESSAGES.CHART_AVAILABILITY}</p>
      </div>
    `;
  }
}
function displayNoChartDataMessage() {
  const container = safeGetElement('chart-root', 'displayNoChartDataMessage');
  if (container) {
    container.innerHTML = `
      <h1 style="font-family: sans-serif; text-align: center; margin-top: 40px;">${CONFIG.UI.ERROR_MESSAGES.NO_CHART_DATA}</h1>
    `;
  }
}
