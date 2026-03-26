export class ContextMenu {
  constructor(gridElement, ganttData, onColorChange) {
    this.gridElement = gridElement;
    this.ganttData = ganttData;
    this.onColorChange = onColorChange;
    this.menu = null;
    this.targetBar = null;
    this.targetTaskIndex = null;
    this._isDocumentListenerAttached = false; // Prevent duplicate listeners
    this._handleContextMenu = this._handleContextMenu.bind(this);
    this._handleDocumentClick = this._handleDocumentClick.bind(this);
  }
  enable() {
    this.gridElement.addEventListener('contextmenu', this._handleContextMenu);
  }
  disable() {
    this.gridElement.removeEventListener('contextmenu', this._handleContextMenu);
    this.hide();
    if (this.menu && this.menu.parentNode) {
      this.menu.parentNode.removeChild(this.menu);
      this.menu = null;
    }
  }
  _handleContextMenu(event) {
    const bar = event.target.closest('.gantt-bar');
    if (!bar) return;
    event.preventDefault();
    event.stopPropagation();
    const barArea = bar.closest('.gantt-bar-area');
    const taskIndex = parseInt(barArea.getAttribute('data-task-index'));
    this.show(event, bar, taskIndex);
  }
  show(event, bar, taskIndex) {
    this.targetBar = bar;
    this.targetTaskIndex = taskIndex;
    if (!this.menu) {
      this.menu = this._createMenu();
    }
    this.menu.style.left = `${event.pageX}px`;
    this.menu.style.top = `${event.pageY}px`;
    this.menu.style.display = 'block';

    // Only attach listener if not already attached
    if (!this._isDocumentListenerAttached) {
      setTimeout(() => {
        document.addEventListener('click', this._handleDocumentClick);
        this._isDocumentListenerAttached = true;
      }, 0);
    }
  }
  hide() {
    if (this.menu) {
      this.menu.style.display = 'none';
    }
    // Only remove if attached
    if (this._isDocumentListenerAttached) {
      document.removeEventListener('click', this._handleDocumentClick);
      this._isDocumentListenerAttached = false;
    }
    this.targetBar = null;
    this.targetTaskIndex = null;
  }
  _handleDocumentClick(event) {
    if (this.menu && this.menu.contains(event.target)) {
      return;
    }
    this.hide();
  }
  _createMenu() {
    const colorOptions = [
      { key: 'priority-red', hex: '#EF4444', label: 'High Priority' },
      { key: 'medium-red',   hex: '#FB923C', label: 'Medium Priority' },
      { key: 'mid-grey',     hex: '#14B8A6', label: 'Teal' },
      { key: 'light-grey',   hex: '#E879F9', label: 'Pink-Purple' },
      { key: 'white',        hex: '#FFFFFF', label: 'White' },
      { key: 'dark-blue',    hex: '#3B82F6', label: 'Blue' },
    ];

    const menu = document.createElement('div');
    menu.className = 'context-menu';

    const title = document.createElement('div');
    title.className = 'context-menu-title';
    title.textContent = 'Change Color';
    menu.appendChild(title);

    for (const { key, hex, label } of colorOptions) {
      const option = document.createElement('div');
      option.className = 'color-option';
      option.dataset.color = key;

      const preview = document.createElement('span');
      preview.className = 'color-preview';
      preview.style.backgroundColor = hex;

      const labelEl = document.createElement('span');
      labelEl.className = 'color-label';
      labelEl.textContent = label;

      option.appendChild(preview);
      option.appendChild(labelEl);
      menu.appendChild(option);
    }

    menu.addEventListener('click', (e) => {
      const option = e.target.closest('.color-option');
      if (option) {
        const newColor = option.dataset.color;
        this._changeColor(newColor);
      }
    });
    document.body.appendChild(menu);
    return menu;
  }
  async _changeColor(newColor) {
    if (!this.targetBar || this.targetTaskIndex === null) {
      return;
    }
    const oldColor = this.targetBar.getAttribute('data-color');
    this.targetBar.setAttribute('data-color', newColor);
    this.ganttData.data[this.targetTaskIndex].bar.color = newColor;
    if (this.onColorChange) {
      const taskInfo = {
        taskName: this.ganttData.data[this.targetTaskIndex].title,
        entity: this.ganttData.data[this.targetTaskIndex].entity,
        sessionId: this.ganttData.sessionId,
        taskIndex: this.targetTaskIndex,
        oldColor: oldColor,
        newColor: newColor
      };
      try {
        await this.onColorChange(taskInfo);
      } catch (error) {
        this.targetBar.setAttribute('data-color', oldColor);
        this.ganttData.data[this.targetTaskIndex].bar.color = oldColor;
      }
    }
    this.hide();
  }
}
