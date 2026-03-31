import { pollUntilReady } from './poll.js';
import { StateManager } from './components/shared/StateManager.js';
import { addLazyLoadingStyles, initLazyLoading } from './components/shared/LazyLoader.js';
import { SidebarNav } from './components/SidebarNav.js';
import {
  markPerformance,
  measurePerformance
} from './components/shared/Performance.js';
import {
  initAccessibility
} from './components/shared/Accessibility.js';
import {
  showErrorNotification
} from './components/shared/ErrorHandler.js';
import { loadFooterSVG } from './utils/assets.js';

class SSEService {
  constructor() {
    this.eventSources = new Map();
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  start(sessionId, onProgress, onComplete, onError) {
    this.stop(sessionId);
    if (typeof EventSource === 'undefined') {
      console.warn('[SSE] EventSource not supported, falling back to polling');
      onError?.('EventSource not supported');
      return false;
    }

    try {
      const eventSource = new EventSource(`/api/content/stream/${sessionId}`);
      this.eventSources.set(sessionId, eventSource);

      eventSource.addEventListener('connected', () => {});

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        onProgress?.(data.content);
      });

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        onComplete?.(data);
        this.stop(sessionId);
      });

      eventSource.addEventListener('error', (event) => {
        let message = 'Unknown error';
        try {
          if (event.data) {
            const data = JSON.parse(event.data);
            message = data.message || message;
          }
        } catch (_) { /* non-JSON error event */ }
        console.error('[SSE] Server error:', message);
        onError?.(message);
        this.stop(sessionId);
      });

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        if (eventSource.readyState === EventSource.CLOSED) {
          onError?.('Connection closed');
          this.stop(sessionId);
        }
      };

      return true;
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      onError?.(error.message);
      return false;
    }
  }

  stop(sessionId) {
    const eventSource = this.eventSources.get(sessionId);
    if (eventSource) {
      eventSource.close();
      this.eventSources.delete(sessionId);
    }
  }

  stopAll() {
    for (const sessionId of this.eventSources.keys()) {
      this.stop(sessionId);
    }
  }

}

class ContentViewer {
  constructor() {
    this.stateManager = new StateManager();
    this.sessionId = null;
    this.currentView = null;
    this.currentViewComponent = null;
    this.appRoot = document.getElementById('app-root');
    this.navContainer = null;
    this.contentContainer = null;
    this.sidebarNav = null;
    this.footerSVG = '';
    this.taskAnalyzer = null;

    this.sseService = new SSEService(); // Real-time updates (fallback to polling)
    this._useSSE = true; // Try SSE first, fallback to polling on failure
  }
  async init() {
    try {
      markPerformance('viewer-init-start');
      addLazyLoadingStyles();
      this.footerSVG = await loadFooterSVG();
      initAccessibility({
        skipLink: true,
        skipLinkTarget: 'main-content',
        announceRouteChanges: true,
        focusManagement: true
      });
      this.sessionId = this._getSessionIdFromURL();
      if (!this.sessionId) {
        this._showError('No session ID provided', 'Please return to the home page and generate content first.');
        return;
      }
      this.stateManager.setState({ sessionId: this.sessionId });
      this._buildUI();
      this._setupRouting();
      await this._handleRouteChange();
      this._startBackgroundStatusPolling();
      markPerformance('viewer-init-end');
      measurePerformance('viewer-initialization', 'viewer-init-start', 'viewer-init-end');
    } catch (error) {
      this._showError('Failed to load content', error.message);
    }
  }
  _buildUI() {
    this.appRoot.innerHTML = '';
    const appShell = document.createElement('div');
    appShell.className = 'app-shell';
    const main = document.createElement('main');
    main.className = 'app-main';
    main.id = 'main-content';
    main.setAttribute('role', 'main');
    this.contentContainer = main;
    this._initSidebarNav();
    appShell.appendChild(main);
    this.appRoot.appendChild(appShell);
  }
  _initSidebarNav() {
    const hash = window.location.hash.slice(1);
    const initialView = hash || 'roadmap';
    this.sidebarNav = new SidebarNav({
      activeView: initialView,
      sessionId: this.sessionId
    });
    const sidebarElement = this.sidebarNav.render();
    document.body.appendChild(sidebarElement);
    this.navContainer = sidebarElement;
  }
  _setupRouting() {
    window.addEventListener('hashchange', () => this._handleRouteChange());
  }
  async _handleRouteChange() {
    const hash = window.location.hash.slice(1); // Remove '#'
    const view = hash || 'roadmap'; // Default to roadmap
    this._updateActiveTab(view);
    this._updateBodyViewClass(view);
    this.stateManager.setState({ currentView: view });
    await this._loadView(view);
  }
  _updateBodyViewClass(view) {
    document.body.classList.remove('view-roadmap', 'view-slides', 'view-document', 'view-research-analysis');
    document.body.classList.add(`view-${view}`);
  }
  _updateActiveTab(view) {
    if (this.sidebarNav) {
      this.sidebarNav.setActiveView(view);
    }
  }
  async _loadView(viewName) {
    try {
      markPerformance(`view-${viewName}-start`);
      if (this.currentViewComponent && this.currentViewComponent.destroy) {
        this.currentViewComponent.destroy();
      }
      this.currentViewComponent = null;
      this._showLoading(viewName);
      markPerformance(`api-${viewName}-start`);
      let viewData;
      try {
        viewData = await this.stateManager.loadView(viewName);
        markPerformance(`api-${viewName}-end`);
        measurePerformance(`api-${viewName}`, `api-${viewName}-start`, `api-${viewName}-end`);
      } catch (error) {
        const hasEmptyContent = error.details?.emptyContent === true || error.details?.emptyData === true;
        const canRetry = error.details?.canRetry === true || error.details?.emptyData === true;
        const isApiError = error.details?.apiError === true;
        if (isApiError) {
          this._updateTabStatus(viewName, 'failed');
          this._showGenerationFailed(viewName, error.message);
          return;
        }
        if (hasEmptyContent && canRetry) {
          this._showGenerationFailed(viewName, error.message);
          return;
        }
        throw error;
      }
      markPerformance(`render-${viewName}-start`);
      const viewLoaders = {
        slides: () => import('./components/views/SlidesView.js').then(m => m.SlidesView),
        document: () => import('./components/views/DocumentView.js').then(m => m.DocumentView),
        'research-analysis': () => import('./components/views/ResearchAnalysisView.js').then(m => m.ResearchAnalysisView),
      };
      if (viewLoaders[viewName]) {
        const ViewClass = await viewLoaders[viewName]();
        this._renderView(ViewClass, viewData);
      } else {
        await this._renderRoadmapView(viewData);
      }
      markPerformance(`render-${viewName}-end`);
      measurePerformance(`render-${viewName}`, `render-${viewName}-start`, `render-${viewName}-end`);
      this.currentView = viewName;
      markPerformance(`view-${viewName}-end`);
      measurePerformance(`view-${viewName}-total`, `view-${viewName}-start`, `view-${viewName}-end`);
      setTimeout(() => {
        initLazyLoading('img[data-src]');
      }, 0);
    } catch (error) {
      showErrorNotification(error, {
        onRetry: () => this._loadView(viewName),
        dismissible: true
      });
      this._showError(`Failed to load ${viewName}`, error.message);
    }
  }
  _renderView(ViewClass, data) {
    const view = new ViewClass(data, this.sessionId);
    const container = view.render();
    this.contentContainer.innerHTML = '';
    this.contentContainer.appendChild(container);
    this.currentViewComponent = view;
  }
  async _renderRoadmapView(data) {
    this.contentContainer.innerHTML = '';
    const chartContainer = document.createElement('div');
    chartContainer.id = 'chart-root';
    chartContainer.style.cssText = 'width: 100%; height: 100%; overflow: auto;';
    this.contentContainer.appendChild(chartContainer);
    try {
      const { GanttChart } = await import('./GanttChart.js');
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid chart data structure');
      }
      if (!data.timeColumns || !Array.isArray(data.timeColumns)) {
        throw new Error('Invalid timeColumns in chart data');
      }
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid data array in chart data');
      }
      const handleTaskClick = async (taskIdentifier) => {
        if (!this.taskAnalyzer) {
          const { TaskAnalyzer } = await import('./analysis/TaskAnalyzer.js');
          this.taskAnalyzer = new TaskAnalyzer();
        }
        this.taskAnalyzer.showAnalysis(taskIdentifier);
      };
      const ganttDataWithSession = { ...data, sessionId: this.sessionId };
      const ganttChart = new GanttChart(
        chartContainer,      // container element
        ganttDataWithSession, // ganttData object (with timeColumns, data, and sessionId)
        this.footerSVG,      // footerSVG decoration (CRITICAL!)
        handleTaskClick      // onTaskClick callback
      );
      ganttChart.render();
      this.currentViewComponent = ganttChart;
    } catch (error) {
      this.contentContainer.innerHTML = `
        <div class="empty-state" style="padding: 2rem; text-align: center;">
          <h2 style="color: var(--color-error);">Failed to Load Roadmap</h2>
          <p style="color: var(--color-text-secondary); margin: 1rem 0;">
            ${error.message}
          </p>
          <button onclick="window.location.reload()"
                  style="padding: 0.75rem 1.5rem; background: var(--color-primary); color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
            Reload Page
          </button>
        </div>
      `;
    }
  }
  _showLoading(viewName) {
    this.contentContainer.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <p style="margin-top: 1rem; color: var(--color-text-secondary);">
          Loading ${viewName}...
        </p>
      </div>
    `;
  }
  _statusScreen({ icon, color, title, message, buttons, footer }) {
    this.contentContainer.innerHTML = `
      <div style="padding: 3rem; text-align: center; max-width: 600px; margin: 0 auto;">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(${color}); margin-bottom: 1.5rem;">
          ${icon}
        </svg>
        <h2 style="margin-bottom: 1rem; color: var(--color-text-primary);">${title}</h2>
        <p style="color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 2rem;">${message}</p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          ${buttons.map(b => `<button id="${b.id || ''}" ${b.onclick ? `onclick="${b.onclick}"` : ''}
            style="padding: 0.75rem 1.5rem; background: ${b.primary ? 'var(--color-primary)' : 'transparent'}; color: ${b.primary ? 'white' : 'var(--color-text-primary)'}; border: ${b.primary ? 'none' : '2px solid var(--color-border)'}; border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
            ${b.text}</button>`).join('')}
        </div>
        ${footer ? `<p style="margin-top: 2rem; font-size: 0.875rem; color: var(--color-text-tertiary);">${footer}</p>` : ''}
      </div>
    `;
  }
  _showGenerationFailed(viewName, errorMessage) {
    const label = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    this._statusScreen({
      icon: '<circle cx="12" cy="12" r="10" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke-width="2"/>',
      color: '--color-error, #ef4444',
      title: `${label} Generation Failed`,
      message: errorMessage,
      buttons: [
        { text: 'Retry This View', primary: true, id: `retry-${viewName}-btn` },
        { text: 'Generate New Content', primary: false, onclick: "window.location.href='/'" }
      ],
      footer: 'If the problem persists, try generating new content with different source files.'
    });
    const retryBtn = document.getElementById(`retry-${viewName}-btn`);
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this._regenerateView(viewName));
    }
  }
  async _regenerateView(viewName) {
    this._showLoading(viewName);
    this._updateTabStatus(viewName, 'processing');
    try {
      const response = await fetch(`/api/content/${this.sessionId}/${viewName}/regenerate`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || `Server error: ${response.status}`);
      }
      const result = await response.json();
      if (result.status === 'completed' && result.data) {
        this.stateManager.setState({ content: { ...this.stateManager.state.content, [viewName]: result.data } });
        this._updateTabStatus(viewName, 'ready');
        await this._loadView(viewName);
      } else {
        this._updateTabStatus(viewName, 'failed');
        this._showGenerationFailed(viewName, result.error || 'Regeneration failed');
      }
    } catch (error) {
      this._updateTabStatus(viewName, 'failed');
      this._showGenerationFailed(viewName, error.message);
    }
  }
  _showError(title, message) {
    this.appRoot.innerHTML = `
      <div class="error-screen">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(--color-error);">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <h1>${title}</h1>
        <p>${message}</p>
        <button onclick="window.location.href='/'">Return to Home</button>
      </div>
    `;
  }
  _validateViewData(viewName, data) {
    if (!data) return false;
    switch (viewName) {
      case 'slides':
        return data.sections && Array.isArray(data.sections) && data.sections.length > 0;
      case 'document':
        return data.sections && Array.isArray(data.sections) && data.sections.length > 0;
      case 'research-analysis':
        return data.themes && Array.isArray(data.themes) && data.themes.length > 0;
      case 'roadmap':
        return data.timeColumns && Array.isArray(data.timeColumns) && data.data && Array.isArray(data.data);
      default:
        return true;
    }
  }
  _getSessionIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sessionId');
  }
  _updateTabStatus(viewName, status) {
    if (this.sidebarNav) {
      this.sidebarNav.updateStatus(viewName, status);
    }
  }
  _startBackgroundStatusPolling() {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    views.forEach(view => this._updateTabStatus(view, 'loading'));

    if (this._useSSE) {
      const sseStarted = this.sseService.start(
        this.sessionId,
        (content) => {
          for (const [viewName, viewStatus] of Object.entries(content)) {
            const internalViewName = viewName === 'researchAnalysis' ? 'research-analysis' : viewName;

            if (viewStatus.status === 'completed' && viewStatus.ready) {
              this._updateTabStatus(internalViewName, 'ready');
              this._fetchAndCacheContent(internalViewName);
            } else if (viewStatus.status === 'error') {
              this._updateTabStatus(internalViewName, 'failed');
            } else if (viewStatus.status === 'generating') {
              this._updateTabStatus(internalViewName, 'processing');
            } else {
              this._updateTabStatus(internalViewName, 'loading');
            }
          }
        },
        (data) => {
          views.forEach(viewName => this._fetchAndCacheContent(viewName));
        },
        (error) => {
          console.warn('[SSE] Error, falling back to polling:', error);
          this._useSSE = false;
          this._startPollingFallback(views);
        }
      );

      if (!sseStarted) {
        this._useSSE = false;
        this._startPollingFallback(views);
      }
    } else {
      this._startPollingFallback(views);
    }
  }

  async _fetchAndCacheContent(viewName) {
    if (this.stateManager.state.content[viewName]) return;
    try {
      const result = await pollUntilReady(this.sessionId, viewName, { maxAttempts: 1 });
      const isValid = this._validateViewData(viewName, result.data);
      if (isValid) {
        this.stateManager.setState({ content: { ...this.stateManager.state.content, [viewName]: result.data } });
      }
    } catch (_) { /* ignore — SSE will retry */ }
  }

  _startPollingFallback(views) {
    views.forEach(viewName => {
      pollUntilReady(this.sessionId, viewName, { baseInterval: 3000, maxAttempts: 100 })
        .then(result => {
          const isValid = this._validateViewData(viewName, result.data);
          if (isValid) {
            this._updateTabStatus(viewName, 'ready');
            if (!this.stateManager.state.content[viewName]) {
              this.stateManager.setState({ content: { ...this.stateManager.state.content, [viewName]: result.data } });
            }
          } else {
            this._updateTabStatus(viewName, 'failed');
          }
        })
        .catch(() => {
          this._updateTabStatus(viewName, 'failed');
        });
    });
  }
  destroy() {
    this.sseService.stopAll();

    if (this.sidebarNav) {
      this.sidebarNav.destroy();
      this.sidebarNav = null;
    }
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const viewer = new ContentViewer();
  viewer.init();
});
