import { CONFIG } from '../config.js';

export class GanttExporter {
  constructor(chartContainer, callbacks = {}) {
    this.chartContainer = chartContainer;
    this.onAnnounce = callbacks.onAnnounce || (() => {});
  }

  _calculateAspectRatioDimensions(sourceWidth, sourceHeight) {
    const { width: ratioW, height: ratioH } = CONFIG.EXPORT.ASPECT_RATIO;
    const targetRatio = ratioW / ratioH; // 9:16 = 0.5625
    const sourceRatio = sourceWidth / sourceHeight;

    let targetWidth, targetHeight, offsetX, offsetY;

    if (sourceRatio > targetRatio) {
      // Source is wider than target ratio - fit to width, add vertical padding
      targetWidth = sourceWidth;
      targetHeight = sourceWidth / targetRatio;
      offsetX = 0;
      offsetY = (targetHeight - sourceHeight) / 2;
    } else {
      // Source is taller than target ratio - fit to height, add horizontal padding
      targetHeight = sourceHeight;
      targetWidth = sourceHeight * targetRatio;
      offsetX = (targetWidth - sourceWidth) / 2;
      offsetY = 0;
    }

    return {
      targetWidth: Math.ceil(targetWidth),
      targetHeight: Math.ceil(targetHeight),
      offsetX: Math.ceil(offsetX),
      offsetY: Math.ceil(offsetY),
      sourceWidth,
      sourceHeight
    };
  }

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

  async _captureChart() {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const originalScrollTop = this.chartContainer.scrollTop;
    const originalScrollLeft = this.chartContainer.scrollLeft;
    const originalMaxHeight = this.chartContainer.style.maxHeight;
    const originalOverflow = this.chartContainer.style.overflow;
    const originalOverflowX = this.chartContainer.style.overflowX;
    const originalOverflowY = this.chartContainer.style.overflowY;

    this.chartContainer.scrollTop = 0;
    this.chartContainer.scrollLeft = 0;
    this.chartContainer.style.maxHeight = 'none';
    this.chartContainer.style.overflow = 'visible';
    this.chartContainer.style.overflowX = 'visible';
    this.chartContainer.style.overflowY = 'visible';

    await new Promise(resolve => requestAnimationFrame(resolve));
    const fullWidth = this.chartContainer.scrollWidth;
    const fullHeight = this.chartContainer.scrollHeight;

    const sourceCanvas = await html2canvas(this.chartContainer, {
      useCORS: true, logging: false, scale: CONFIG.EXPORT.SCALE,
      allowTaint: false, backgroundColor: CONFIG.EXPORT.BACKGROUND_COLOR,
      width: fullWidth, height: fullHeight,
      windowWidth: fullWidth, windowHeight: fullHeight,
      x: 0, y: 0, scrollX: 0, scrollY: 0
    });

    this.chartContainer.style.maxHeight = originalMaxHeight;
    this.chartContainer.style.overflow = originalOverflow;
    this.chartContainer.style.overflowX = originalOverflowX;
    this.chartContainer.style.overflowY = originalOverflowY;
    this.chartContainer.scrollTop = originalScrollTop;
    this.chartContainer.scrollLeft = originalScrollLeft;

    return this._createAspectRatioCanvas(sourceCanvas);
  }

  initializeListeners() {
    this._addExportListener('export-png-btn', 'png');
    this._addExportListener('export-svg-btn', 'svg');
    this._addCopyUrlListener();
  }

  _addExportListener(buttonId, format) {
    const exportBtn = document.getElementById(buttonId);
    if (!exportBtn || !this.chartContainer) return;

    const label = `Export as ${format.toUpperCase()}`;
    const loadingMessage = format === 'svg'
      ? 'Generating vector SVG...'
      : 'Generating high-resolution PNG...';

    exportBtn.addEventListener('click', async () => {
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;

      const loadingOverlay = this._createExportLoadingOverlay(loadingMessage);
      document.body.appendChild(loadingOverlay);

      try {
        const aspectRatioCanvas = await this._captureChart();

        let href;
        let revokeUrl = null;

        if (format === 'svg') {
          const imageData = aspectRatioCanvas.toDataURL('image/png');
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
          href = URL.createObjectURL(blob);
          revokeUrl = href;
        } else {
          href = aspectRatioCanvas.toDataURL('image/png');
        }

        const link = document.createElement('a');
        link.download = `gantt-chart.${format}`;
        link.href = href;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (revokeUrl) {
          URL.revokeObjectURL(revokeUrl);
        }

        exportBtn.textContent = label;
        exportBtn.disabled = false;
        document.body.removeChild(loadingOverlay);
      } catch (err) {
        exportBtn.textContent = label;
        exportBtn.disabled = false;
        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }
        alert(`Error exporting chart as ${format.toUpperCase()}. See console for details.`);
      }
    });
  }

  _addCopyUrlListener() {
    const copyUrlBtn = document.getElementById('copy-url-btn');
    if (!copyUrlBtn) return;

    copyUrlBtn.addEventListener('click', async () => {
      const currentUrl = window.location.href;

      try {
        await navigator.clipboard.writeText(currentUrl);

        const originalText = copyUrlBtn.textContent;
        copyUrlBtn.textContent = '✓ URL Copied!';
        copyUrlBtn.style.backgroundColor = 'var(--color-glass-success, #50AF7B)';

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

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `chart-notification chart-notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');

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
