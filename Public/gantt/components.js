import { CONFIG } from '../config.js';
import { findTodayColumnPosition } from '../utils/date.js';
import { createDropdownMenu } from '../utils/dom.js';

export class GanttComponents {
  constructor(chart) {
    this.chart = chart;
    this._titleResizeObserver = null;
    this._legendDblClickHandler = null;
  }

  addHeaderSVG(chartWrapper, svgMarkup) {
    this._addSVGBand(chartWrapper, svgMarkup, 'gantt-header-svg');
  }

  addTitle(chartWrapper, ganttData, headerMenu = null) {
    const titleContainer = document.createElement('div');
    titleContainer.className = 'gantt-title-container';
    titleContainer.style.display = 'flex';
    titleContainer.style.justifyContent = 'space-between';
    titleContainer.style.alignItems = 'center';
    titleContainer.style.gap = '10px';
    titleContainer.style.padding = '8px';
    titleContainer.style.borderBottom = '1px solid #0D0D0D';
    titleContainer.style.backgroundColor = '#0c2340';
    titleContainer.style.borderRadius = '8px 8px 0 0';

    const titleElement = document.createElement('div');
    titleElement.className = 'gantt-title';
    titleElement.textContent = ganttData.title;
    titleElement.style.flex = '1';
    titleElement.style.padding = '0';
    titleElement.style.border = 'none';
    titleElement.style.background = 'none';
    titleElement.style.borderRadius = '0';

    titleElement.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.chart.isEditMode && this.chart.editor) {
        this.chart.editor.makeChartTitleEditable();
      }
    });

    titleContainer.appendChild(titleElement);
    if (headerMenu) {
      titleContainer.appendChild(headerMenu);
    }

    chartWrapper.appendChild(titleContainer);

    return { titleContainer, titleElement };
  }

  addLogo(titleContainer, titleElement) {
    const logoImg = document.createElement('img');
    logoImg.src = '/bip_logo.png';
    logoImg.alt = 'BIP Logo';
    logoImg.className = 'gantt-logo';
    logoImg.style.height = `${CONFIG.SIZES.LOGO_HEIGHT}px`;
    logoImg.style.width = 'auto';
    logoImg.style.flexShrink = '0';

    if (titleContainer && titleElement) {
      titleContainer.insertBefore(logoImg, titleElement);
    }
  }

  addFooterSVG(chartWrapper, svgMarkup) {
    this._addSVGBand(chartWrapper, svgMarkup, 'gantt-footer-svg');
  }

  _addSVGBand(chartWrapper, svgMarkup, className) {
    if (!svgMarkup) return;
    const encoded = encodeURIComponent(svgMarkup.replace(/(\r\n|\n|\r)/gm, ''));
    const el = document.createElement('div');
    el.className = className;
    el.dataset.svgSrc = `data:image/svg+xml,${encoded}`;
    chartWrapper.appendChild(el);
  }

  addLegend(chartWrapper, ganttData) {
    if (!ganttData.legend) {
      ganttData.legend = [];
    }

    this._updateLegendWithUsedColors(ganttData);

    if (ganttData.legend.length === 0) return null;

    const legendElement = document.createElement('div');
    legendElement.className = 'gantt-legend';

    const legendLine = document.createElement('div');
    legendLine.className = 'legend-line';

    const title = document.createElement('span');
    title.className = 'legend-title';
    title.textContent = 'Legend:';
    legendLine.appendChild(title);

    const list = document.createElement('div');
    list.className = 'legend-list';

    ganttData.legend.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'legend-item';
      itemEl.setAttribute('data-legend-index', index);

      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color-box';
      colorBox.setAttribute('data-color', item.color);

      const labelWrapper = document.createElement('span');
      labelWrapper.className = 'legend-label-wrapper';

      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = item.label;
      labelWrapper.appendChild(label);

      itemEl.appendChild(colorBox);
      itemEl.appendChild(labelWrapper);
      list.appendChild(itemEl);
    });

    legendLine.appendChild(list);
    legendElement.appendChild(legendLine);
    chartWrapper.appendChild(legendElement);

    this._setupLegendDelegation(legendElement);

    return legendElement;
  }

  _setupLegendDelegation(legendElement) {
    if (!legendElement) return;

    if (this._legendDblClickHandler) {
      legendElement.removeEventListener('dblclick', this._legendDblClickHandler);
    }

    this._legendDblClickHandler = (e) => {
      const label = e.target.closest('.legend-label');
      if (!label) return;

      e.stopPropagation();
      if (this.chart.isEditMode && this.chart.editor) {
        const legendItem = label.closest('.legend-item');
        const index = parseInt(legendItem.getAttribute('data-legend-index'));
        this.chart.editor.makeLegendLabelEditable(label, index);
      }
    };

    legendElement.addEventListener('dblclick', this._legendDblClickHandler);
  }

  refreshLegend(ganttData, legendElement) {
    if (!legendElement) return null;

    const originalLength = ganttData.legend.length;
    this._updateLegendWithUsedColors(ganttData);

    if (ganttData.legend.length > originalLength) {
      const wasEditMode = this.chart.isEditMode;
      const parent = legendElement.parentElement;

      legendElement.remove();

      const newLegend = this.addLegend(parent, ganttData);

      if (wasEditMode && newLegend) {
        newLegend.classList.add('edit-mode-enabled');
      }

      return newLegend;
    }

    return legendElement;
  }

  _updateLegendWithUsedColors(ganttData) {
    const usedColors = new Set();

    ganttData.data.forEach(row => {
      if (row.bar && row.bar.color) {
        usedColors.add(row.bar.color);
      }
    });

    const legendColors = new Set(ganttData.legend.map(item => item.color));

    usedColors.forEach(color => {
      if (!legendColors.has(color)) {
        ganttData.legend.push({
          color: color,
          label: `[Define ${this._formatColorName(color)}]`
        });
      }
    });
  }

  _formatColorName(colorKey) {
    return colorKey
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  createHeaderMenu(isEditMode) {
    const { container } = createDropdownMenu({
      containerClass: 'gantt-header-menu',
      triggerLabel: 'Open chart menu',
      minWidth: 200,
      items: [
        { id: 'edit-mode-toggle-btn', icon: isEditMode ? '\uD83D\uDD13' : '\uD83D\uDD12',
          text: isEditMode ? 'Edit Mode: ON' : 'Edit Mode: OFF',
          className: `menu-item edit-mode-item ${isEditMode ? 'active' : ''}`,
          ariaLabel: 'Toggle edit mode', keepOpen: true },
        'divider',
        { id: 'export-png-btn', icon: '\uD83D\uDCF7', text: 'Export as PNG', ariaLabel: 'Export as PNG image' },
        { id: 'export-svg-btn', icon: '\uD83C\uDFA8', text: 'Export as SVG', ariaLabel: 'Export as SVG' },
        'divider',
        { id: 'copy-url-btn', icon: '\uD83D\uDD17', text: 'Copy Share URL', ariaLabel: 'Copy shareable URL' },
      ]
    });
    return container;
  }

  addTodayLine(gridElement, ganttData, today) {
    if (!gridElement) return;

    const position = findTodayColumnPosition(today, ganttData.timeColumns);
    if (!position) return;

    try {
      const labelCol = gridElement.querySelector('.gantt-header-label');
      const headerRow = gridElement.querySelector('.gantt-header');
      if (!labelCol || !headerRow) return;

      const gridRect = gridElement.getBoundingClientRect();
      const containerRect = gridElement.parentElement.getBoundingClientRect();
      const headerHeight = headerRow.offsetHeight;
      const gridClientWidth = gridElement.clientWidth;
      const labelColWidth = labelCol.offsetWidth;
      const timeColAreaWidth = gridClientWidth - labelColWidth;
      const oneColWidth = timeColAreaWidth / ganttData.timeColumns.length;
      const todayOffset = (position.index + position.percentage) * oneColWidth;
      const lineLeftPosition = labelColWidth + todayOffset;

      const todayLine = document.createElement('div');
      todayLine.className = 'gantt-today-line';
      todayLine.style.top = `${headerHeight}px`;
      todayLine.style.bottom = '0';
      todayLine.style.left = `${lineLeftPosition}px`;

      gridElement.appendChild(todayLine);
    } catch (e) {
      // Silently fail if positioning fails
    }
  }

  updateStickyHeaderPosition(titleContainer, chartWrapper, gridElement) {
    if (!titleContainer || !chartWrapper) return;

    requestAnimationFrame(() => {
      this._applyStickyHeaderPosition(titleContainer, chartWrapper, gridElement);

      if (window.ResizeObserver && !this._titleResizeObserver) {
        let resizeTimeout;
        this._titleResizeObserver = new ResizeObserver(() => {
          if (resizeTimeout) clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            this._applyStickyHeaderPosition(titleContainer, chartWrapper, gridElement);
          }, 16);
        });
        this._titleResizeObserver.observe(titleContainer);
      }
    });
  }

  _applyStickyHeaderPosition(titleContainer, chartWrapper, gridElement) {
    if (!titleContainer || !chartWrapper || !gridElement) return;

    const titleHeight = titleContainer.offsetHeight;
    chartWrapper.style.setProperty('--title-height', `${titleHeight}px`);

    const headerCells = gridElement.querySelectorAll('.gantt-header');
    headerCells.forEach(cell => {
      cell.style.top = `${titleHeight}px`;
    });
  }

  cleanup(legendElement) {
    if (this._titleResizeObserver) {
      this._titleResizeObserver.disconnect();
      this._titleResizeObserver = null;
    }

    if (this._legendDblClickHandler && legendElement) {
      legendElement.removeEventListener('dblclick', this._legendDblClickHandler);
      this._legendDblClickHandler = null;
    }
  }
}
