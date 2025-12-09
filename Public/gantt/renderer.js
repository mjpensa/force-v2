import { CONFIG } from '../config.js';

/**
 * GanttRenderer - Handles grid rendering, rows, bars, and virtualization
 */
export class GanttRenderer {
  constructor(chart) {
    this.chart = chart;
    this.virtualScroll = null;
    this.virtualScrollTimeout = null;
    this._gridClickHandler = null;
    this._gridDblClickHandler = null;
  }

  /**
   * Create the main grid structure
   * @param {HTMLElement} chartWrapper - Container for the grid
   * @param {Object} ganttData - Chart data
   * @returns {HTMLElement} The created grid element
   */
  createGrid(chartWrapper, ganttData) {
    const gridElement = document.createElement('div');
    gridElement.className = 'gantt-grid';
    gridElement.setAttribute('role', 'grid');
    gridElement.setAttribute('aria-label', 'Project timeline Gantt chart');
    gridElement.setAttribute('aria-readonly', 'true');

    const numCols = ganttData.timeColumns.length;
    gridElement.style.gridTemplateColumns = `max-content repeat(${numCols}, 1fr)`;

    this._createHeaderRow(gridElement, ganttData, numCols);
    this._createDataRows(gridElement, ganttData, numCols);

    chartWrapper.appendChild(gridElement);
    return gridElement;
  }

  /**
   * Create the header row with time columns
   */
  _createHeaderRow(gridElement, ganttData, numCols) {
    const headerFragment = document.createDocumentFragment();

    const headerLabel = document.createElement('div');
    headerLabel.className = 'gantt-header gantt-header-label';
    headerFragment.appendChild(headerLabel);

    for (const colName of ganttData.timeColumns) {
      const headerCell = document.createElement('div');
      headerCell.className = 'gantt-header';
      headerCell.textContent = colName;
      headerFragment.appendChild(headerCell);
    }

    gridElement.appendChild(headerFragment);
  }

  /**
   * Create data rows (standard or virtualized based on count)
   */
  _createDataRows(gridElement, ganttData, numCols) {
    const totalRows = ganttData.data.length;
    const VIRTUALIZATION_THRESHOLD = 100;

    if (totalRows > VIRTUALIZATION_THRESHOLD) {
      this._createVirtualizedRows(gridElement, ganttData, numCols);
      return;
    }

    const rowsFragment = document.createDocumentFragment();

    ganttData.data.forEach((row, dataIndex) => {
      const isSwimlane = row.isSwimlane;

      const labelEl = this._createRowLabel(row, dataIndex, isSwimlane);
      const barAreaEl = this._createBarArea(row, numCols, isSwimlane, dataIndex);

      if (!isSwimlane && row.bar && row.bar.startCol != null && this.chart.onTaskClick) {
        labelEl.setAttribute('data-clickable', 'true');
        barAreaEl.setAttribute('data-clickable', 'true');
        labelEl.style.cursor = 'pointer';
        barAreaEl.style.cursor = 'pointer';
      }

      if (!isSwimlane) {
        this._addHoverEffects(labelEl, barAreaEl);
      }

      rowsFragment.appendChild(labelEl);
      rowsFragment.appendChild(barAreaEl);
    });

    gridElement.appendChild(rowsFragment);
    this._setupGridDelegation(gridElement, ganttData);
  }

  /**
   * Create a row label element
   */
  _createRowLabel(row, dataIndex, isSwimlane) {
    const labelEl = document.createElement('div');
    labelEl.className = `gantt-row-label ${isSwimlane ? 'swimlane' : 'task'}`;

    const labelContent = document.createElement('span');
    labelContent.className = 'label-content';
    labelContent.textContent = row.title;
    labelEl.appendChild(labelContent);

    if (!isSwimlane) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'row-actions';

      const addBtn = document.createElement('button');
      addBtn.className = 'row-action-btn add-task';
      addBtn.title = 'Add task below';
      addBtn.textContent = '+';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'row-action-btn delete-task';
      deleteBtn.title = 'Delete this row';
      deleteBtn.textContent = '×';

      actionsDiv.appendChild(addBtn);
      actionsDiv.appendChild(deleteBtn);
      labelEl.appendChild(actionsDiv);
    }

    labelEl.setAttribute('data-row-id', `row-${dataIndex}`);
    labelEl.setAttribute('data-task-index', dataIndex);

    return labelEl;
  }

  /**
   * Create the bar area for a row
   */
  _createBarArea(row, numCols, isSwimlane, dataIndex) {
    const barAreaEl = document.createElement('div');
    barAreaEl.className = `gantt-bar-area ${isSwimlane ? 'swimlane' : 'task'}`;
    barAreaEl.style.gridColumn = `2 / span ${numCols}`;
    barAreaEl.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
    barAreaEl.style.position = 'relative';
    barAreaEl.style.display = 'grid';
    barAreaEl.setAttribute('data-row-id', `row-${dataIndex}`);
    barAreaEl.setAttribute('data-task-index', dataIndex);

    const cellsFragment = document.createDocumentFragment();
    for (let colIndex = 1; colIndex <= numCols; colIndex++) {
      const cellEl = document.createElement('div');
      cellEl.className = 'gantt-time-cell';
      cellEl.style.gridColumn = colIndex;
      cellEl.style.borderLeft = colIndex > 1 ? `1px solid ${CONFIG.COLORS.GRID_BORDER}` : 'none';
      cellEl.style.borderBottom = `1px solid ${CONFIG.COLORS.GRID_BORDER}`;
      cellEl.style.height = '100%';
      cellsFragment.appendChild(cellEl);
    }
    barAreaEl.appendChild(cellsFragment);

    if (!isSwimlane && row.bar && row.bar.startCol != null) {
      const bar = row.bar;
      const barEl = document.createElement('div');
      barEl.className = 'gantt-bar';
      barEl.setAttribute('data-color', bar.color || 'default');
      barEl.style.gridColumn = `${bar.startCol} / ${bar.endCol}`;
      barAreaEl.appendChild(barEl);
    }

    return barAreaEl;
  }

  /**
   * Setup delegated event listeners for the grid
   */
  _setupGridDelegation(gridElement, ganttData) {
    if (this._gridClickHandler) {
      gridElement.removeEventListener('click', this._gridClickHandler);
    }
    if (this._gridDblClickHandler) {
      gridElement.removeEventListener('dblclick', this._gridDblClickHandler);
    }

    this._gridClickHandler = (e) => {
      const target = e.target;

      // Handle add task button
      const addBtn = target.closest('.row-action-btn.add-task');
      if (addBtn) {
        e.stopPropagation();
        const taskIndex = parseInt(addBtn.closest('[data-task-index]').getAttribute('data-task-index'));
        if (this.chart.editor) this.chart.editor.addNewTaskRow(taskIndex);
        return;
      }

      // Handle delete task button
      const deleteBtn = target.closest('.row-action-btn.delete-task');
      if (deleteBtn) {
        e.stopPropagation();
        const taskIndex = parseInt(deleteBtn.closest('[data-task-index]').getAttribute('data-task-index'));
        if (this.chart.editor) this.chart.editor.removeTaskRow(taskIndex);
        return;
      }

      // Handle task row/bar click for analysis
      if (this.chart.onTaskClick && !this.chart.isEditMode) {
        const clickableEl = target.closest('[data-clickable="true"]');
        if (clickableEl) {
          const taskIndex = parseInt(clickableEl.getAttribute('data-task-index'));
          const row = ganttData.data[taskIndex];
          if (row && !row.isSwimlane) {
            this.chart.onTaskClick({
              taskName: row.title,
              entity: row.entity,
              sessionId: ganttData.sessionId
            });
          }
        }
      }
    };

    this._gridDblClickHandler = (e) => {
      if (!this.chart.isEditMode || !this.chart.editor) return;

      const labelContent = e.target.closest('.label-content');
      if (labelContent) {
        e.stopPropagation();
        const taskIndex = parseInt(labelContent.closest('[data-task-index]').getAttribute('data-task-index'));
        this.chart.editor.makeEditable(labelContent, taskIndex);
      }
    };

    gridElement.addEventListener('click', this._gridClickHandler);
    gridElement.addEventListener('dblclick', this._gridDblClickHandler);
  }

  /**
   * Add hover effects between label and bar area
   */
  _addHoverEffects(labelEl, barAreaEl) {
    labelEl.addEventListener('mouseenter', () => {
      barAreaEl.classList.add('row-hover');
    });
    labelEl.addEventListener('mouseleave', () => {
      barAreaEl.classList.remove('row-hover');
    });
    barAreaEl.addEventListener('mouseenter', () => {
      barAreaEl.classList.add('row-hover');
    });
    barAreaEl.addEventListener('mouseleave', () => {
      barAreaEl.classList.remove('row-hover');
    });
  }

  /**
   * Create virtualized rows for large datasets
   */
  _createVirtualizedRows(gridElement, ganttData, numCols) {
    const ROW_HEIGHT = 18;
    const BUFFER_ROWS = 20;

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'gantt-virtualized-container';
    scrollContainer.style.height = `${ganttData.data.length * ROW_HEIGHT}px`;
    scrollContainer.style.position = 'relative';
    scrollContainer.style.overflow = 'auto';
    scrollContainer.style.maxHeight = '600px';

    const viewport = document.createElement('div');
    viewport.className = 'gantt-virtualized-viewport';
    viewport.style.position = 'absolute';
    viewport.style.top = '0';
    viewport.style.left = '0';
    viewport.style.right = '0';

    this.virtualScroll = {
      container: scrollContainer,
      viewport: viewport,
      rowHeight: ROW_HEIGHT,
      bufferRows: BUFFER_ROWS,
      numCols: numCols,
      visibleStart: 0,
      visibleEnd: Math.min(50, ganttData.data.length),
      gridElement: gridElement,
      ganttData: ganttData
    };

    this._renderVisibleRows();

    scrollContainer.addEventListener('scroll', () => {
      this._handleVirtualScroll();
    });

    scrollContainer.appendChild(viewport);
    gridElement.appendChild(scrollContainer);
  }

  /**
   * Render visible rows for virtualization
   */
  _renderVisibleRows() {
    if (!this.virtualScroll) return;

    const { viewport, visibleStart, visibleEnd, rowHeight, numCols, gridElement, ganttData } = this.virtualScroll;

    viewport.innerHTML = '';
    const rowsFragment = document.createDocumentFragment();

    for (let dataIndex = visibleStart; dataIndex < visibleEnd; dataIndex++) {
      const row = ganttData.data[dataIndex];
      if (!row) continue;

      const isSwimlane = row.isSwimlane;

      const rowContainer = document.createElement('div');
      rowContainer.className = 'gantt-virtual-row';
      rowContainer.style.position = 'absolute';
      rowContainer.style.top = `${dataIndex * rowHeight}px`;
      rowContainer.style.left = '0';
      rowContainer.style.right = '0';
      rowContainer.style.height = `${rowHeight}px`;
      rowContainer.style.display = 'grid';
      rowContainer.style.gridTemplateColumns = gridElement.style.gridTemplateColumns;

      const labelEl = this._createRowLabel(row, dataIndex, isSwimlane);
      const barAreaEl = this._createBarArea(row, numCols, isSwimlane, dataIndex);

      rowContainer.appendChild(labelEl);
      rowContainer.appendChild(barAreaEl);
      rowsFragment.appendChild(rowContainer);
    }

    viewport.appendChild(rowsFragment);
  }

  /**
   * Handle virtual scroll updates
   */
  _handleVirtualScroll() {
    if (!this.virtualScroll) return;

    const { container, rowHeight, bufferRows, ganttData } = this.virtualScroll;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    const newVisibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
    const newVisibleEnd = Math.min(
      ganttData.data.length,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + bufferRows
    );

    if (newVisibleStart !== this.virtualScroll.visibleStart ||
        newVisibleEnd !== this.virtualScroll.visibleEnd) {
      this.virtualScroll.visibleStart = newVisibleStart;
      this.virtualScroll.visibleEnd = newVisibleEnd;

      if (this.virtualScrollTimeout) {
        clearTimeout(this.virtualScrollTimeout);
      }
      this.virtualScrollTimeout = setTimeout(() => {
        this._renderVisibleRows();
      }, 50);
    }
  }

  /**
   * Clean up event listeners
   */
  cleanup(gridElement) {
    if (this._gridClickHandler && gridElement) {
      gridElement.removeEventListener('click', this._gridClickHandler);
      this._gridClickHandler = null;
    }
    if (this._gridDblClickHandler && gridElement) {
      gridElement.removeEventListener('dblclick', this._gridDblClickHandler);
      this._gridDblClickHandler = null;
    }
    if (this.virtualScrollTimeout) {
      clearTimeout(this.virtualScrollTimeout);
      this.virtualScrollTimeout = null;
    }
    this.virtualScroll = null;
  }
}
