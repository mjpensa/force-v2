import { CONFIG } from '../config.js';
import { findTodayColumnPosition, createButton } from '../Utils.js';

/**
 * GanttComponents - Handles UI components (header, title, logo, footer, legend)
 */
export class GanttComponents {
  constructor(chart) {
    this.chart = chart;
    this._titleResizeObserver = null;
    this._legendDblClickHandler = null;
  }

  /**
   * Add the header SVG stripe
   * Uses <img> element instead of CSS background-image for reliable html2canvas export
   */
  addHeaderSVG(chartWrapper, footerSVG) {
    if (!footerSVG) return;

    const encodedFooterSVG = encodeURIComponent(footerSVG.replace(/(\r\n|\n|\r)/gm, ''));

    const headerSvgEl = document.createElement('div');
    headerSvgEl.className = 'gantt-header-svg';

    const img = document.createElement('img');
    img.src = `data:image/svg+xml,${encodedFooterSVG}`;
    img.alt = '';
    img.style.height = '16px';
    img.style.width = '100%';
    img.style.display = 'block';
    img.style.objectFit = 'cover';

    headerSvgEl.appendChild(img);
    chartWrapper.appendChild(headerSvgEl);
  }

  /**
   * Add the chart title
   * @param {HTMLElement} chartWrapper - The wrapper element
   * @param {Object} ganttData - The gantt data
   * @param {HTMLElement} [headerMenu] - Optional header menu element
   * @returns {Object} { titleContainer, titleElement }
   */
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

    // Add header menu to the right side if provided
    if (headerMenu) {
      titleContainer.appendChild(headerMenu);
    }

    chartWrapper.appendChild(titleContainer);

    return { titleContainer, titleElement };
  }

  /**
   * Add the logo to the title container
   */
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

  /**
   * Add the footer SVG stripe
   * Uses <img> element instead of CSS background-image for reliable html2canvas export
   */
  addFooterSVG(chartWrapper, footerSVG) {
    if (!footerSVG) return;

    const encodedFooterSVG = encodeURIComponent(footerSVG.replace(/(\r\n|\n|\r)/gm, ''));

    const footerSvgEl = document.createElement('div');
    footerSvgEl.className = 'gantt-footer-svg';

    const img = document.createElement('img');
    img.src = `data:image/svg+xml,${encodedFooterSVG}`;
    img.alt = '';
    img.style.height = '16px';
    img.style.width = '100%';
    img.style.display = 'block';
    img.style.objectFit = 'cover';

    footerSvgEl.appendChild(img);
    chartWrapper.appendChild(footerSvgEl);
  }

  /**
   * Add the legend
   * @returns {HTMLElement|null} The legend element
   */
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

  /**
   * Setup delegated event listeners for legend
   */
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

  /**
   * Refresh the legend after color changes
   */
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

  /**
   * Update legend with colors used in the chart
   */
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

  /**
   * Format color key to readable name
   */
  _formatColorName(colorKey) {
    return colorKey
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Create the glassmorphic three-dot menu for the header
   * @returns {HTMLElement} The menu container
   */
  createHeaderMenu(isEditMode) {
    const menuContainer = document.createElement('div');
    menuContainer.className = 'gantt-header-menu';

    // Three-dot trigger button
    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'gantt-menu-trigger';
    triggerBtn.setAttribute('aria-label', 'Open chart menu');
    triggerBtn.setAttribute('aria-haspopup', 'true');
    triggerBtn.setAttribute('aria-expanded', 'false');
    triggerBtn.innerHTML = `
      <span class="menu-dot"></span>
      <span class="menu-dot"></span>
      <span class="menu-dot"></span>
    `;

    // Dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'gantt-menu-dropdown';
    dropdown.setAttribute('role', 'menu');

    // Edit Mode Toggle
    const editModeItem = this._createMenuItem({
      id: 'edit-mode-toggle-btn',
      icon: isEditMode ? '🔓' : '🔒',
      text: isEditMode ? 'Edit Mode: ON' : 'Edit Mode: OFF',
      className: `menu-item edit-mode-item ${isEditMode ? 'active' : ''}`,
      ariaLabel: 'Toggle edit mode to enable or disable chart customization'
    });
    dropdown.appendChild(editModeItem);

    // Divider
    dropdown.appendChild(this._createMenuDivider());

    // Export PNG
    const exportPngItem = this._createMenuItem({
      id: 'export-png-btn',
      icon: '📷',
      text: 'Export as PNG',
      className: 'menu-item',
      ariaLabel: 'Export Gantt chart as PNG image'
    });
    dropdown.appendChild(exportPngItem);

    // Export SVG
    const exportSvgItem = this._createMenuItem({
      id: 'export-svg-btn',
      icon: '🎨',
      text: 'Export as SVG',
      className: 'menu-item',
      ariaLabel: 'Export Gantt chart as SVG vector image'
    });
    dropdown.appendChild(exportSvgItem);

    // Divider
    dropdown.appendChild(this._createMenuDivider());

    // Copy URL
    const copyUrlItem = this._createMenuItem({
      id: 'copy-url-btn',
      icon: '🔗',
      text: 'Copy Share URL',
      className: 'menu-item',
      ariaLabel: 'Copy shareable URL to clipboard'
    });
    dropdown.appendChild(copyUrlItem);

    menuContainer.appendChild(triggerBtn);
    menuContainer.appendChild(dropdown);

    // Setup menu toggle behavior
    this._setupMenuBehavior(triggerBtn, dropdown);

    return menuContainer;
  }

  /**
   * Create a menu item element
   */
  _createMenuItem({ id, icon, text, className, ariaLabel }) {
    const item = document.createElement('button');
    item.id = id;
    item.className = className;
    item.setAttribute('role', 'menuitem');
    item.setAttribute('aria-label', ariaLabel);
    item.innerHTML = `
      <span class="menu-item-icon">${icon}</span>
      <span class="menu-item-text">${text}</span>
    `;
    return item;
  }

  /**
   * Create a menu divider
   */
  _createMenuDivider() {
    const divider = document.createElement('div');
    divider.className = 'menu-divider';
    divider.setAttribute('role', 'separator');
    return divider;
  }

  /**
   * Setup menu open/close behavior
   */
  _setupMenuBehavior(trigger, dropdown) {
    let isOpen = false;

    const openMenu = () => {
      isOpen = true;
      dropdown.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    };

    const closeMenu = () => {
      isOpen = false;
      dropdown.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (isOpen && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        closeMenu();
      }
    });

    // Close when pressing Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeMenu();
        trigger.focus();
      }
    });

    // Close menu when a menu item is clicked
    dropdown.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.menu-item');
      if (menuItem) {
        // Don't close for edit mode toggle (let it update visually first)
        if (menuItem.id !== 'edit-mode-toggle-btn') {
          closeMenu();
        }
      }
    });
  }

  /**
   * Update the edit mode toggle button state
   */
  updateEditModeToggle(isEditMode) {
    const editModeBtn = document.getElementById('edit-mode-toggle-btn');
    if (editModeBtn) {
      const icon = editModeBtn.querySelector('.menu-item-icon');
      const text = editModeBtn.querySelector('.menu-item-text');
      if (icon) icon.textContent = isEditMode ? '🔓' : '🔒';
      if (text) text.textContent = isEditMode ? 'Edit Mode: ON' : 'Edit Mode: OFF';
      editModeBtn.classList.toggle('active', isEditMode);
    }
  }

  /**
   * Add the today line to the chart
   */
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

  /**
   * Update sticky header position
   */
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

  /**
   * Apply sticky header position
   */
  _applyStickyHeaderPosition(titleContainer, chartWrapper, gridElement) {
    if (!titleContainer || !chartWrapper || !gridElement) return;

    const titleHeight = titleContainer.offsetHeight;
    chartWrapper.style.setProperty('--title-height', `${titleHeight}px`);

    const headerCells = gridElement.querySelectorAll('.gantt-header');
    headerCells.forEach(cell => {
      cell.style.top = `${titleHeight}px`;
    });
  }

  /**
   * Clean up observers and listeners
   */
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
