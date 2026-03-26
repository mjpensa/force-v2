/**
 * Safely get an element by ID
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function safeGetElement(id) {
  return document.getElementById(id);
}

export function safeQuerySelector(selector) {
  return document.querySelector(selector);
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

/**
 * Create a glassmorphic three-dot dropdown menu.
 * @param {Object} config
 * @param {string} [config.containerClass] - Additional class for the container
 * @param {string} [config.triggerLabel='Open menu'] - aria-label for the trigger button
 * @param {Array<Object|'divider'>} config.items - Menu items or 'divider' strings
 * @param {number} [config.minWidth] - Override dropdown min-width in px
 * @returns {{ container: HTMLElement, dropdown: HTMLElement, trigger: HTMLElement, open: Function, close: Function }}
 */
export function createDropdownMenu(config) {
  const { containerClass = '', triggerLabel = 'Open menu', items = [], minWidth } = config;

  const container = document.createElement('div');
  container.className = `dropdown-menu ${containerClass}`.trim();

  const trigger = document.createElement('button');
  trigger.className = 'dropdown-menu-trigger';
  trigger.setAttribute('aria-label', triggerLabel);
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = '<span class="menu-dot"></span><span class="menu-dot"></span><span class="menu-dot"></span>';

  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown-menu-panel';
  dropdown.setAttribute('role', 'menu');
  if (minWidth) dropdown.style.minWidth = `${minWidth}px`;

  for (const itemDef of items) {
    if (itemDef === 'divider') {
      const divider = document.createElement('div');
      divider.className = 'menu-divider';
      divider.setAttribute('role', 'separator');
      dropdown.appendChild(divider);
      continue;
    }
    const item = document.createElement('button');
    if (itemDef.id) item.id = itemDef.id;
    item.className = itemDef.className || 'menu-item';
    item.setAttribute('role', 'menuitem');
    item.setAttribute('aria-label', itemDef.ariaLabel || itemDef.text);
    if (itemDef.keepOpen) item.dataset.keepOpen = 'true';
    item.innerHTML = `<span class="menu-item-icon">${itemDef.icon || ''}</span><span class="menu-item-text">${itemDef.text}</span>`;
    if (itemDef.onClick) item.addEventListener('click', itemDef.onClick);
    dropdown.appendChild(item);
  }

  container.appendChild(trigger);
  container.appendChild(dropdown);

  let isOpen = false;
  const open = () => { isOpen = true; dropdown.classList.add('open'); trigger.setAttribute('aria-expanded', 'true'); };
  const close = () => { isOpen = false; dropdown.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); };

  trigger.addEventListener('click', (e) => { e.stopPropagation(); isOpen ? close() : open(); });
  const outsideClickHandler = (e) => {
    if (isOpen && !dropdown.contains(e.target) && !trigger.contains(e.target)) close();
  };
  document.addEventListener('click', outsideClickHandler);
  dropdown.addEventListener('click', (e) => {
    const menuItem = e.target.closest('.menu-item');
    if (menuItem && !menuItem.dataset.keepOpen) close();
  });

  const destroy = () => { document.removeEventListener('click', outsideClickHandler); };

  return { container, dropdown, trigger, open, close, destroy };
}
