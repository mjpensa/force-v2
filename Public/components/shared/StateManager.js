import { fetchWithRetry, AppError, ErrorTypes, ErrorSeverity } from './ErrorHandler.js';
export class StateManager {
  constructor() {
    this.state = {
      sessionId: null,
      currentView: 'roadmap',  // 'roadmap' | 'slides' | 'document' | 'research-analysis'
      content: {
        roadmap: null,
        slides: null,
        document: null,
        'research-analysis': null
      },
      loading: {
        roadmap: false,
        slides: false,
        document: false,
        'research-analysis': false
      },
      errors: {
        roadmap: null,
        slides: null,
        document: null,
        'research-analysis': null
      },
      ui: {
        menuOpen: false,
        fullscreen: false
      }
    };
    this.listeners = [];
    this.viewListeners = {};  // View-specific listeners

    // Performance optimizations: request deduplication
    this._pendingRequests = new Map();

    // Batch state updates for performance
    this._pendingStateUpdates = [];
    this._updateScheduled = false;
  }
  getState() {
    return { ...this.state };
  }
  setState(updates) {
    const previousState = { ...this.state };
    this.state = this.deepMerge(this.state, updates);
    this.notifyListeners(previousState, this.state);
  }

  // Batch multiple state updates into a single render cycle for performance
  batchSetState(updates) {
    this._pendingStateUpdates.push(updates);
    if (!this._updateScheduled) {
      this._updateScheduled = true;
      // Use microtask to batch updates within the same event loop
      queueMicrotask(() => this._flushStateUpdates());
    }
  }

  _flushStateUpdates() {
    if (this._pendingStateUpdates.length === 0) {
      this._updateScheduled = false;
      return;
    }

    const previousState = { ...this.state };

    // Merge all pending updates into a single state change
    for (const updates of this._pendingStateUpdates) {
      this.state = this.deepMerge(this.state, updates);
    }

    this._pendingStateUpdates = [];
    this._updateScheduled = false;

    // Single notification for all batched updates
    this.notifyListeners(previousState, this.state);
  }
  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  subscribeToView(viewName, listener) {
    if (!this.viewListeners[viewName]) {
      this.viewListeners[viewName] = [];
    }
    this.viewListeners[viewName].push(listener);
    return () => {
      this.viewListeners[viewName] = this.viewListeners[viewName].filter(
        l => l !== listener
      );
    };
  }
  notifyListeners(previousState, newState) {
    this.listeners.forEach(listener => {
      try {
        listener(newState, previousState);
      } catch (error) {
      }
    });
    for (const viewName in this.viewListeners) {
      if (newState.content[viewName] !== previousState.content[viewName]) {
        this.viewListeners[viewName].forEach(listener => {
          try {
            listener(newState.content[viewName], previousState.content[viewName]);
          } catch (error) {
          }
        });
      }
    }
  }
  async loadView(viewName, forceRefresh = false) {
    // Return cached content if available and not forcing refresh
    if (!forceRefresh && this.state.content[viewName]) {
      return this.state.content[viewName];
    }

    // Request deduplication: reuse pending request for same view
    const requestKey = `${this.state.sessionId}:${viewName}`;
    if (!forceRefresh && this._pendingRequests.has(requestKey)) {
      return this._pendingRequests.get(requestKey);
    }

    // Create and track the request promise
    const requestPromise = this._executeLoadView(viewName, forceRefresh);
    this._pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up pending request
      this._pendingRequests.delete(requestKey);
    }
  }

  async _executeLoadView(viewName, forceRefresh) {
    if (forceRefresh) {
      this.setState({
        content: { ...this.state.content, [viewName]: null },
        errors: { ...this.state.errors, [viewName]: null }
      });
    }
    this.setState({
      loading: { ...this.state.loading, [viewName]: true },
      errors: { ...this.state.errors, [viewName]: null }
    });
    try {
      const response = await fetchWithRetry(
        `/api/content/${this.state.sessionId}/${viewName}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      if (!response.ok) {
        let errorType = ErrorTypes.API;
        let severity = ErrorSeverity.MEDIUM;
        if (response.status === 404) {
          errorType = ErrorTypes.NOT_FOUND;
        } else if (response.status === 403) {
          errorType = ErrorTypes.PERMISSION;
        } else if (response.status >= 500) {
          severity = ErrorSeverity.HIGH;
        }
        throw new AppError(
          `Failed to load ${viewName}: ${response.statusText}`,
          errorType,
          severity,
          { status: response.status, viewName }
        );
      }
      const result = await response.json();
      if (result.status === 'processing' || result.status === 'pending') {
        throw new AppError(
          `${viewName} is still being generated. Please wait...`,
          ErrorTypes.API,
          ErrorSeverity.LOW,
          { viewName, processing: true }
        );
      }
      if (result.status === 'error') {
        throw new AppError(
          result.error || `Failed to generate ${viewName}`,
          ErrorTypes.API,
          ErrorSeverity.HIGH,
          { viewName, apiError: true }
        );
      }
      const data = result.data;
      if (!data) {
        throw new AppError(
          `No data received for ${viewName}`,
          ErrorTypes.API,
          ErrorSeverity.MEDIUM,
          { viewName, emptyData: true }
        );
      }
      if (viewName === 'document') {
        if (!data.sections || !Array.isArray(data.sections) || data.sections.length === 0) {
          throw new AppError(
            `Document generation completed but produced empty content. Please try regenerating.`,
            ErrorTypes.VALIDATION,
            ErrorSeverity.MEDIUM,
            { viewName, emptyContent: true, canRetry: true }
          );
        }
      }
      if (viewName === 'slides') {
        if (!data.slides || !Array.isArray(data.slides) || data.slides.length === 0) {
          throw new AppError(
            `Slides generation completed but produced empty content. Please try regenerating.`,
            ErrorTypes.VALIDATION,
            ErrorSeverity.MEDIUM,
            { viewName, emptyContent: true, canRetry: true }
          );
        }
      }
      if (viewName === 'research-analysis') {
        if (!data.themes || !Array.isArray(data.themes) || data.themes.length === 0) {
          throw new AppError(
            `Research analysis generation completed but produced empty content. Please try regenerating.`,
            ErrorTypes.VALIDATION,
            ErrorSeverity.MEDIUM,
            { viewName, emptyContent: true, canRetry: true }
          );
        }
      }
      this.setState({
        content: { ...this.state.content, [viewName]: data },
        loading: { ...this.state.loading, [viewName]: false }
      });
      return data;
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError(
            error.message || `Failed to load ${viewName}`,
            ErrorTypes.UNKNOWN,
            ErrorSeverity.MEDIUM,
            { viewName, originalError: error }
          );
      this.setState({
        loading: { ...this.state.loading, [viewName]: false },
        errors: { ...this.state.errors, [viewName]: appError.message }
      });
      throw appError;
    }
  }
  switchView(viewName) {
    if (this.state.currentView === viewName) {
      return;  // Already on this view
    }
    this.setState({ currentView: viewName });
    window.location.hash = viewName;
  }
  initializeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session') || params.get('id'); // Support both
    const hash = window.location.hash.replace('#', '') || 'roadmap';
    if (!sessionId) {
      throw new Error('No session ID in URL');
    }
    this.setState({
      sessionId,
      currentView: hash
    });
  }
  async prefetchOtherViews(currentView) {
    const views = ['roadmap', 'slides', 'document', 'research-analysis'];
    const otherViews = views.filter(v => v !== currentView);

    // Use requestIdleCallback for non-critical prefetching (falls back to setTimeout)
    const scheduleIdleTask = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000));

    scheduleIdleTask(() => {
      const viewsToFetch = otherViews.filter(view =>
        !this.state.content[view] && !this._pendingRequests.has(`${this.state.sessionId}:${view}`)
      );

      if (viewsToFetch.length === 0) {
        return;
      }

      // Prefetch in parallel with lower priority
      Promise.allSettled(
        viewsToFetch.map(view => this.loadView(view))
      );
    }, { timeout: 2000 });
  }
  async refreshView(viewName) {
    this.setState({
      content: { ...this.state.content, [viewName]: null }
    });
    return await this.loadView(viewName);
  }
  clear() {
    // Clear pending requests
    this._pendingRequests.clear();
    this._pendingStateUpdates = [];
    this._updateScheduled = false;

    this.setState({
      sessionId: null,
      currentView: 'roadmap',
      content: { roadmap: null, slides: null, document: null, 'research-analysis': null },
      loading: { roadmap: false, slides: false, document: false, 'research-analysis': false },
      errors: { roadmap: null, slides: null, document: null, 'research-analysis': null }
    });
  }
  toggleMenu() {
    this.setState({
      ui: { ...this.state.ui, menuOpen: !this.state.ui.menuOpen }
    });
  }
  toggleFullscreen() {
    this.setState({
      ui: { ...this.state.ui, fullscreen: !this.state.ui.fullscreen }
    });
  }
}
export const state = new StateManager();
