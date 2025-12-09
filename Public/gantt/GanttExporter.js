/**
 * GanttExporter - Handles chart export functionality
 * Extracted from GanttChart.js for modularity
 * Contains: PNG export, SVG export, URL copy, notifications
 */

import { CONFIG } from '../config.js';

export class GanttExporter {
  constructor(chartContainer, callbacks = {}) {
    this.chartContainer = chartContainer;
    this.onAnnounce = callbacks.onAnnounce || (() => {});
  }

  /**
   * Calculate dimensions for target aspect ratio with perfect scaling
   * @param {number} sourceWidth - Original content width
   * @param {number} sourceHeight - Original content height
   * @returns {Object} Target dimensions and scaling info
   */
  _calculateAspectRatioDimensions(sourceWidth, sourceHeight) {
    const { width: ratioW, height: ratioH } = CONFIG.EXPORT.ASPECT_RATIO;
    const targetRatio = ratioW / ratioH; // 9:16 = 0.5625
    const sourceRatio = sourceWidth / sourceHeight;

    let targetWidth, targetHeight, scale, offsetX, offsetY;

    if (sourceRatio > targetRatio) {
      // Source is wider than target ratio - fit to width, add vertical padding
      targetWidth = sourceWidth;
      targetHeight = sourceWidth / targetRatio;
      scale = 1;
      offsetX = 0;
      offsetY = (targetHeight - sourceHeight) / 2;
    } else {
      // Source is taller than target ratio - fit to height, add horizontal padding
      targetHeight = sourceHeight;
      targetWidth = sourceHeight * targetRatio;
      scale = 1;
      offsetX = (targetWidth - sourceWidth) / 2;
      offsetY = 0;
    }

    return {
      targetWidth: Math.ceil(targetWidth),
      targetHeight: Math.ceil(targetHeight),
      scale,
      offsetX: Math.ceil(offsetX),
      offsetY: Math.ceil(offsetY),
      sourceWidth,
      sourceHeight
    };
  }

  /**
   * Create a canvas with the target aspect ratio and scaled content
   * @param {HTMLCanvasElement} sourceCanvas - The original captured canvas
   * @returns {HTMLCanvasElement} New canvas with 9:16 aspect ratio
   */
  _createAspectRatioCanvas(sourceCanvas) {
    const dims = this._calculateAspectRatioDimensions(
      sourceCanvas.width,
      sourceCanvas.height
    );

    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = dims.targetWidth;
    targetCanvas.height = dims.targetHeight;

    const ctx = targetCanvas.getContext('2d');

    // Fill background with the chart's background color
    ctx.fillStyle = CONFIG.EXPORT.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, dims.targetWidth, dims.targetHeight);

    // Draw the source canvas centered on the target canvas
    ctx.drawImage(
      sourceCanvas,
      dims.offsetX,
      dims.offsetY,
      dims.sourceWidth,
      dims.sourceHeight
    );

    return targetCanvas;
  }

  /**
   * Initialize all export listeners
   */
  initializeListeners() {
    this._addExportListener();
    this._addSvgExportListener();
    this._addCopyUrlListener();
  }

  /**
   * PNG export listener
   */
  _addExportListener() {
    const exportBtn = document.getElementById('export-png-btn');
    if (!exportBtn || !this.chartContainer) return;

    exportBtn.addEventListener('click', async () => {
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;

      const loadingOverlay = this._createExportLoadingOverlay();
      document.body.appendChild(loadingOverlay);

      try {
        await new Promise(resolve => requestAnimationFrame(resolve));

        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        // Capture the chart at its natural size
        const sourceCanvas = await html2canvas(this.chartContainer, {
          useCORS: true,
          logging: false,
          scale: CONFIG.EXPORT.SCALE,
          allowTaint: false,
          backgroundColor: CONFIG.EXPORT.BACKGROUND_COLOR,
          scrollY: -scrollY,
          scrollX: -scrollX,
          windowWidth: this.chartContainer.scrollWidth,
          windowHeight: this.chartContainer.scrollHeight,
          width: this.chartContainer.scrollWidth,
          height: this.chartContainer.scrollHeight
        });

        // Apply 9:16 aspect ratio scaling
        const aspectRatioCanvas = this._createAspectRatioCanvas(sourceCanvas);

        const link = document.createElement('a');
        link.download = 'gantt-chart.png';
        link.href = aspectRatioCanvas.toDataURL('image/png');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        exportBtn.textContent = 'Export as PNG';
        exportBtn.disabled = false;
        document.body.removeChild(loadingOverlay);
      } catch (err) {
        exportBtn.textContent = 'Export as PNG';
        exportBtn.disabled = false;
        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }
        alert('Error exporting chart. See console for details.');
      }
    });
  }

  /**
   * SVG export listener
   */
  _addSvgExportListener() {
    const exportBtn = document.getElementById('export-svg-btn');
    if (!exportBtn || !this.chartContainer) return;

    exportBtn.addEventListener('click', async () => {
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;

      const loadingOverlay = this._createExportLoadingOverlay('Generating vector SVG...');
      document.body.appendChild(loadingOverlay);

      try {
        await new Promise(resolve => requestAnimationFrame(resolve));

        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

        // Capture the chart at its natural size
        const sourceCanvas = await html2canvas(this.chartContainer, {
          useCORS: true,
          logging: false,
          scale: CONFIG.EXPORT.SCALE,
          allowTaint: false,
          backgroundColor: CONFIG.EXPORT.BACKGROUND_COLOR,
          scrollY: -scrollY,
          scrollX: -scrollX,
          windowWidth: this.chartContainer.scrollWidth,
          windowHeight: this.chartContainer.scrollHeight,
          width: this.chartContainer.scrollWidth,
          height: this.chartContainer.scrollHeight
        });

        // Apply 9:16 aspect ratio scaling
        const aspectRatioCanvas = this._createAspectRatioCanvas(sourceCanvas);
        const imageData = aspectRatioCanvas.toDataURL('image/png');

        // Use the aspect ratio canvas dimensions for SVG
        const width = aspectRatioCanvas.width;
        const height = aspectRatioCanvas.height;

        const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>Gantt Chart Export</title>
  <desc>AI-generated Gantt chart exported as SVG with embedded raster image (9:16 aspect ratio)</desc>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${CONFIG.EXPORT.BACKGROUND_COLOR}"/>
  <image x="0" y="0" width="${width}" height="${height}"
         xlink:href="${imageData}"
         preserveAspectRatio="xMidYMid meet"/>
</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = 'gantt-chart.svg';
        link.href = url;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        exportBtn.textContent = 'Export as SVG';
        exportBtn.disabled = false;
        document.body.removeChild(loadingOverlay);
      } catch (err) {
        exportBtn.textContent = 'Export as SVG';
        exportBtn.disabled = false;
        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }
        alert('Error exporting chart as SVG. See console for details.');
      }
    });
  }

  /**
   * Copy URL listener
   */
  _addCopyUrlListener() {
    const copyUrlBtn = document.getElementById('copy-url-btn');
    if (!copyUrlBtn) return;

    copyUrlBtn.addEventListener('click', async () => {
      const currentUrl = window.location.href;

      try {
        await navigator.clipboard.writeText(currentUrl);

        const originalText = copyUrlBtn.textContent;
        copyUrlBtn.textContent = '✓ URL Copied!';
        copyUrlBtn.style.backgroundColor = '#50AF7B';

        this.showNotification('Chart URL copied to clipboard! Share this link to give others access to this chart.', 'success');
        this.onAnnounce('Chart URL copied to clipboard');

        setTimeout(() => {
          copyUrlBtn.textContent = originalText;
          copyUrlBtn.style.backgroundColor = '';
        }, 2000);
      } catch (err) {
        alert(`Copy this URL to share:\n\n${currentUrl}`);
        this.showNotification('Could not copy URL automatically. Please copy it from the address bar.', 'error');
      }
    });
  }

  /**
   * Create loading overlay for export operations
   */
  _createExportLoadingOverlay(messageText = 'Generating high-resolution PNG...') {
    const overlay = document.createElement('div');
    overlay.className = 'export-loading-overlay';

    const spinner = document.createElement('div');
    spinner.className = 'export-spinner';

    const message = document.createElement('div');
    message.className = 'export-loading-message';
    message.textContent = messageText;

    overlay.appendChild(spinner);
    overlay.appendChild(message);

    return overlay;
  }

  /**
   * Show notification toast
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `chart-notification chart-notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? '#50AF7B' : type === 'error' ? '#DC3545' : '#1976D2'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      max-width: 400px;
      font-family: 'Work Sans', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
}
