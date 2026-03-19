
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

  enable() {
    this.gridElement.addEventListener('mousedown', this._handleMouseDown);
    document.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);
  }

  disable() {
    this.gridElement.removeEventListener('mousedown', this._handleMouseDown);
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);
  }

  parseGridColumn(gridColumnStyle) {
    const [startCol, endCol] = gridColumnStyle.split('/').map(v => parseInt(v.trim()));
    return {
      startCol: isNaN(startCol) ? 1 : startCol,
      endCol: isNaN(endCol) ? startCol + 1 : endCol
    };
  }

  calculateColumnDelta(event, barArea) {
    const deltaX = event.clientX - this.state.startX;
    const rect = barArea.getBoundingClientRect();
    const columnWidth = rect.width / this.ganttData.timeColumns.length;
    return Math.round(deltaX / columnWidth);
  }

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

  rollback() {
    this.state.bar.style.gridColumn = this.state.originalGridColumn;
    this.ganttData.data[this.state.taskIndex].bar.startCol = this.state.originalStartCol;
    this.ganttData.data[this.state.taskIndex].bar.endCol = this.state.originalEndCol;
  }

  updateGanttData(newStartCol, newEndCol) {
    this.ganttData.data[this.state.taskIndex].bar.startCol = newStartCol;
    this.ganttData.data[this.state.taskIndex].bar.endCol = newEndCol;
  }

  cleanup(className, bodyClassName) {
    if (this.state?.bar) {
      this.state.bar.classList.remove(className);
    }
    document.body.style.cursor = '';
    document.body.classList.remove(bodyClassName);
    this.state = null;
  }

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
