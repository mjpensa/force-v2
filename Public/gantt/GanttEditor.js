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

  updateRefs(refs) {
    if (refs.gridElement) this.gridElement = refs.gridElement;
    if (refs.titleElement) this.titleElement = refs.titleElement;
    if (refs.legendElement) this.legendElement = refs.legendElement;
    if (refs.draggableGantt) this.draggableGantt = refs.draggableGantt;
    if (refs.resizableGantt) this.resizableGantt = refs.resizableGantt;
    if (refs.contextMenu) this.contextMenu = refs.contextMenu;
  }

  initializeToggleListener() {
    const editModeBtn = document.getElementById('edit-mode-toggle-btn');
    if (!editModeBtn) return;

    editModeBtn.addEventListener('click', () => {
      this.isEditMode = !this.isEditMode;
      const iconEl = editModeBtn.querySelector('.menu-item-icon');
      const textEl = editModeBtn.querySelector('.menu-item-text');

      iconEl.textContent = this.isEditMode ? '🔓' : '🔒';
      textEl.textContent = this.isEditMode ? 'Edit Mode: ON' : 'Edit Mode: OFF';
      editModeBtn.classList.toggle('active', this.isEditMode);

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

  enableAllEditFeatures() {
    if (this.draggableGantt) {
      this.draggableGantt.enable();
    }
    if (this.resizableGantt) {
      this.resizableGantt.enable();
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

  disableAllEditFeatures() {
    if (this.draggableGantt) {
      this.draggableGantt.disable();
    }
    if (this.resizableGantt) {
      this.resizableGantt.disable();
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

  removeTaskRow(taskIndex) {
    const taskData = this.ganttData.data[taskIndex];
    if (!taskData) return;

    if (taskData.isSwimlane) return;

    if (!confirm(`Delete task "${taskData.title}"?`)) return;

    this.ganttData.data.splice(taskIndex, 1);
    this.onRender();
  }

  _makeInlineEditable(element, onSave) {
    if (!element) return;
    const originalText = element.textContent;
    element.setAttribute('contenteditable', 'true');
    element.classList.add('editing');
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const saveChanges = () => {
      element.setAttribute('contenteditable', 'false');
      element.classList.remove('editing');
      const newText = element.textContent.trim();
      element.textContent = newText;
      if (newText && newText !== originalText) {
        onSave(newText);
      } else {
        element.textContent = originalText;
      }
    };
    const cancelEdit = () => {
      element.setAttribute('contenteditable', 'false');
      element.classList.remove('editing');
      element.textContent = originalText;
    };
    const blurHandler = () => {
      saveChanges();
      element.removeEventListener('blur', blurHandler);
    };
    element.addEventListener('blur', blurHandler);
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); element.blur(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        element.removeEventListener('blur', blurHandler);
        cancelEdit();
      }
    });
  }

  makeEditable(labelElement, taskIndex) {
    this._makeInlineEditable(labelElement, (newText) => {
      this.ganttData.data[taskIndex].title = newText;
    });
  }

  makeChartTitleEditable() {
    this._makeInlineEditable(this.titleElement, (newText) => {
      this.ganttData.title = newText;
    });
  }

  makeLegendLabelEditable(labelElement, legendIndex) {
    this._makeInlineEditable(labelElement, (newText) => {
      this.ganttData.legend[legendIndex].label = newText;
    });
  }
}
