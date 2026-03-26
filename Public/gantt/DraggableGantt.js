import { CONFIG } from '../config.js';
import { InteractiveGanttHandler } from './InteractiveGanttHandler.js';

export class DraggableGantt extends InteractiveGanttHandler {
  constructor(gridElement, ganttData, onTaskUpdate) {
    super(gridElement, ganttData, onTaskUpdate);
    this.dragIndicator = null;
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
    await this._finishInteraction('dragging', 'dragging');
  }

  _cleanupSubclass() {
    if (this.state?.bar) {
      this.state.bar.style.opacity = '1';
    }
    this._removeDragIndicator();
  }

  _createDragIndicator() {
    this.dragIndicator = document.createElement('div');
    this.dragIndicator.className = 'drag-indicator';
    this.dragIndicator.style.background = CONFIG.COLORS.PRIMARY || '#BA3930';
    this.dragIndicator.textContent = '\u2194 Drag to reschedule task';
    document.body.appendChild(this.dragIndicator);
  }

  _removeDragIndicator() {
    if (this.dragIndicator?.parentNode) {
      this.dragIndicator.parentNode.removeChild(this.dragIndicator);
      this.dragIndicator = null;
    }
  }
}
