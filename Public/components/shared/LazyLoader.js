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
export function lazyLoadComponent(element, loadCallback, options = {}) {
  const defaultOptions = {
    root: null,
    rootMargin: '100px',
    threshold: 0.01
  };
  const config = { ...defaultOptions, ...options };
  if (!('IntersectionObserver' in window)) {
    loadCallback();
    return null;
  }
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadCallback();
        obs.unobserve(element);
      }
    });
  }, config);
  observer.observe(element);
  return observer;
}
export function preloadImages(urls) {
  return Promise.all(
    urls.map(url => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => {
          resolve(url); // Resolve anyway to not block other images
        };
        img.src = url;
      });
    })
  );
}
export function addLazyLoadingStyles() {
  if (document.getElementById('lazy-loading-styles')) {
    return; // Already added
  }
  const style = document.createElement('style');
  style.id = 'lazy-loading-styles';
  style.textContent = `
    /* Lazy loading image states */
    img[data-src] {
      background: var(--color-background, #f3f4f6);
      min-height: 100px;
    }
    img[data-src].loading {
      opacity: 0.6;
      animation: pulse 1.5s ease-in-out infinite;
    }
    img[data-src].loaded {
      animation: fadeIn 0.3s ease-in;
    }
    img[data-src].error {
      background: var(--color-background, #f3f4f6);
      border: 2px dashed var(--color-border, #e5e7eb);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    img[data-src].error::after {
      content: '⚠️ Image unavailable';
      color: var(--color-text-tertiary, #9ca3af);
      font-size: 0.875rem;
      padding: 1rem;
    }
    @keyframes pulse {
      0%, 100% {
        opacity: 0.6;
      }
      50% {
        opacity: 0.4;
      }
    }
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
export default {
  initLazyLoading,
  lazyLoadComponent,
  preloadImages,
  addLazyLoadingStyles
};
