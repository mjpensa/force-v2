import { fetchWithRetry, AppError, ErrorTypes, ErrorSeverity } from './ErrorHandler.js';
export class StateManager {
  constructor() {
    this.state = {
      sessionId: null,
      content: {
        roadmap: null,
        slides: null,
        document: null,
        'research-analysis': null
      }
    };
  }
  setState(updates) {
    Object.assign(this.state, updates);
  }
  async loadView(viewName) {
    if (this.state.content[viewName]) {
      return this.state.content[viewName];
    }

    return this._executeLoadView(viewName);
  }

  async _executeLoadView(viewName) {
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
        if (!data.sections || !Array.isArray(data.sections) || data.sections.length === 0) {
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
        content: { ...this.state.content, [viewName]: data }
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
      throw appError;
    }
  }
}
