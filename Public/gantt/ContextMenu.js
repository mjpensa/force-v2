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
    // Remove menu from DOM on disable to prevent orphaned elements
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
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <div class="context-menu-title">Change Color</div>
      <div class="color-option" data-color="priority-red">
        <span class="color-preview" style="background-color: #EF4444;"></span>
        <span class="color-label">High Priority</span>
      </div>
      <div class="color-option" data-color="medium-red">
        <span class="color-preview" style="background-color: #FB923C;"></span>
        <span class="color-label">Medium Priority</span>
      </div>
      <div class="color-option" data-color="mid-grey">
        <span class="color-preview" style="background-color: #14B8A6;"></span>
        <span class="color-label">Teal</span>
      </div>
      <div class="color-option" data-color="light-grey">
        <span class="color-preview" style="background-color: #E879F9;"></span>
        <span class="color-label">Pink-Purple</span>
      </div>
      <div class="color-option" data-color="white">
        <span class="color-preview" style="background-color: #FFFFFF;"></span>
        <span class="color-label">White</span>
      </div>
      <div class="color-option" data-color="dark-blue">
        <span class="color-preview" style="background-color: #3B82F6;"></span>
        <span class="color-label">Blue</span>
      </div>
    `;
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
