export class SlidesView {
  constructor(slidesData = null, sessionId = null) {
    this.slidesData = slidesData;
    this.sessionId = sessionId;
    this.currentSlide = 0;
    this.isFullscreen = false;
    this.container = null;
    this.slideElement = null;
    this.keyboardHandler = null;
  }
  render() {
    this.container = document.createElement('div');
    this.container.className = 'slides-view';
    if (!this.slidesData || !this.slidesData.slides || this.slidesData.slides.length === 0) {
      this.container.appendChild(this._renderEmptyState());
      return this.container;
    }
    const slidesContainer = document.createElement('div');
    slidesContainer.className = 'slides-container';
    const slideDisplay = document.createElement('div');
    slideDisplay.className = 'slide-display';
    this.slideElement = this._renderSlide(this.currentSlide);
    slideDisplay.appendChild(this.slideElement);
    const controls = this._renderControls();
    const thumbnails = this._renderThumbnails();
    const keyboardHint = this._renderKeyboardHint();
    slidesContainer.appendChild(slideDisplay);
    slidesContainer.appendChild(controls);
    slidesContainer.appendChild(thumbnails);
    slidesContainer.appendChild(keyboardHint);
    this.container.appendChild(slidesContainer);
    this._setupKeyboardNavigation();
    return this.container;
  }
  _renderSlide(index) {
    const slide = this.slidesData.slides[index];
    const slideEl = document.createElement('div');
    slideEl.className = 'slide';
    slideEl.setAttribute('data-slide-type', slide.type);
    slideEl.setAttribute('data-slide-index', index);
    const pattern = document.createElement('div');
    pattern.className = 'slide-pattern';
    slideEl.appendChild(pattern);
    const content = document.createElement('div');
    content.className = 'slide-content';
    switch (slide.type) {
      case 'textTwoColumn':
        content.appendChild(this._renderTextTwoColumn(slide));
        break;
      case 'textThreeColumn':
        content.appendChild(this._renderTextThreeColumn(slide));
        break;
      case 'textWithCards':
        content.appendChild(this._renderTextWithCards(slide));
        break;
      default:
        content.appendChild(this._renderFallback(slide));
    }
    slideEl.appendChild(content);
    const footer = document.createElement('div');
    footer.className = 'slide-footer';
    footer.innerHTML = `
      <span class="slide-page-number">${index + 1}</span>
      <span class="slide-logo">bip.</span>
    `;
    slideEl.appendChild(footer);
    return slideEl;
  }
  _renderTextTwoColumn(slide) {
    const fragment = document.createDocumentFragment();
    if (slide.section) {
      const section = document.createElement('div');
      section.className = 'slide-section-label';
      section.textContent = slide.section;
      fragment.appendChild(section);
    }
    const layout = document.createElement('div');
    layout.className = 'slide-two-column-layout';
    const leftCol = document.createElement('div');
    leftCol.className = 'slide-left-column';
    const title = document.createElement('h1');
    title.className = 'slide-large-title';
    title.textContent = slide.title;
    leftCol.appendChild(title);
    layout.appendChild(leftCol);
    const rightCol = document.createElement('div');
    rightCol.className = 'slide-right-column';
    const paragraphs = slide.paragraphs || [];
    paragraphs.forEach(para => {
      const p = document.createElement('p');
      p.className = 'slide-paragraph';
      p.textContent = para;
      rightCol.appendChild(p);
    });
    layout.appendChild(rightCol);
    fragment.appendChild(layout);
    return fragment;
  }
  _renderTextThreeColumn(slide) {
    const fragment = document.createDocumentFragment();
    if (slide.section) {
      const section = document.createElement('div');
      section.className = 'slide-section-label';
      section.textContent = slide.section;
      fragment.appendChild(section);
    }
    const layout = document.createElement('div');
    layout.className = 'slide-three-column-layout';
    const titleCol = document.createElement('div');
    titleCol.className = 'slide-title-column';
    const title = document.createElement('h1');
    title.className = 'slide-large-title';
    title.textContent = slide.title;
    titleCol.appendChild(title);
    layout.appendChild(titleCol);
    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'slide-text-columns';
    const columns = slide.columns || [];
    columns.forEach(colText => {
      const col = document.createElement('div');
      col.className = 'slide-text-column';
      const p = document.createElement('p');
      p.textContent = colText;
      col.appendChild(p);
      columnsContainer.appendChild(col);
    });
    layout.appendChild(columnsContainer);
    fragment.appendChild(layout);
    return fragment;
  }
  _renderTextWithCards(slide) {
    const fragment = document.createDocumentFragment();
    if (slide.section) {
      const section = document.createElement('div');
      section.className = 'slide-section-label';
      section.textContent = slide.section;
      fragment.appendChild(section);
    }
    const layout = document.createElement('div');
    layout.className = 'slide-cards-layout';
    const leftCol = document.createElement('div');
    leftCol.className = 'slide-cards-left';
    const title = document.createElement('h1');
    title.className = 'slide-large-title';
    title.textContent = slide.title;
    leftCol.appendChild(title);
    if (slide.content) {
      const contentText = document.createElement('p');
      contentText.className = 'slide-body-text';
      contentText.textContent = slide.content;
      leftCol.appendChild(contentText);
    }
    layout.appendChild(leftCol);
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'slide-cards-grid';
    const cards = slide.cards || [];
    cards.forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'slide-numbered-card';
      const number = document.createElement('div');
      number.className = 'slide-card-number';
      number.textContent = index + 1;
      cardEl.appendChild(number);
      const cardTitle = document.createElement('h3');
      cardTitle.className = 'slide-card-title';
      cardTitle.textContent = card.title;
      cardEl.appendChild(cardTitle);
      if (card.content) {
        const cardContent = document.createElement('p');
        cardContent.className = 'slide-card-content';
        cardContent.textContent = card.content;
        cardEl.appendChild(cardContent);
      }
      cardsGrid.appendChild(cardEl);
    });
    layout.appendChild(cardsGrid);
    fragment.appendChild(layout);
    return fragment;
  }
  _renderFallback(slide) {
    if (slide.paragraphs?.length > 0) return this._renderTextTwoColumn(slide);
    if (slide.columns?.length > 0) return this._renderTextThreeColumn(slide);
    if (slide.cards?.length > 0) return this._renderTextWithCards(slide);
    const fragment = document.createDocumentFragment();
    if (slide.section) {
      const section = document.createElement('div');
      section.className = 'slide-section-label';
      section.textContent = slide.section;
      fragment.appendChild(section);
    }
    if (slide.title) {
      const title = document.createElement('h1');
      title.className = 'slide-large-title';
      title.textContent = slide.title;
      fragment.appendChild(title);
    }
    return fragment;
  }
  _renderControls() {
    const controls = document.createElement('div');
    controls.className = 'slide-controls';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'slide-nav-button';
    prevBtn.innerHTML = '←';
    prevBtn.setAttribute('aria-label', 'Previous slide');
    prevBtn.disabled = this.currentSlide === 0;
    prevBtn.addEventListener('click', () => this.previousSlide());
    const counter = document.createElement('div');
    counter.className = 'slide-counter';
    counter.innerHTML = `
      <span class="current-slide">${this.currentSlide + 1}</span>
      <span class="slide-divider">/</span>
      <span class="total-slides">${this.slidesData.slides.length}</span>
    `;
    const nextBtn = document.createElement('button');
    nextBtn.className = 'slide-nav-button';
    nextBtn.innerHTML = '→';
    nextBtn.setAttribute('aria-label', 'Next slide');
    nextBtn.disabled = this.currentSlide === this.slidesData.slides.length - 1;
    nextBtn.addEventListener('click', () => this.nextSlide());
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'slide-nav-button';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.setAttribute('aria-label', 'Toggle fullscreen');
    fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    const exportBtn = document.createElement('button');
    exportBtn.className = 'slide-export-button';
    exportBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>Download PPT</span>
    `;
    exportBtn.setAttribute('aria-label', 'Download as PowerPoint');
    exportBtn.addEventListener('click', () => this.exportToPowerPoint());
    this.exportButton = exportBtn;
    controls.appendChild(prevBtn);
    controls.appendChild(counter);
    controls.appendChild(nextBtn);
    controls.appendChild(fullscreenBtn);
    controls.appendChild(exportBtn);
    this.prevButton = prevBtn;
    this.nextButton = nextBtn;
    this.counterElement = counter;
    return controls;
  }
  async exportToPowerPoint() {
    if (!this.sessionId) {
      return;
    }
    try {
      this.exportButton.disabled = true;
      this.exportButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
        </svg>
        <span>Exporting...</span>
      `;
      const response = await fetch(`/api/content/${this.sessionId}/slides/export`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export slides');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'presentation.pptx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Failed to export: ${error.message}`);
    } finally {
      this.exportButton.disabled = false;
      this.exportButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>Download PPT</span>
      `;
    }
  }
  _renderThumbnails() {
    const thumbnailsContainer = document.createElement('div');
    thumbnailsContainer.className = 'slide-thumbnails';
    this.slidesData.slides.forEach((slide, index) => {
      const thumbnail = document.createElement('button');
      thumbnail.className = 'thumbnail';
      if (index === this.currentSlide) {
        thumbnail.classList.add('active');
      }
      const preview = document.createElement('div');
      preview.className = 'thumbnail-preview';
      preview.textContent = index + 1;
      thumbnail.appendChild(preview);
      thumbnail.setAttribute('aria-label', `Go to slide ${index + 1}`);
      thumbnail.addEventListener('click', () => this.goToSlide(index));
      thumbnailsContainer.appendChild(thumbnail);
    });
    this.thumbnailsContainer = thumbnailsContainer;
    return thumbnailsContainer;
  }
  _renderKeyboardHint() {
    const hint = document.createElement('div');
    hint.className = 'keyboard-hint';
    hint.innerHTML = `
      Use <kbd>←</kbd> <kbd>→</kbd> or <kbd>Space</kbd> to navigate
      • <kbd>F</kbd> for fullscreen
      • <kbd>Esc</kbd> to exit
    `;
    return hint;
  }
  _renderEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="9" x2="15" y2="9"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="15" x2="13" y2="15"/>
      </svg>
      <h2>No Slides Available</h2>
      <p>Slides have not been generated yet for this session.</p>
    `;
    return emptyState;
  }
  nextSlide() {
    if (this.currentSlide < this.slidesData.slides.length - 1) {
      this.currentSlide++;
      this._updateSlideDisplay();
    }
  }
  previousSlide() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
      this._updateSlideDisplay();
    }
  }
  goToSlide(index) {
    if (index >= 0 && index < this.slidesData.slides.length) {
      this.currentSlide = index;
      this._updateSlideDisplay();
    }
  }
  _updateSlideDisplay() {
    const newSlide = this._renderSlide(this.currentSlide);
    this.slideElement.replaceWith(newSlide);
    this.slideElement = newSlide;
    this.prevButton.disabled = this.currentSlide === 0;
    this.nextButton.disabled = this.currentSlide === this.slidesData.slides.length - 1;
    this.counterElement.querySelector('.current-slide').textContent = this.currentSlide + 1;
    const thumbnails = this.thumbnailsContainer.querySelectorAll('.thumbnail');
    thumbnails.forEach((thumb, index) => {
      thumb.classList.toggle('active', index === this.currentSlide);
    });
    const activeThumbnail = thumbnails[this.currentSlide];
    if (activeThumbnail) {
      activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }
  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    this.container.classList.toggle('fullscreen', this.isFullscreen);
    if (this.isFullscreen) {
      if (this.container.requestFullscreen) {
        this.container.requestFullscreen().catch(err => {
        });
      }
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
  }
  _setupKeyboardNavigation() {
    this.keyboardHandler = (e) => {
      if (!this.container || !this.container.isConnected) {
        return;
      }
      // Don't intercept keyboard events from form elements
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' || target.isContentEditable) {
        return;
      }
      switch (e.key) {
        case 'ArrowRight':
        case ' ': // Space
          e.preventDefault();
          this.nextSlide();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.previousSlide();
          break;
        case 'Home':
          e.preventDefault();
          this.goToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          this.goToSlide(this.slidesData.slides.length - 1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'Escape':
          if (this.isFullscreen) {
            e.preventDefault();
            this.toggleFullscreen();
          }
          break;
      }
    };
    document.addEventListener('keydown', this.keyboardHandler);
  }
  destroy() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
    if (this.isFullscreen && document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen();
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
  async loadData(sessionId) {
    try {
      const response = await fetch(`/api/content/${sessionId}/slides`);
      if (!response.ok) {
        throw new Error(`Failed to load slides: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.status === 'completed' && result.data) {
        this.slidesData = result.data;
        this.sessionId = sessionId;
      } else if (result.status === 'processing') {
        throw new Error('Slides are still being generated. Please wait...');
      } else if (result.status === 'error') {
        throw new Error(result.error || 'Failed to generate slides');
      }
    } catch (error) {
      throw error;
    }
  }
}
