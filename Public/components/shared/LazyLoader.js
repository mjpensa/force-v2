export function initLazyLoading(selector = 'img[data-src]', options = {}) {
  const defaultOptions = {
    root: null,
    rootMargin: '50px', // Start loading 50px before image enters viewport
    threshold: 0.01
  };
  const config = { ...defaultOptions, ...options };
  if (!('IntersectionObserver' in window)) {
    loadAllImages(selector);
    return null;
  }
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        loadImage(img);
        observer.unobserve(img);
      }
    });
  }, config);
  const images = document.querySelectorAll(selector);
  images.forEach(img => imageObserver.observe(img));
  return imageObserver;
}
function loadImage(img) {
  const src = img.getAttribute('data-src');
  const srcset = img.getAttribute('data-srcset');
  if (!src) {
    return;
  }
  img.classList.add('loading');
  const preloader = new Image();
  preloader.onload = () => {
    img.src = src;
    if (srcset) {
      img.srcset = srcset;
    }
    img.classList.remove('loading');
    img.classList.add('loaded');
  };
  preloader.onerror = () => {
    img.classList.remove('loading');
    img.classList.add('error');
    img.alt = img.alt || 'Image failed to load';
  };
  preloader.src = src;
  if (srcset) {
    preloader.srcset = srcset;
  }
}
function loadAllImages(selector) {
  const images = document.querySelectorAll(selector);
  images.forEach(img => loadImage(img));
}
export function addLazyLoadingStyles() {
  if (document.getElementById('lazy-loading-styles')) return;
  const style = document.createElement('style');
  style.id = 'lazy-loading-styles';
  style.textContent =
    'img[data-src]{background:var(--color-background,#f3f4f6);min-height:100px}' +
    'img[data-src].loading{opacity:.6;animation:pulse 1.5s ease-in-out infinite}' +
    'img[data-src].loaded{animation:fadeIn .3s ease-in}' +
    'img[data-src].error{background:var(--color-background,#f3f4f6);border:2px dashed var(--color-border,#e5e7eb);display:inline-flex;align-items:center;justify-content:center}' +
    'img[data-src].error::after{content:"\\26A0\\FE0F Image unavailable";color:var(--color-text-tertiary,#9ca3af);font-size:.875rem;padding:1rem}' +
    '@keyframes pulse{0%,100%{opacity:.6}50%{opacity:.4}}' +
    '@keyframes fadeIn{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(style);
}
