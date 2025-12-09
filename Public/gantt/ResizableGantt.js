import { InteractiveGanttHandler } from './InteractiveGanttHandler.js';

export class ResizableGantt extends InteractiveGanttHandler {
  constructor(gridElement, ganttData, onTaskResize) {
    super(gridElement, ganttData, onTaskResize);
  }

  enableResizing() {
    this.enable();
  }

  disableResizing() {
    this.disable();
  }

  _handleMouseDown(event) {
    const bar = event.target.closest('.gantt-bar');
    if (!bar) return;

    const { isLeftEdge, isRightEdge } = this.getMousePositionInBar(event, bar);

    if (isLeftEdge) {
      this._startResize(bar, 'left', event);
    } else if (isRightEdge) {
      this._startResize(bar, 'right', event);
    }
  }

  _startResize(bar, handle, event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const baseState = this.initializeState(bar, event);
    if (!baseState) return;

    this.state = {
      ...baseState,
      handle
    };

    bar.classList.add('resizing');
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('resizing');
  }

  _handleMouseMove(event) {
    if (!this.state) return;

    const columnDelta = this.calculateColumnDelta(event, this.state.barArea);
    let newStartCol = this.state.originalStartCol;
    let newEndCol = this.state.originalEndCol;

    if (this.state.handle === 'left') {
      newStartCol = this.state.originalStartCol + columnDelta;
      newStartCol = Math.max(1, newStartCol);
      newStartCol = Math.min(newStartCol, this.state.originalEndCol - 1);
    } else {
      newEndCol = this.state.originalEndCol + columnDelta;
      newEndCol = Math.min(this.ganttData.timeColumns.length + 1, newEndCol);
      newEndCol = Math.max(newEndCol, this.state.originalStartCol + 1);
    }

    this.state.bar.style.gridColumn = `${newStartCol} / ${newEndCol}`;
  }

  async _handleMouseUp(event) {
    if (!this.state) return;

    const { startCol: newStartCol, endCol: newEndCol } = this.parseGridColumn(this.state.bar.style.gridColumn);
    const hasChanged = newStartCol !== this.state.originalStartCol || newEndCol !== this.state.originalEndCol;

    if (hasChanged) {
      this.updateGanttData(newStartCol, newEndCol);

      if (this.callback) {
        try {
          await this.callback(this.buildTaskInfo(newStartCol, newEndCol, {
            resizeHandle: this.state.handle
          }));
        } catch (error) {
          this.rollback();
        }
      }
    }

    this.cleanup('resizing', 'resizing');
  }
}
