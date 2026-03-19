import { StateManager } from './components/shared/StateManager.js';
import { SlidesView } from './components/views/SlidesView.js';
import { DocumentView } from './components/views/DocumentView.js';
import { ResearchAnalysisView } from './components/views/ResearchAnalysisView.js';
import { addLazyLoadingStyles, initLazyLoading } from './components/shared/LazyLoader.js';
import { SidebarNav } from './components/SidebarNav.js';
import {
  markPerformance,
  measurePerformance
} from './components/shared/Performance.js';
import {
  initAccessibility,
  announceToScreenReader
} from './components/shared/Accessibility.js';
import {
  showErrorNotification
} from './components/shared/ErrorHandler.js';
import { loadFooterSVG } from './Utils.js'; // For GanttChart footer
import { TaskAnalyzer } from './analysis/TaskAnalyzer.js'; // For task clicks

class PollingService {
  constructor() {
    this.polls = new Map(); // viewName -> { timeout, attempt, callback }
    this.config = {
      baseInterval: 2000,
      maxInterval: 15000,
      maxAttempts: 120,
      backoffFactor: 1.2
    };
  }

  start(viewName, callback, options = {}) {
    this.stop(viewName);

    const config = { ...this.config, ...options };
    this.polls.set(viewName, {
      timeout: null,
      attempt: 0,
      callback,
      config
    });

    this._poll(viewName);
  }

  stop(viewName) {
    const poll = this.polls.get(viewName);
    if (poll?.timeout) {
      clearTimeout(poll.timeout);
    }
    this.polls.delete(viewName);
  }

  stopAll() {
    for (const viewName of this.polls.keys()) {
      this.stop(viewName);
    }
  }

  _poll(viewName) {
    const poll = this.polls.get(viewName);
    if (!poll) return;

    const { callback, config } = poll;

    if (poll.attempt >= config.maxAttempts) {
      callback({ status: 'timeout', viewName });
      this.stop(viewName);
      return;
    }

    Promise.resolve(callback({ status: 'polling', attempt: poll.attempt, viewName }))
      .then(result => {
        if (result?.done) {
          this.stop(viewName);
          return;
        }

        const interval = Math.min(
          config.baseInterval * Math.pow(config.backoffFactor, Math.floor(poll.attempt / 5)),
          config.maxInterval
        );

        poll.attempt++;
        poll.timeout = setTimeout(() => this._poll(viewName), interval);
      })
      .catch(() => {
        poll.attempt++;
        poll.timeout = setTimeout(
          () => this._poll(viewName),
          Math.min(config.baseInterval * 2, config.maxInterval)
        );
      });
  }
}

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
        const data = event.data ? JSON.parse(event.data) : { message: 'Unknown error' };
        console.error('[SSE] Server error:', data.message);
        onError?.(data.message);
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

  isConnected(sessionId) {
    const eventSource = this.eventSources.get(sessionId);
    return eventSource?.readyState === EventSource.OPEN;
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
    this.taskAnalyzer = new TaskAnalyzer();

    this.pollingService = new PollingService();
    this.sseService = new SSEService(); // Real-time updates (fallback to polling)
    this._renderQueue = new Map(); // Batch DOM updates
    this._isRendering = false;
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
        validateHeadings: true,
        validateImages: true,
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
      const initTime = measurePerformance('viewer-initialization', 'viewer-init-start', 'viewer-init-end');
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
      sessionId: this.sessionId,
      onNavigate: (view) => {
      }
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
        const apiTime = measurePerformance(`api-${viewName}`, `api-${viewName}-start`, `api-${viewName}-end`);
      } catch (error) {
        const isProcessing = error.message.includes('processing') ||
                            error.message.includes('being generated') ||
                            error.details?.processing === true;
        const hasEmptyContent = error.details?.emptyContent === true || error.details?.emptyData === true;
        const canRetry = error.details?.canRetry === true || error.details?.emptyData === true;
        const isApiError = error.details?.apiError === true;
        if (isProcessing) {
          this._showProcessing(viewName);
          return;
        }
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
      const viewClasses = { slides: SlidesView, document: DocumentView, 'research-analysis': ResearchAnalysisView };
      if (viewClasses[viewName]) {
        this._renderView(viewClasses[viewName], viewData);
      } else {
        await this._renderRoadmapView(viewData);
      }
      markPerformance(`render-${viewName}-end`);
      const renderTime = measurePerformance(`render-${viewName}`, `render-${viewName}-start`, `render-${viewName}-end`);
      this.currentView = viewName;
      markPerformance(`view-${viewName}-end`);
      const totalTime = measurePerformance(`view-${viewName}-total`, `view-${viewName}-start`, `view-${viewName}-end`);
      setTimeout(() => {
        initLazyLoading('img[data-src]');
      }, 0);
    } catch (error) {
      const isLegacyLimitation = error.message && error.message.includes('not available for legacy charts');
      if (isLegacyLimitation) {
        this._showLegacyChartLimitation(viewName);
      } else {
        showErrorNotification(error, {
          onRetry: () => this._loadView(viewName),
          dismissible: true
        });
        this._showError(`Failed to load ${viewName}`, error.message);
      }
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
      const handleTaskClick = (taskIdentifier) => {
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
  _showProcessing(viewName) {
    if (this._processingPollTimeouts) {
      Object.keys(this._processingPollTimeouts).forEach(key => {
        clearTimeout(this._processingPollTimeouts[key]);
        delete this._processingPollTimeouts[key];
      });
    } else {
      this._processingPollTimeouts = {};
    }
    if (!this._processingStartTimes) {
      this._processingStartTimes = {};
    }
    this._processingStartTimes[viewName] = Date.now();
    const viewNameCapitalized = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    this.contentContainer.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <h2>Generating ${viewNameCapitalized}</h2>
        <p style="margin-top: 1rem; color: var(--color-text-secondary);">
          Your ${viewName} content is being generated. This usually takes 30-60 seconds.
        </p>
        <p id="processing-status" style="margin-top: 0.5rem; color: var(--color-text-tertiary); font-size: 0.875rem;">
          Checking status...
        </p>
        <div id="processing-progress" style="margin-top: 1rem; width: 200px; height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden;">
          <div id="progress-bar" style="width: 0%; height: 100%; background: var(--color-primary); transition: width 0.3s ease;"></div>
        </div>
        <div style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: center;">
          <button id="cancel-generation-btn" style="padding: 0.75rem 1.5rem; background: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: 0.5rem; cursor: pointer;">
            Cancel
          </button>
        </div>
      </div>
    `;
    const cancelBtn = document.getElementById('cancel-generation-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (this._processingPollTimeouts[viewName]) {
          clearTimeout(this._processingPollTimeouts[viewName]);
          delete this._processingPollTimeouts[viewName];
        }
        window.location.href = '/';
      });
    }
    this._pollForProcessingComplete(viewName);
  }
  async _pollForProcessingComplete(viewName, attempt = 0) {
    const MAX_ATTEMPTS = 120; // 5 minutes with increasing intervals
    const BASE_INTERVAL = 2000; // Start at 2 seconds
    const MAX_INTERVAL = 10000; // Cap at 10 seconds
    const EXPECTED_DURATION = 60000; // Expected 60 seconds for generation
    const interval = Math.min(BASE_INTERVAL * Math.pow(1.2, Math.floor(attempt / 5)), MAX_INTERVAL);
    if (attempt >= MAX_ATTEMPTS) {
      this._showGenerationTimeout(viewName);
      return;
    }
    const statusEl = document.getElementById('processing-status');
    const progressBar = document.getElementById('progress-bar');
    const startTime = this._processingStartTimes?.[viewName] || Date.now();
    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (statusEl) {
      statusEl.textContent = `Checking status... (${elapsedSeconds}s elapsed)`;
    }
    if (progressBar) {
      const progress = Math.min((elapsedMs / EXPECTED_DURATION) * 100, 95); // Cap at 95% until complete
      progressBar.style.width = `${progress}%`;
    }
    try {
      const response = await fetch(`/api/content/${this.sessionId}/${viewName}`);
      const data = await response.json();
      if (data.status === 'completed' && data.data) {
        const isValidData = this._validateViewData(viewName, data.data);
        if (!isValidData) {
          if (this._processingPollTimeouts && this._processingPollTimeouts[viewName]) {
            delete this._processingPollTimeouts[viewName];
          }
          this._updateTabStatus(viewName, 'failed');
          this._showGenerationFailed(viewName, `${viewName} generation completed but produced invalid content. Please try regenerating.`);
          return;
        }
        if (this._processingPollTimeouts && this._processingPollTimeouts[viewName]) {
          delete this._processingPollTimeouts[viewName];
        }
        const progressBar = document.getElementById('progress-bar');
        const statusEl = document.getElementById('processing-status');
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.style.background = 'var(--color-success, #10b981)';
        }
        if (statusEl) {
          statusEl.textContent = 'Generation complete! Loading...';
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        this.stateManager.setState({
          content: { ...this.stateManager.state.content, [viewName]: data.data }
        });
        this._updateTabStatus(viewName, 'ready');
        await this._loadView(viewName);
        return;
      }
      if (data.status === 'error') {
        if (this._processingPollTimeouts && this._processingPollTimeouts[viewName]) {
          delete this._processingPollTimeouts[viewName];
        }
        this._updateTabStatus(viewName, 'failed');
        this._showGenerationFailed(viewName, data.error || 'Content generation failed. Please try again.');
        return;
      }
      this._processingPollTimeouts[viewName] = setTimeout(() => {
        this._pollForProcessingComplete(viewName, attempt + 1);
      }, interval);
    } catch (error) {
      this._processingPollTimeouts[viewName] = setTimeout(() => {
        this._pollForProcessingComplete(viewName, attempt + 1);
      }, interval * 2);
    }
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
  _showGenerationTimeout(viewName) {
    const label = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    this._statusScreen({
      icon: '<circle cx="12" cy="12" r="10" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke-width="2"/>',
      color: '--color-warning, #f59e0b',
      title: `${label} Generation Taking Too Long`,
      message: 'The content is still being generated but it\'s taking longer than expected. This could be due to complex source material or server load.',
      buttons: [
        { id: 'continue-waiting-btn', text: 'Continue Waiting', primary: true },
        { id: 'retry-generation-btn', text: 'Retry Generation' }
      ]
    });
    document.getElementById('continue-waiting-btn')?.addEventListener('click', () => this._showProcessing(viewName));
    document.getElementById('retry-generation-btn')?.addEventListener('click', () => this._retryGeneration(viewName));
  }
  _showGenerationFailed(viewName, errorMessage) {
    const label = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    this._statusScreen({
      icon: '<circle cx="12" cy="12" r="10" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke-width="2"/>',
      color: '--color-error, #ef4444',
      title: `${label} Generation Failed`,
      message: errorMessage,
      buttons: [
        { id: 'retry-generation-btn', text: 'Retry Generation', primary: true },
        { text: 'Generate New Content', onclick: "window.location.href='/'" }
      ],
      footer: 'If the problem persists, try generating new content with different source files.'
    });
    document.getElementById('retry-generation-btn')?.addEventListener('click', () => this._retryGeneration(viewName));
  }
  _retryGeneration(viewName) {
    const label = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    this._statusScreen({
      icon: '<path d="M21 12a9 9 0 11-6.219-8.56" stroke-width="2"/><polyline points="21 3 21 9 15 9" stroke-width="2"/>',
      color: '--color-primary',
      title: `Regenerate ${label}`,
      message: 'To regenerate this content, you\'ll need to upload your research files again. This ensures the AI has the full source material to work with.',
      buttons: [
        { text: 'Upload Files & Regenerate', primary: true, onclick: "window.location.href='/'" }
      ]
    });
  }
  _showLegacyChartLimitation(viewName) {
    const label = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    this._statusScreen({
      icon: '<circle cx="12" cy="12" r="10" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke-width="2"/><line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2"/>',
      color: '--color-warning, #f59e0b',
      title: `${label} View Not Available`,
      message: `This chart was generated using the older system and only supports the <strong>Roadmap view</strong>. The ${viewName} view is only available for newly generated content.`,
      buttons: [
        { text: 'View Roadmap', primary: true, onclick: "window.location.hash='roadmap'" },
        { text: 'Generate New Content', onclick: "window.location.href='/'" }
      ],
      footer: 'Tip: Generate new content to access all three views (Roadmap, Slides, and Document)'
    });
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
    if (this.stateManager.state.content[viewName]) {
      return;
    }

    try {
      const response = await fetch(`/api/content/${this.sessionId}/${viewName}`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.status === 'completed' && data.data) {
        const isValidData = this._validateViewData(viewName, data.data);
        if (isValidData) {
          this.stateManager.batchSetState({
            content: { ...this.stateManager.state.content, [viewName]: data.data }
          });
        }
      }
    } catch (error) {
      console.error(`[SSE] Failed to fetch content for ${viewName}:`, error);
    }
  }

  _startPollingFallback(views) {
    views.forEach(viewName => {
      this.pollingService.start(`bg-${viewName}`, async ({ status, attempt }) => {
        if (status === 'timeout') {
          this._updateTabStatus(viewName, 'failed');
          return { done: true };
        }

        try {
          const response = await fetch(`/api/content/${this.sessionId}/${viewName}`);
          if (!response.ok) {
            this._updateTabStatus(viewName, 'failed');
            return { done: true };
          }

          const data = await response.json();
          if (data.status === 'completed' && data.data) {
            const isValidData = this._validateViewData(viewName, data.data);
            if (!isValidData) {
              this._updateTabStatus(viewName, 'failed');
              return { done: true };
            }
            this._updateTabStatus(viewName, 'ready');
            if (!this.stateManager.state.content[viewName]) {
              this.stateManager.batchSetState({
                content: { ...this.stateManager.state.content, [viewName]: data.data }
              });
            }
            return { done: true };
          }

          if (data.status === 'error') {
            this._updateTabStatus(viewName, 'failed');
            return { done: true };
          }

          if (data.status === 'processing' || data.status === 'pending') {
            this._updateTabStatus(viewName, 'processing');
          } else {
            this._updateTabStatus(viewName, 'loading');
          }

          return { done: false };
        } catch (error) {
          return { done: false }; // Continue polling on network errors
        }
      }, { baseInterval: 3000, maxAttempts: 100 });
    });
  }
  destroy() {
    this.sseService.stopAll();
    this.pollingService.stopAll();

    if (this._processingPollTimeouts) {
      Object.values(this._processingPollTimeouts).forEach(timeout => clearTimeout(timeout));
      this._processingPollTimeouts = {};
    }
    if (this._processingStartTimes) {
      this._processingStartTimes = {};
    }
    if (this.sidebarNav) {
      this.sidebarNav.destroy();
      this.sidebarNav = null;
    }
    this._renderQueue.clear();
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const viewer = new ContentViewer();
  viewer.init();
});
