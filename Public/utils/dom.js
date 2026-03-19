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

export function safeQuerySelector(selector, context = '') {
  const element = document.querySelector(selector);
  return element;
}

export function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
}

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
