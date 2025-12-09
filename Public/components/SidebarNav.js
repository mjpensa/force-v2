/**
 * SidebarNav - Glassmorphic Icon Rail Navigation
 * A beautiful, persistent vertical navigation bar with icons that expands on hover.
 * Features glassmorphic design with blur, transparency, glow effects, and smooth animations.
 * Features:
 * - Collapsed state shows only icons (72px width)
 * - Expands on hover to show labels (240px width)
 * - Status indicators (loading, processing, ready, failed)
 * - Keyboard shortcuts support
 * - Smooth animations and micro-interactions
 * - Responsive design (bottom dock on mobile)
 * - Accessibility compliant (ARIA, keyboard navigation)
 */

export class SidebarNav {
  /**
   * Creates a new SidebarNav instance
   * @param {Object} options - Configuration options
   * @param {Function} options.onNavigate - Callback when navigation item is clicked
   * @param {string} options.activeView - Initial active view
   * @param {string} options.sessionId - Current session ID
   */
  constructor(options = {}) {
    this.onNavigate = options.onNavigate || (() => {});
    this.activeView = options.activeView || 'roadmap';
    this.sessionId = options.sessionId || '';
    this.isExpanded = false;
    this.isPinned = false;

    // DOM references
    this.container = null;
    this.tooltip = null;
    this.tooltipTimeout = null;

    // Navigation items configuration
    this.navItems = [
      {
        id: 'roadmap',
        title: 'Roadmap',
        subtitle: 'Gantt Chart View',
        icon: this._getRoadmapIcon(),
        shortcut: '1'
      },
      {
        id: 'document',
        title: 'Document',
        subtitle: 'Article View',
        icon: this._getDocumentIcon(),
        shortcut: '2'
      },
      {
        id: 'slides',
        title: 'Slides',
        subtitle: 'Presentation View',
        icon: this._getSlidesIcon(),
        shortcut: '3'
      },
      {
        id: 'research-analysis',
        title: 'Research QA',
        subtitle: 'Research Quality',
        icon: this._getAnalysisIcon(),
        shortcut: '4'
      }
    ];

    // Status tracking
    this.statuses = {};
    this.navItems.forEach(item => {
      this.statuses[item.id] = 'loading';
    });

    // Bind methods
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleMouseLeave = this._handleMouseLeave.bind(this);
  }

  /**
   * Render the icon rail navigation
   * @returns {HTMLElement} The icon rail container element
   */
  render() {
    // Create main container
    this.container = document.createElement('nav');
    this.container.className = 'icon-rail';
    this.container.setAttribute('role', 'navigation');
    this.container.setAttribute('aria-label', 'Main navigation');

    // Build inner HTML
    this.container.innerHTML = `
      <!-- Header with Logo -->
      <div class="icon-rail-header">
        <div class="icon-rail-logo" title="Content Viewer">
          ${this._getLogoIcon()}
        </div>
      </div>

      <!-- Navigation Items -->
      <div class="icon-rail-nav" role="menu">
        <div class="icon-rail-section-label">Views</div>
        ${this._renderNavItems()}
      </div>

      <!-- Footer with Home Link -->
      <div class="icon-rail-footer">
        <a href="/" class="icon-rail-home" title="Create New Roadmap">
          ${this._getHomeIcon()}
          <span class="icon-rail-home-text">New Roadmap</span>
        </a>
      </div>

      <!-- Toggle Button -->
      <button class="icon-rail-toggle" title="Pin sidebar" aria-label="Toggle sidebar">
        ${this._getChevronIcon()}
      </button>

      <!-- Keyboard Shortcut Hint -->
      <div class="icon-rail-shortcut">
        Press <kbd>M</kbd> to toggle
      </div>
    `;

    // Create tooltip element
    this._createTooltip();

    // Attach event listeners
    this._attachEventListeners();

    // Add class to body for layout adjustment
    document.body.classList.add('has-icon-rail');

    return this.container;
  }

  /**
   * Render navigation items HTML
   * @private
   */
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

  /**
   * Create tooltip element
   * @private
   */
  _createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'icon-rail-tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.tooltip);
  }

  /**
   * Attach event listeners
   * @private
   */
  _attachEventListeners() {
    // Navigation item clicks
    const navItems = this.container.querySelectorAll('.icon-rail-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const view = item.dataset.view;
        this._handleNavClick(view);
      });

      // Tooltip on hover (only when collapsed)
      item.addEventListener('mouseenter', (e) => this._showTooltip(item, e));
      item.addEventListener('mouseleave', () => this._hideTooltip());
    });

    // Toggle button (pin/unpin)
    const toggleBtn = this.container.querySelector('.icon-rail-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this._togglePinned());
    }

    // Keyboard navigation
    document.addEventListener('keydown', this._handleKeyDown);

    // Track hover state for pinning behavior
    this.container.addEventListener('mouseleave', this._handleMouseLeave);
  }

  /**
   * Handle navigation item click
   * @private
   */
  _handleNavClick(view) {
    if (view === this.activeView) return;

    // Update active state
    this._setActiveView(view);

    // Call navigation callback
    this.onNavigate(view);

    // Update URL hash
    window.location.hash = view;
  }

  /**
   * Set the active view
   * @param {string} view - The view to set as active
   */
  setActiveView(view) {
    this._setActiveView(view);
  }

  /**
   * Internal method to update active view UI
   * @private
   */
  _setActiveView(view) {
    this.activeView = view;

    // Update item states
    const items = this.container.querySelectorAll('.icon-rail-item');
    items.forEach(item => {
      const isActive = item.dataset.view === view;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  /**
   * Update status indicator for a view
   * @param {string} view - The view ID
   * @param {string} status - Status: 'loading', 'processing', 'ready', 'failed'
   */
  updateStatus(view, status) {
    this.statuses[view] = status;

    const statusEl = this.container?.querySelector(`#rail-status-${view}`);
    if (statusEl) {
      // Remove all status classes
      statusEl.classList.remove('loading', 'processing', 'ready', 'failed');
      // Add new status class
      statusEl.classList.add(status);

      // Update title for accessibility
      const titles = {
        loading: 'Checking status...',
        processing: 'Generating...',
        ready: 'Ready',
        failed: 'Failed - click to retry'
      };
      statusEl.title = titles[status] || '';
    }
  }

  /**
   * Show tooltip for an item
   * @private
   */
  _showTooltip(item, event) {
    // Only show tooltip when collapsed
    if (this.isExpanded || this.isPinned) return;

    // Don't show on mobile
    if (window.innerWidth <= 640) return;

    clearTimeout(this.tooltipTimeout);

    const navItem = this.navItems.find(n => n.id === item.dataset.view);
    if (!navItem) return;

    this.tooltip.textContent = navItem.title;

    // Position tooltip
    const rect = item.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();

    this.tooltip.style.top = `${rect.top + (rect.height / 2) - 18}px`;
    this.tooltip.style.left = `${rect.right + 12}px`;
    this.tooltip.style.right = 'auto';

    this.tooltip.classList.add('visible');
    this.tooltip.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide tooltip
   * @private
   */
  _hideTooltip() {
    clearTimeout(this.tooltipTimeout);
    this.tooltipTimeout = setTimeout(() => {
      this.tooltip.classList.remove('visible');
      this.tooltip.setAttribute('aria-hidden', 'true');
    }, 100);
  }

  /**
   * Toggle pinned state
   * @private
   */
  _togglePinned() {
    this.isPinned = !this.isPinned;
    this.isExpanded = this.isPinned;

    this.container.classList.toggle('expanded', this.isPinned);
    document.body.classList.toggle('rail-expanded', this.isPinned);

    // Update toggle button
    const toggleBtn = this.container.querySelector('.icon-rail-toggle');
    if (toggleBtn) {
      toggleBtn.title = this.isPinned ? 'Collapse sidebar' : 'Pin sidebar';
      toggleBtn.setAttribute('aria-pressed', this.isPinned.toString());
    }

    // Hide tooltip when expanded
    if (this.isPinned) {
      this._hideTooltip();
    }
  }

  /**
   * Handle mouse leave
   * @private
   */
  _handleMouseLeave() {
    // If not pinned, ensure collapsed state
    if (!this.isPinned) {
      this.isExpanded = false;
    }
  }

  /**
   * Handle keyboard shortcuts
   * @private
   */
  _handleKeyDown(e) {
    // Don't trigger if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Toggle sidebar with 'M' key
    if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this._togglePinned();
      return;
    }

    // Number keys for navigation
    const numKey = parseInt(e.key);
    if (numKey >= 1 && numKey <= this.navItems.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const item = this.navItems[numKey - 1];
      if (item) {
        this._handleNavClick(item.id);
      }
    }
  }

  /**
   * Destroy the sidebar and clean up
   */
  destroy() {
    // Remove event listeners
    document.removeEventListener('keydown', this._handleKeyDown);

    // Remove tooltip
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }

    // Remove body classes
    document.body.classList.remove('has-icon-rail', 'rail-expanded');

    // Remove container
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.tooltip = null;
  }

  // ========== SVG ICONS ==========

  _getLogoIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
    `;
  }

  _getRoadmapIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="4" rx="1"></rect>
        <rect x="3" y="10" width="12" height="4" rx="1"></rect>
        <rect x="3" y="16" width="15" height="4" rx="1"></rect>
      </svg>
    `;
  }

  _getSlidesIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"></rect>
        <path d="M8 21h8"></path>
        <path d="M12 17v4"></path>
        <path d="M7 8l3 2-3 2"></path>
      </svg>
    `;
  }

  _getDocumentIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
      </svg>
    `;
  }

  _getAnalysisIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="M21 21l-4.35-4.35"></path>
        <path d="M11 8v6"></path>
        <path d="M8 11h6"></path>
      </svg>
    `;
  }

  _getHomeIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3l9 9h-3v9h-5v-6H11v6H6v-9H3l9-9z"></path>
      </svg>
    `;
  }

  _getChevronIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
  }
}

export default SidebarNav;
