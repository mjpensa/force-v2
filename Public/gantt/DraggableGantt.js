import { CONFIG } from '../config.js';
import { InteractiveGanttHandler } from './InteractiveGanttHandler.js';

export class DraggableGantt extends InteractiveGanttHandler {
  constructor(gridElement, ganttData, onTaskUpdate) {
    super(gridElement, ganttData, onTaskUpdate);
    this.dragIndicator = null;
  }

  enableDragging() {
    this.enable();
  }

  disableDragging() {
    this.disable();
  }

  _handleMouseDown(event) {
    const bar = event.target.closest('.gantt-bar');
    if (!bar) return;

    const { isLeftEdge, isRightEdge } = this.getMousePositionInBar(event, bar);
    if (isLeftEdge || isRightEdge) {
      return; // Let resize handler handle edge interactions
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const baseState = this.initializeState(bar, event);
    if (!baseState) return;

    this.state = {
      ...baseState,
      duration: baseState.originalEndCol - baseState.originalStartCol
    };

    bar.classList.add('dragging');
    bar.style.opacity = '0.5';
    document.body.style.cursor = 'move';
    document.body.classList.add('dragging');
    this._createDragIndicator();
  }

  _handleMouseMove(event) {
    if (!this.state) return;

    const columnDelta = this.calculateColumnDelta(event, this.state.barArea);
    let newStartCol = this.state.originalStartCol + columnDelta;
    let newEndCol = newStartCol + this.state.duration;

    // Constrain to grid bounds
    const numCols = this.ganttData.timeColumns.length;
    newStartCol = Math.max(1, Math.min(newStartCol, numCols - this.state.duration + 1));
    newEndCol = newStartCol + this.state.duration;

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
          await this.callback(this.buildTaskInfo(newStartCol, newEndCol));
        } catch (error) {
          this.rollback();
        }
      }
    }

    this.state.bar.style.opacity = '1';
    this._removeDragIndicator();
    this.cleanup('dragging', 'dragging');
  }

  _createDragIndicator() {
    this.dragIndicator = document.createElement('div');
    this.dragIndicator.className = 'drag-indicator';
    this.dragIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${CONFIG.COLORS.PRIMARY || '#BA3930'};
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    this.dragIndicator.textContent = '↔ Drag to reschedule task';
    document.body.appendChild(this.dragIndicator);
  }

  _removeDragIndicator() {
    if (this.dragIndicator?.parentNode) {
      this.dragIndicator.parentNode.removeChild(this.dragIndicator);
      this.dragIndicator = null;
    }
  }
}
