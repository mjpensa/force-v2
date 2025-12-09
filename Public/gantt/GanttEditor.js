/**
 * GanttEditor - Handles chart edit mode functionality
 * Extracted from GanttChart.js for modularity
 * Contains: edit mode toggle, inline editing, task add/remove
 */

export class GanttEditor {
  constructor(config) {
    this.ganttData = config.ganttData;
    this.gridElement = config.gridElement;
    this.titleElement = config.titleElement;
    this.legendElement = config.legendElement;
    this.draggableGantt = config.draggableGantt;
    this.resizableGantt = config.resizableGantt;
    this.contextMenu = config.contextMenu;
    this.onRender = config.onRender || (() => {});
    this.onAnnounce = config.onAnnounce || (() => {});

    this.isEditMode = false;
  }

  /**
   * Update references after re-render
   */
  updateRefs(refs) {
    if (refs.gridElement) this.gridElement = refs.gridElement;
    if (refs.titleElement) this.titleElement = refs.titleElement;
    if (refs.legendElement) this.legendElement = refs.legendElement;
    if (refs.draggableGantt) this.draggableGantt = refs.draggableGantt;
    if (refs.resizableGantt) this.resizableGantt = refs.resizableGantt;
    if (refs.contextMenu) this.contextMenu = refs.contextMenu;
  }

  /**
   * Initialize edit mode toggle listener
   */
  initializeToggleListener() {
    const editModeBtn = document.getElementById('edit-mode-toggle-btn');
    if (!editModeBtn) return;

    editModeBtn.addEventListener('click', () => {
      this.isEditMode = !this.isEditMode;

      // Update button appearance - support both old and new menu structures
      const iconEl = editModeBtn.querySelector('.menu-item-icon');
      const textEl = editModeBtn.querySelector('.menu-item-text');

      if (iconEl && textEl) {
        // New glassmorphic menu structure
        iconEl.textContent = this.isEditMode ? '🔓' : '🔒';
        textEl.textContent = this.isEditMode ? 'Edit Mode: ON' : 'Edit Mode: OFF';
        editModeBtn.classList.toggle('active', this.isEditMode);
      } else {
        // Legacy button structure
        editModeBtn.textContent = this.isEditMode ? '🔓 Edit Mode: ON' : '🔒 Edit Mode: OFF';
        editModeBtn.style.backgroundColor = this.isEditMode ? '#50AF7B' : '#BA3930';
      }

      editModeBtn.setAttribute('aria-pressed', this.isEditMode ? 'true' : 'false');

      if (this.isEditMode) {
        this.enableAllEditFeatures();
        this.onAnnounce('Edit mode enabled. You can now drag, resize, and customize chart elements.');
      } else {
        this.disableAllEditFeatures();
        this.onAnnounce('Edit mode disabled. Chart is now read-only.');
      }
    });
  }

  /**
   * Enable all edit features
   */
  enableAllEditFeatures() {
    if (this.draggableGantt) {
      this.draggableGantt.enableDragging();
    }
    if (this.resizableGantt) {
      this.resizableGantt.enableResizing();
    }
    if (this.contextMenu) {
      this.contextMenu.enable();
    }

    if (this.gridElement) {
      this.gridElement.classList.add('edit-mode-enabled');
      this.gridElement.setAttribute('aria-readonly', 'false');
    }
    if (this.titleElement) {
      this.titleElement.classList.add('edit-mode-enabled');
    }
    if (this.legendElement) {
      this.legendElement.classList.add('edit-mode-enabled');
    }
  }

  /**
   * Disable all edit features
   */
  disableAllEditFeatures() {
    if (this.draggableGantt) {
      this.draggableGantt.disableDragging();
    }
    if (this.resizableGantt) {
      this.resizableGantt.disableResizing();
    }
    if (this.contextMenu) {
      this.contextMenu.disable();
    }

    if (this.gridElement) {
      this.gridElement.classList.remove('edit-mode-enabled');
      this.gridElement.setAttribute('aria-readonly', 'true');

      const bars = this.gridElement.querySelectorAll('.gantt-bar');
      bars.forEach(bar => {
        bar.style.cursor = 'pointer';
      });
    }
    if (this.titleElement) {
      this.titleElement.classList.remove('edit-mode-enabled');
    }
    if (this.legendElement) {
      this.legendElement.classList.remove('edit-mode-enabled');
    }
  }

  /**
   * Enable drag-to-edit functionality
   */
  enableDragToEdit() {
    if (this.draggableGantt) {
      this.draggableGantt.enableDragging();
    }
  }

  /**
   * Disable drag-to-edit functionality
   */
  disableDragToEdit() {
    if (this.draggableGantt) {
      this.draggableGantt.disableDragging();
    }
  }

  /**
   * Add a new task row after the specified index
   */
  addNewTaskRow(afterIndex) {
    const newTask = {
      title: 'New Task',
      entity: 'New Entity',
      isSwimlane: false,
      bar: {
        startCol: 2,
        endCol: 4,
        color: 'mid-grey'
      }
    };

    this.ganttData.data.splice(afterIndex + 1, 0, newTask);
    this.onRender();
  }

  /**
   * Remove a task row at the specified index
   */
  removeTaskRow(taskIndex) {
    const taskData = this.ganttData.data[taskIndex];
    if (!taskData) return;

    if (taskData.isSwimlane) return;

    if (!confirm(`Delete task "${taskData.title}"?`)) return;

    this.ganttData.data.splice(taskIndex, 1);
    this.onRender();
  }

  /**
   * Update row indices after modifications
   */
  updateRowIndices() {
    if (!this.gridElement) return;

    const allLabels = Array.from(this.gridElement.querySelectorAll('.gantt-row-label'));
    const allBarAreas = Array.from(this.gridElement.querySelectorAll('.gantt-bar-area'));

    allLabels.forEach((label, index) => {
      label.setAttribute('data-task-index', index);
      label.setAttribute('data-row-id', `row-${index}`);
    });

    allBarAreas.forEach((barArea, index) => {
      barArea.setAttribute('data-task-index', index);
      barArea.setAttribute('data-row-id', `row-${index}`);
    });
  }

  /**
   * Make a label element editable
   */
  makeEditable(labelElement, taskIndex) {
    const originalText = labelElement.textContent;

    labelElement.setAttribute('contenteditable', 'true');
    labelElement.classList.add('editing');
    labelElement.focus();

    const range = document.createRange();
    range.selectNodeContents(labelElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const saveChanges = async () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');

      const newText = labelElement.textContent.trim();
      labelElement.textContent = newText;

      if (newText && newText !== originalText) {
        this.ganttData.data[taskIndex].title = newText;
      } else {
        labelElement.textContent = originalText;
      }
    };

    const cancelEdit = () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');
      labelElement.textContent = originalText;
    };

    const blurHandler = () => {
      saveChanges();
      labelElement.removeEventListener('blur', blurHandler);
    };

    labelElement.addEventListener('blur', blurHandler);

    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        labelElement.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        labelElement.removeEventListener('blur', blurHandler);
        cancelEdit();
        labelElement.removeEventListener('keydown', keyHandler);
      }
    };

    labelElement.addEventListener('keydown', keyHandler);
  }

  /**
   * Make the chart title editable
   */
  makeChartTitleEditable() {
    if (!this.titleElement) return;

    const originalText = this.titleElement.textContent;

    this.titleElement.setAttribute('contenteditable', 'true');
    this.titleElement.classList.add('editing');
    this.titleElement.focus();

    const range = document.createRange();
    range.selectNodeContents(this.titleElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const saveChanges = async () => {
      this.titleElement.setAttribute('contenteditable', 'false');
      this.titleElement.classList.remove('editing');

      const newText = this.titleElement.textContent.trim();
      this.titleElement.textContent = newText;

      if (newText && newText !== originalText) {
        this.ganttData.title = newText;
      } else {
        this.titleElement.textContent = originalText;
      }
    };

    const cancelEdit = () => {
      this.titleElement.setAttribute('contenteditable', 'false');
      this.titleElement.classList.remove('editing');
      this.titleElement.textContent = originalText;
    };

    const blurHandler = () => {
      saveChanges();
      this.titleElement.removeEventListener('blur', blurHandler);
    };

    this.titleElement.addEventListener('blur', blurHandler);

    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.titleElement.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.titleElement.removeEventListener('blur', blurHandler);
        cancelEdit();
        this.titleElement.removeEventListener('keydown', keyHandler);
      }
    };

    this.titleElement.addEventListener('keydown', keyHandler);
  }

  /**
   * Make a legend label editable
   */
  makeLegendLabelEditable(labelElement, legendIndex) {
    const originalText = labelElement.textContent;

    labelElement.setAttribute('contenteditable', 'true');
    labelElement.classList.add('editing');
    labelElement.focus();

    const range = document.createRange();
    range.selectNodeContents(labelElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const saveChanges = async () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');

      const newText = labelElement.textContent.trim();
      labelElement.textContent = newText;

      if (newText && newText !== originalText) {
        this.ganttData.legend[legendIndex].label = newText;
      } else {
        labelElement.textContent = originalText;
      }
    };

    const cancelEdit = () => {
      labelElement.setAttribute('contenteditable', 'false');
      labelElement.classList.remove('editing');
      labelElement.textContent = originalText;
    };

    const blurHandler = () => {
      saveChanges();
      labelElement.removeEventListener('blur', blurHandler);
    };

    labelElement.addEventListener('blur', blurHandler);

    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        labelElement.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        labelElement.removeEventListener('blur', blurHandler);
        cancelEdit();
        labelElement.removeEventListener('keydown', keyHandler);
      }
    };

    labelElement.addEventListener('keydown', keyHandler);
  }
}
