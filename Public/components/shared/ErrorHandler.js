export const ErrorTypes = {
  NETWORK: 'NetworkError',
  API: 'APIError',
  VALIDATION: 'ValidationError',
  TIMEOUT: 'TimeoutError',
  NOT_FOUND: 'NotFoundError',
  PERMISSION: 'PermissionError',
  UNKNOWN: 'UnknownError'
};
export const ErrorSeverity = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };
export class AppError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, severity = ErrorSeverity.MEDIUM, details = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}
export async function retryWithBackoff(fn, options = {}) {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, backoffFactor = 2 } = options;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) throw error;
      const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
export async function fetchWithRetry(url, options = {}) {
  return retryWithBackoff(async () => {
    let response;
    try {
      response = await fetch(url, options);
    } catch (networkError) {
      // Network failures (offline, DNS error, CORS, etc.) throw TypeError
      throw new AppError(
        'Network error: Unable to connect to server',
        ErrorTypes.NETWORK,
        ErrorSeverity.HIGH,
        { url, originalError: networkError.message }
      );
    }

    // Retry on server errors (5xx)
    if (response.status >= 500) {
      throw new AppError(
        `Server error: ${response.status}`,
        ErrorTypes.API,
        ErrorSeverity.HIGH,
        { status: response.status, url, retryable: true }
      );
    }

    return response;
  }, { maxRetries: 3, initialDelay: 1000 });
}
export function logError(error, context = {}) {
}
export function showErrorNotification(error, options = {}) {
  const { onRetry = null, dismissible = true } = options;
  const existing = document.getElementById('error-notification');
  if (existing) existing.remove();
  const messages = {
    [ErrorTypes.NETWORK]: { title: 'Connection Error', message: 'Unable to connect. Check your connection.' },
    [ErrorTypes.API]: { title: 'Server Error', message: 'Server error. Try again.' },
    [ErrorTypes.TIMEOUT]: { title: 'Timeout', message: 'Request timed out.' },
    [ErrorTypes.NOT_FOUND]: { title: 'Not Found', message: 'The requested resource was not found.' },
    [ErrorTypes.PERMISSION]: { title: 'Permission Denied', message: 'You do not have permission to access this resource.' }
  };
  const { title, message } = messages[error.type] || { title: 'Error', message: error.message || 'Something went wrong.' };
  const notification = document.createElement('div');
  notification.id = 'error-notification';
  notification.setAttribute('role', 'alert');
  notification.style.cssText = `position:fixed;top:20px;right:20px;max-width:400px;background:white;border-left:4px solid #ef4444;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:1rem;z-index:10000;`;
  const removeNotification = () => notification.remove();
  notification.innerHTML = `
    <h4 style="margin:0 0 0.5rem;color:#ef4444;font-size:1rem;">${title}</h4>
    <p style="margin:0 0 1rem;color:#6b7280;font-size:0.875rem;">${message}</p>
    <div style="display:flex;gap:0.5rem;">
      ${onRetry ? '<button class="retry-btn" style="background:#3b82f6;color:white;border:none;padding:0.5rem 1rem;border-radius:4px;cursor:pointer;">Retry</button>' : ''}
      ${dismissible ? '<button class="dismiss-btn" style="background:transparent;color:#6b7280;border:1px solid;padding:0.5rem 1rem;border-radius:4px;cursor:pointer;">Dismiss</button>' : ''}
    </div>`;
  const retryBtn = notification.querySelector('.retry-btn');
  const dismissBtn = notification.querySelector('.dismiss-btn');
  if (retryBtn && onRetry) retryBtn.addEventListener('click', () => { removeNotification(); onRetry(); });
  if (dismissBtn) dismissBtn.addEventListener('click', removeNotification);
  document.body.appendChild(notification);
}
export default { ErrorTypes, ErrorSeverity, AppError, retryWithBackoff, fetchWithRetry, logError, showErrorNotification };
