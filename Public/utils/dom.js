/**
 * DOM utilities
 */

/**
 * Safely get an element by ID
 * @param {string} id - Element ID
 * @param {string} context - Context for logging
 * @returns {HTMLElement|null}
 */
export function safeGetElement(id, context = '') {
  const element = document.getElementById(id);
  return element;
}

/**
 * Safely query select an element
 * @param {string} selector - CSS selector
 * @param {string} context - Context for logging
 * @returns {Element|null}
 */
export function safeQuerySelector(selector, context = '') {
  const element = document.querySelector(selector);
  return element;
}

/**
 * Check if a URL is safe (http/https)
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
}

/**
 * Create a button element with the given configuration
 * @param {Object} config - Button configuration
 * @param {string} config.id - Button ID
 * @param {string} config.className - CSS class name
 * @param {string} config.text - Button text content
 * @param {string} [config.title] - Tooltip text
 * @param {string} [config.ariaLabel] - Accessibility label
 * @param {Object} [config.style] - Inline styles
 * @param {Object} [config.attributes] - Additional attributes
 * @returns {HTMLButtonElement}
 */
export function createButton(config) {
  const btn = document.createElement('button');
  if (config.id) btn.id = config.id;
  if (config.className) btn.className = config.className;
  if (config.text) btn.textContent = config.text;
  if (config.title) btn.title = config.title;
  if (config.ariaLabel) btn.setAttribute('aria-label', config.ariaLabel);
  if (config.style) {
    Object.assign(btn.style, config.style);
  }
  if (config.attributes) {
    Object.entries(config.attributes).forEach(([key, value]) => {
      btn.setAttribute(key, value);
    });
  }
  return btn;
}

/**
 * Create a modal dialog with standard structure and close behavior
 * @param {Object} config - Modal configuration
 * @param {string} [config.id] - Modal overlay ID
 * @param {string} [config.title] - Modal title text
 * @param {string} [config.content] - Initial body content HTML
 * @param {string} [config.bodyId] - ID for the modal body element
 * @param {Array} [config.actions] - Header action buttons [{id, label, title, className}]
 * @param {boolean} [config.showSpinner] - Show loading spinner initially
 * @returns {{overlay: HTMLElement, body: HTMLElement, close: Function}}
 */
export function createModal(config = {}) {
  const {
    id = 'modal-overlay',
    title = '',
    content = '',
    bodyId = 'modal-body-content',
    actions = [],
    showSpinner = false
  } = config;

  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'modal-overlay';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  const actionsHtml = actions.map(action =>
    `<button class="${action.className || 'modal-action-btn'}" id="${action.id}" title="${action.title || ''}">${action.label}</button>`
  ).join('');

  const bodyContent = showSpinner ? '<div class="modal-spinner"></div>' : content;

  modalContent.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <div class="modal-actions">
        ${actionsHtml}
        <button class="modal-close" id="${id}-close-btn">&times;</button>
      </div>
    </div>
    <div class="modal-body" id="${bodyId}">${bodyContent}</div>
  `;

  overlay.appendChild(modalContent);

  const close = () => overlay.remove();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const closeBtn = modalContent.querySelector(`#${id}-close-btn`);
  closeBtn?.addEventListener('click', close);

  document.body.appendChild(overlay);

  return {
    overlay,
    body: modalContent.querySelector(`#${bodyId}`),
    close
  };
}
