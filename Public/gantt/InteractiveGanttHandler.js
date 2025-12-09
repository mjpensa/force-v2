
/**
 * Base class for Gantt chart interaction handlers (drag, resize)
 * Provides shared functionality for mouse event handling and column calculations
 */
export class InteractiveGanttHandler {
  constructor(gridElement, ganttData, callback) {
    this.gridElement = gridElement;
    this.ganttData = ganttData;
    this.callback = callback;
    this.state = null;

    this._handleMouseDown = this._handleMouseDown.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleMouseUp = this._handleMouseUp.bind(this);
  }

  /**
   * Enable interaction by attaching event listeners
   */
  enable() {
    this.gridElement.addEventListener('mousedown', this._handleMouseDown);
    document.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);
  }

  /**
   * Disable interaction by removing event listeners
   */
  disable() {
    this.gridElement.removeEventListener('mousedown', this._handleMouseDown);
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);
  }

  /**
   * Parse grid column style into start and end column numbers
   * @param {string} gridColumnStyle - CSS grid-column value (e.g., "2 / 5")
   * @returns {{startCol: number, endCol: number}}
   */
  parseGridColumn(gridColumnStyle) {
    const [startCol, endCol] = gridColumnStyle.split('/').map(v => parseInt(v.trim()));
    return { startCol, endCol };
  }

  /**
   * Calculate column delta from mouse movement
   * @param {MouseEvent} event - Mouse event
   * @param {HTMLElement} barArea - The bar area element
   * @returns {number} - Number of columns moved
   */
  calculateColumnDelta(event, barArea) {
    const deltaX = event.clientX - this.state.startX;
    const rect = barArea.getBoundingClientRect();
    const columnWidth = rect.width / this.ganttData.timeColumns.length;
    return Math.round(deltaX / columnWidth);
  }

  /**
   * Get mouse position within bar element
   * @param {MouseEvent} event
   * @param {HTMLElement} bar
   * @returns {{x: number, isLeftEdge: boolean, isRightEdge: boolean}}
   */
  getMousePositionInBar(event, bar) {
    const rect = bar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const HANDLE_WIDTH = 10;
    return {
      x,
      isLeftEdge: x <= HANDLE_WIDTH,
      isRightEdge: x >= rect.width - HANDLE_WIDTH
    };
  }

  /**
   * Initialize state for an interaction
   * @param {HTMLElement} bar - The gantt bar element
   * @param {MouseEvent} event - The mouse event
   * @returns {Object|null} - Base state object or null if invalid
   */
  initializeState(bar, event) {
    const barArea = bar.closest('.gantt-bar-area');
    const taskIndex = parseInt(barArea.getAttribute('data-task-index'));
    const rowId = barArea.getAttribute('data-row-id');

    if (taskIndex === -1 || isNaN(taskIndex)) {
      return null;
    }

    const gridColumnStyle = bar.style.gridColumn;
    const { startCol, endCol } = this.parseGridColumn(gridColumnStyle);

    return {
      bar,
      barArea,
      taskIndex,
      rowId,
      startX: event.clientX,
      originalStartCol: startCol,
      originalEndCol: endCol,
      originalGridColumn: gridColumnStyle,
      taskData: this.ganttData.data[taskIndex]
    };
  }

  /**
   * Build task info object for callback
   * @param {number} newStartCol
   * @param {number} newEndCol
   * @param {Object} [extra] - Additional properties
   * @returns {Object}
   */
  buildTaskInfo(newStartCol, newEndCol, extra = {}) {
    return {
      taskName: this.state.taskData.title,
      entity: this.state.taskData.entity,
      sessionId: this.ganttData.sessionId,
      taskIndex: this.state.taskIndex,
      oldStartCol: this.state.originalStartCol,
      oldEndCol: this.state.originalEndCol,
      newStartCol,
      newEndCol,
      startDate: this.ganttData.timeColumns[newStartCol - 1],
      endDate: this.ganttData.timeColumns[newEndCol - 2],
      ...extra
    };
  }

  /**
   * Rollback changes on error
   */
  rollback() {
    this.state.bar.style.gridColumn = this.state.originalGridColumn;
    this.ganttData.data[this.state.taskIndex].bar.startCol = this.state.originalStartCol;
    this.ganttData.data[this.state.taskIndex].bar.endCol = this.state.originalEndCol;
  }

  /**
   * Update gantt data with new column values
   * @param {number} newStartCol
   * @param {number} newEndCol
   */
  updateGanttData(newStartCol, newEndCol) {
    this.ganttData.data[this.state.taskIndex].bar.startCol = newStartCol;
    this.ganttData.data[this.state.taskIndex].bar.endCol = newEndCol;
  }

  /**
   * Clean up after interaction ends
   * @param {string} className - Class to remove from bar
   * @param {string} bodyClassName - Class to remove from body
   */
  cleanup(className, bodyClassName) {
    if (this.state?.bar) {
      this.state.bar.classList.remove(className);
    }
    document.body.style.cursor = '';
    document.body.classList.remove(bodyClassName);
    this.state = null;
  }

  // Abstract methods to be implemented by subclasses
  _handleMouseDown(event) {
    throw new Error('_handleMouseDown must be implemented by subclass');
  }

  _handleMouseMove(event) {
    throw new Error('_handleMouseMove must be implemented by subclass');
  }

  _handleMouseUp(event) {
    throw new Error('_handleMouseUp must be implemented by subclass');
  }
}
