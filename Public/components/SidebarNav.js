const ICONS = {
  roadmap: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"></rect><rect x="3" y="10" width="12" height="4" rx="1"></rect><rect x="3" y="16" width="15" height="4" rx="1"></rect></svg>',
  slides: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 8l3 2-3 2"></path></svg>',
  document: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>',
  analysis: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path><path d="M11 8v6"></path><path d="M8 11h6"></path></svg>',
  home: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 9h-3v9h-5v-6H11v6H6v-9H3l9-9z"></path></svg>',
  chevron: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>'
};

export class SidebarNav {
  constructor(options = {}) {
    this.onNavigate = options.onNavigate || (() => {});
    this.activeView = options.activeView || 'roadmap';
    this.sessionId = options.sessionId || '';
    this.isExpanded = false;
    this.isPinned = false;
    this.container = null;
    this.tooltip = null;
    this.tooltipTimeout = null;
    this.navItems = [
      { id: 'roadmap', title: 'Roadmap', subtitle: 'Gantt Chart View', icon: ICONS.roadmap },
      { id: 'document', title: 'Document', subtitle: 'Article View', icon: ICONS.document },
      { id: 'slides', title: 'Slides', subtitle: 'Presentation View', icon: ICONS.slides },
      { id: 'research-analysis', title: 'Research QA', subtitle: 'Research Quality', icon: ICONS.analysis }
    ];
    this.statuses = {};
    this.navItems.forEach(item => {
      this.statuses[item.id] = 'loading';
    });
    this._handleMouseLeave = this._handleMouseLeave.bind(this);
  }

  render() {
    this.container = document.createElement('nav');
    this.container.className = 'icon-rail';
    this.container.setAttribute('role', 'navigation');
    this.container.setAttribute('aria-label', 'Main navigation');
    this.container.innerHTML = `
      <div class="icon-rail-header">
        <a href="/" class="icon-rail-home" title="Create New Roadmap">
          <div class="icon-rail-home-icon">
            ${ICONS.home}
          </div>
          <span class="icon-rail-home-text">New Roadmap</span>
        </a>
      </div>
      <div class="icon-rail-nav" role="menu">
        <div class="icon-rail-section-label">Views</div>
        ${this._renderNavItems()}
      </div>
      <button class="icon-rail-toggle" title="Pin sidebar" aria-label="Toggle sidebar">
        ${ICONS.chevron}
      </button>
    `;
    this._createTooltip();
    this._attachEventListeners();
    document.body.classList.add('has-icon-rail');

    return this.container;
  }

  _renderNavItems() {
    return this.navItems.map(item => `
      <button
        class="icon-rail-item ${item.id === this.activeView ? 'active' : ''}"
        data-view="${item.id}"
        data-label="${item.title}"
        role="menuitem"
        aria-current="${item.id === this.activeView ? 'page' : 'false'}"
        title="${item.title}"
      >
        <div class="icon-rail-item-icon">
          ${item.icon}
          <span class="icon-rail-status ${this.statuses[item.id]}" id="rail-status-${item.id}"></span>
        </div>
        <div class="icon-rail-item-label">
          <span class="icon-rail-item-title">${item.title}</span>
          <span class="icon-rail-item-subtitle">${item.subtitle}</span>
        </div>
      </button>
    `).join('');
  }

  _createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'icon-rail-tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.tooltip);
  }

  _attachEventListeners() {
    const navItems = this.container.querySelectorAll('.icon-rail-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const view = item.dataset.view;
        this._handleNavClick(view);
      });
      item.addEventListener('mouseenter', (e) => this._showTooltip(item, e));
      item.addEventListener('mouseleave', () => this._hideTooltip());
    });
    const toggleBtn = this.container.querySelector('.icon-rail-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this._togglePinned());
    }
    this.container.addEventListener('mouseleave', this._handleMouseLeave);
  }

  _handleNavClick(view) {
    if (view === this.activeView) return;
    this._setActiveView(view);
    this.onNavigate(view);
    window.location.hash = view;
  }

  setActiveView(view) {
    this._setActiveView(view);
  }

  _setActiveView(view) {
    this.activeView = view;
    const items = this.container.querySelectorAll('.icon-rail-item');
    items.forEach(item => {
      const isActive = item.dataset.view === view;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  updateStatus(view, status) {
    this.statuses[view] = status;

    const statusEl = this.container?.querySelector(`#rail-status-${view}`);
    if (statusEl) {
      statusEl.classList.remove('loading', 'processing', 'ready', 'failed');
      statusEl.classList.add(status);
      const titles = {
        loading: 'Checking status...',
        processing: 'Generating...',
        ready: 'Ready',
        failed: 'Failed - click to retry'
      };
      statusEl.title = titles[status] || '';
    }
  }

  _showTooltip(item, event) {
    if (this.isExpanded || this.isPinned) return;
    if (window.innerWidth <= 640) return;

    clearTimeout(this.tooltipTimeout);

    const navItem = this.navItems.find(n => n.id === item.dataset.view);
    if (!navItem) return;

    this.tooltip.textContent = navItem.title;
    const rect = item.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();

    this.tooltip.style.top = `${rect.top + (rect.height / 2) - 18}px`;
    this.tooltip.style.left = `${rect.right + 12}px`;
    this.tooltip.style.right = 'auto';

    this.tooltip.classList.add('visible');
    this.tooltip.setAttribute('aria-hidden', 'false');
  }

  _hideTooltip() {
    clearTimeout(this.tooltipTimeout);
    this.tooltipTimeout = setTimeout(() => {
      this.tooltip.classList.remove('visible');
      this.tooltip.setAttribute('aria-hidden', 'true');
    }, 100);
  }

  _togglePinned() {
    this.isPinned = !this.isPinned;
    this.isExpanded = this.isPinned;

    this.container.classList.toggle('expanded', this.isPinned);
    document.body.classList.toggle('rail-expanded', this.isPinned);
    const toggleBtn = this.container.querySelector('.icon-rail-toggle');
    if (toggleBtn) {
      toggleBtn.title = this.isPinned ? 'Collapse sidebar' : 'Pin sidebar';
      toggleBtn.setAttribute('aria-pressed', this.isPinned.toString());
    }
    if (this.isPinned) {
      this._hideTooltip();
    }
  }

  _handleMouseLeave() {
    if (!this.isPinned) {
      this.isExpanded = false;
    }
  }

  destroy() {
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
    document.body.classList.remove('has-icon-rail', 'rail-expanded');
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.tooltip = null;
  }

}
