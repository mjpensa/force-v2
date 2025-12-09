import { PerformanceTimer, fetchJSON } from './Utils.js';
import {
  DraggableGantt,
  ResizableGantt,
  ContextMenu,
  GanttExporter,
  GanttEditor,
  GanttRenderer,
  GanttComponents,
  GanttAnalysis
} from './gantt/index.js';

/**
 * GanttChart - Main orchestrator for the Gantt chart visualization
 *
 * Coordinates rendering, UI components, and user interactions through
 * specialized modules:
 * - GanttRenderer: Grid, rows, bars, virtualization
 * - GanttComponents: Header, title, logo, footer, legend
 * - GanttAnalysis: Research analysis display
 */
export class GanttChart {
  constructor(container, ganttData, footerSVG, onTaskClick) {
    this.container = container;
    this.ganttData = ganttData;
    this.footerSVG = footerSVG;
    this.onTaskClick = onTaskClick;

    // DOM references
    this.chartWrapper = null;
    this.gridElement = null;
    this.titleElement = null;
    this.titleContainer = null;
    this.legendElement = null;

    // Module instances
    this.renderer = new GanttRenderer(this);
    this.components = new GanttComponents(this);
    this.analysis = new GanttAnalysis();

    // Interaction handlers
    this.draggableGantt = null;
    this.resizableGantt = null;
    this.contextMenu = null;
    this.exporter = null;
    this.editor = null;

    // Event handler references for cleanup
    this._keyboardHandler = null;
    this._cursorFeedbackHandler = null;
    this._lastGridElement = null;
  }

  get isEditMode() {
    return this.editor ? this.editor.isEditMode : false;
  }

  /**
   * Render the complete Gantt chart
   */
  render() {
    const renderTimer = new PerformanceTimer('Gantt Chart Render');

    if (!this.container) {
      return;
    }

    this._sortTasksWithinSwimlanes();
    this._cleanupBeforeRender();

    this.container.innerHTML = '';
    this.chartWrapper = document.createElement('div');
    this.chartWrapper.id = 'gantt-chart-container';

    renderTimer.mark('Container setup complete');

    // Render UI components
    this.components.addHeaderSVG(this.chartWrapper, this.footerSVG);

    // Create the header menu (glassmorphic three-dot menu)
    const headerMenu = this.components.createHeaderMenu(this.isEditMode);

    const { titleContainer, titleElement } = this.components.addTitle(this.chartWrapper, this.ganttData, headerMenu);
    this.titleContainer = titleContainer;
    this.titleElement = titleElement;

    this.components.addLogo(this.titleContainer, this.titleElement);

    renderTimer.mark('Header components added');

    // Render grid
    this.gridElement = this.renderer.createGrid(this.chartWrapper, this.ganttData);

    renderTimer.mark('Grid created');

    // Render legend and footer
    this.legendElement = this.components.addLegend(this.chartWrapper, this.ganttData);
    this.components.addFooterSVG(this.chartWrapper, this.footerSVG);

    this.container.appendChild(this.chartWrapper);

    // Add research analysis
    this.analysis.addResearchAnalysis(this.container, this.ganttData);

    // Initialize handlers
    this._initializeExporter();
    this._initializeEditor();
    this._addKeyboardShortcuts();

    // Add today line
    const today = new Date();
    this.components.addTodayLine(this.gridElement, this.ganttData, today);

    // Update sticky header
    this.components.updateStickyHeaderPosition(this.titleContainer, this.chartWrapper, this.gridElement);

    // Initialize drag-to-edit
    this._initializeDragToEdit();
    this._updateEditorRefs();

    if (this.isEditMode && this.editor) {
      this.editor.enableAllEditFeatures();
    }

    renderTimer.mark('All components and listeners initialized');
    renderTimer.end();
  }

  /**
   * Clean up before re-render
   */
  _cleanupBeforeRender() {
    this.components.cleanup(this.legendElement);
    this.renderer.cleanup(this.gridElement);
  }

  /**
   * Sort tasks within each swimlane by start date
   */
  _sortTasksWithinSwimlanes() {
    if (!this.ganttData || !this.ganttData.data || this.ganttData.data.length === 0) {
      return;
    }

    const data = this.ganttData.data;
    const sortedData = [];
    let currentSwimlaneTasks = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const isSwimlaneRow = row.isSwimlane === true || row.isSwimlane === 'true';

      if (isSwimlaneRow) {
        if (currentSwimlaneTasks.length > 0) {
          this._sortTasksByStartDate(currentSwimlaneTasks);
          sortedData.push(...currentSwimlaneTasks);
          currentSwimlaneTasks = [];
        }
        sortedData.push(row);
      } else {
        currentSwimlaneTasks.push(row);
      }
    }

    if (currentSwimlaneTasks.length > 0) {
      this._sortTasksByStartDate(currentSwimlaneTasks);
      sortedData.push(...currentSwimlaneTasks);
    }

    this.ganttData.data = sortedData;
  }

  /**
   * Sort tasks by their start column
   */
  _sortTasksByStartDate(tasks) {
    if (!tasks || tasks.length <= 1) {
      return;
    }

    tasks.sort((a, b) => {
      const aStartCol = this._getStartCol(a);
      const bStartCol = this._getStartCol(b);

      if (aStartCol !== bStartCol) {
        return aStartCol - bStartCol;
      }

      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      return aTitle.localeCompare(bTitle);
    });
  }

  /**
   * Get start column for a task
   */
  _getStartCol(task) {
    if (!task || !task.bar) {
      return Infinity;
    }

    const startCol = task.bar.startCol;
    if (startCol == null || typeof startCol !== 'number' || isNaN(startCol)) {
      return Infinity;
    }

    return startCol;
  }

  /**
   * Refresh the legend after color changes
   */
  _refreshLegend() {
    const newLegend = this.components.refreshLegend(this.ganttData, this.legendElement);
    if (newLegend) {
      this.legendElement = newLegend;
    }
  }

  /**
   * Initialize the exporter module
   */
  _initializeExporter() {
    const chartContainer = document.getElementById('gantt-chart-container');
    if (!chartContainer) return;

    this.exporter = new GanttExporter(chartContainer, {
      onAnnounce: (msg) => this._announceToScreenReader(msg)
    });
    this.exporter.initializeListeners();
  }

  /**
   * Initialize the editor module
   */
  _initializeEditor() {
    if (!this.editor) {
      this.editor = new GanttEditor({
        ganttData: this.ganttData,
        gridElement: this.gridElement,
        titleElement: this.titleElement,
        legendElement: this.legendElement,
        draggableGantt: this.draggableGantt,
        resizableGantt: this.resizableGantt,
        contextMenu: this.contextMenu,
        onRender: () => this.render(),
        onAnnounce: (msg) => this._announceToScreenReader(msg)
      });
    }
    this.editor.initializeToggleListener();
  }

  /**
   * Update editor references after re-render
   */
  _updateEditorRefs() {
    if (this.editor) {
      this.editor.updateRefs({
        gridElement: this.gridElement,
        titleElement: this.titleElement,
        legendElement: this.legendElement,
        draggableGantt: this.draggableGantt,
        resizableGantt: this.resizableGantt,
        contextMenu: this.contextMenu
      });
    }
  }

  /**
   * Add keyboard shortcuts
   */
  _addKeyboardShortcuts() {
    if (this._keyboardHandler) {
      document.removeEventListener('keydown', this._keyboardHandler);
    }

    this._keyboardHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const key = e.key.toLowerCase();
      switch (key) {
        case 't':
          if (this.router) {
            this.router.navigate('roadmap');
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', this._keyboardHandler);
  }

  /**
   * Announce message to screen readers
   */
  _announceToScreenReader(message) {
    let liveRegion = document.getElementById('gantt-live-region');

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'gantt-live-region';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.setAttribute('role', 'status');
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = message;

    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    }, 5000);
  }

  /**
   * Initialize drag-to-edit functionality
   */
  _initializeDragToEdit() {
    if (!this.gridElement) {
      return;
    }

    this._cleanupInteractionHandlers();

    const onTaskUpdate = async (taskInfo) => {
      if (taskInfo.sessionId) {
        await fetchJSON('/api/content/update-task-dates', {
          method: 'POST',
          body: JSON.stringify(taskInfo)
        });
      }
    };

    const onTaskResize = async (taskInfo) => {
      if (taskInfo.sessionId) {
        await fetchJSON('/api/content/update-task-dates', {
          method: 'POST',
          body: JSON.stringify(taskInfo)
        });
      }
    };

    const onColorChange = async (taskInfo) => {
      if (taskInfo.sessionId) {
        await fetchJSON('/api/content/update-task-color', {
          method: 'POST',
          body: JSON.stringify(taskInfo)
        });
        this._refreshLegend();
      }
    };

    this.draggableGantt = new DraggableGantt(
      this.gridElement,
      this.ganttData,
      onTaskUpdate
    );

    this.resizableGantt = new ResizableGantt(
      this.gridElement,
      this.ganttData,
      onTaskResize
    );

    this.contextMenu = new ContextMenu(
      this.gridElement,
      this.ganttData,
      onColorChange
    );

    this._addCursorFeedback();
  }

  /**
   * Clean up interaction handlers
   */
  _cleanupInteractionHandlers() {
    if (this.draggableGantt) {
      this.draggableGantt.disable();
      this.draggableGantt = null;
    }

    if (this.resizableGantt) {
      this.resizableGantt.disable();
      this.resizableGantt = null;
    }

    if (this.contextMenu) {
      this.contextMenu.disable();
      this.contextMenu = null;
    }

    if (this._cursorFeedbackHandler && this._lastGridElement) {
      this._lastGridElement.removeEventListener('mousemove', this._cursorFeedbackHandler);
      this._cursorFeedbackHandler = null;
    }
  }

  /**
   * Add cursor feedback for bar interactions
   */
  _addCursorFeedback() {
    this._cursorFeedbackHandler = (event) => {
      const bar = event.target.closest('.gantt-bar');
      if (!bar) return;

      if (!this.isEditMode) {
        bar.style.cursor = 'pointer';
        return;
      }

      if (document.body.classList.contains('dragging') ||
          document.body.classList.contains('resizing')) {
        return;
      }

      const rect = bar.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const HANDLE_WIDTH = 10;

      if (x <= HANDLE_WIDTH || x >= rect.width - HANDLE_WIDTH) {
        bar.style.cursor = 'ew-resize';
      } else {
        bar.style.cursor = 'move';
      }
    };

    this._lastGridElement = this.gridElement;
    this.gridElement.addEventListener('mousemove', this._cursorFeedbackHandler);
  }

  /**
   * Clean up all resources to prevent memory leaks
   * Call this before removing the chart or on page unload
   */
  destroy() {
    // Cleanup modules
    this.components.cleanup(this.legendElement);
    this.renderer.cleanup(this.gridElement);

    // Cleanup interaction handlers
    this._cleanupInteractionHandlers();

    // Cleanup keyboard shortcuts listener
    if (this._keyboardHandler) {
      document.removeEventListener('keydown', this._keyboardHandler);
      this._keyboardHandler = null;
    }

    // Cleanup exporter
    if (this.exporter) {
      this.exporter = null;
    }

    // Cleanup editor
    if (this.editor) {
      this.editor = null;
    }

    // Clear DOM references
    if (this.container) {
      this.container.innerHTML = '';
    }

    this.chartWrapper = null;
    this.gridElement = null;
    this.titleElement = null;
    this.titleContainer = null;
    this.legendElement = null;
  }
}
