import { toSentenceCase, sanitizeText, normalizeBodyText, truncateToSentence } from '../../shared/text-utils.js';
import { createDropdownMenu, escapeHtml } from '../../utils/dom.js';
import { SpeakerNotesManager } from './SpeakerNotesManager.js';

/** Append BIP logo, page-number footer, and optional corner graphic to a slide element. */
function _appendSlideChrome(slideEl, index, { showCornerGraphic = false, darkBackground = false } = {}) {
  if (showCornerGraphic) {
    const cornerGraphic = document.createElement('img');
    cornerGraphic.src = 'bip corner graphic.svg';
    cornerGraphic.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 10.9%;
      height: auto;
    `;
    slideEl.appendChild(cornerGraphic);
  }

  const bipLogo = document.createElement('img');
  bipLogo.src = 'Red BIP Logo.png';
  bipLogo.style.cssText = `
    position: absolute;
    bottom: 3%;
    right: 2%;
    height: 4%;
    width: auto;
  `;
  slideEl.appendChild(bipLogo);

  const footer = document.createElement('div');
  footer.style.cssText = `
    position: absolute;
    bottom: 3.43%;
    left: 2.11%;
    font-size: clamp(6px, 1cqw, 12px);
    font-weight: 400;
    color: ${darkBackground ? 'rgba(255, 255, 255, 0.6)' : '#0C2340'};
  `;
  footer.textContent = index + 1;
  slideEl.appendChild(footer);
}

/** Create the tagline element used by twoColumn and threeColumn layouts. */
function _createTagline(slide) {
  const tagline = document.createElement('div');
  tagline.style.cssText = `
    position: absolute;
    top: 3.45%;
    left: 2.11%;
    font-size: clamp(8px, 1.3cqw, 16px);
    font-weight: 600;
    color: #DA291C;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 45%;
  `;
  tagline.textContent = slide.tagline || '';
  return tagline;
}

/** Normalize title text: sentence-case, split into lines, pad to exactly 4 lines. */
function _normalizeTitleLines(titleText) {
  const sentenceCase = toSentenceCase(titleText);
  let lines = sentenceCase.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length > 4) lines = lines.slice(0, 4);
  while (lines.length < 4) lines.push('');
  return lines.join('\n');
}

function renderSlide(slide, index) {
  const layout = slide.layout || 'twoColumn';
  if (layout === 'sectionTitle') {
    return renderSectionTitleSlide(slide, index);
  }
  if (layout === 'threeColumn') {
    return renderThreeColumnSlide(slide, index);
  }
  return renderTwoColumnSlide(slide, index);
}

function renderSectionTitleSlide(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%; height: 100%;
    background: #0C2340;
    position: relative;
    font-family: 'Work Sans', sans-serif;
    box-sizing: border-box;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  `;

  const sectionLabel = document.createElement('div');
  sectionLabel.style.cssText = `
    position: absolute;
    top: 5%;
    left: 4%;
    font-size: clamp(10px, 1.5cqw, 18px);
    font-weight: 600;
    color: #FFFFFF;
    letter-spacing: 1px;
    text-transform: uppercase;
  `;
  sectionLabel.textContent = slide.swimlane || '';
  el.appendChild(sectionLabel);

  const title = document.createElement('div');
  title.style.cssText = `
    font-size: clamp(32px, 8cqw, 96px);
    font-weight: 100;
    color: #FFFFFF;
    text-align: center;
    line-height: 1.1;
    max-width: 80%;
    max-height: 60%;
    padding: 0 10%;
    word-break: normal;
    overflow-wrap: normal;
    overflow: hidden;
  `;
  title.textContent = slide.sectionTitle || slide.title || '';
  el.appendChild(title);

  const line = document.createElement('div');
  line.style.cssText = `
    width: 15%;
    height: 3px;
    background: #DA291C;
    margin-top: 3%;
  `;
  el.appendChild(line);

  _appendSlideChrome(el, index, { darkBackground: true });

  return el;
}

function renderTwoColumnSlide(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%; height: 100%;
    background: #FFFFFF;
    position: relative;
    font-family: 'Work Sans', sans-serif;
    box-sizing: border-box;
    overflow: hidden;
  `;

  el.appendChild(_createTagline(slide));

  const title = document.createElement('div');
  title.style.cssText = `
    position: absolute;
    top: 7%;
    left: 1.87%;
    width: 44.59%;
    height: 40%;
    font-size: clamp(18px, 6cqw, 72px);
    font-weight: 100;
    line-height: 0.95;
    color: #0C2340;
    white-space: pre-line;
    word-break: keep-all;
    overflow-wrap: normal;
    overflow: hidden;
  `;
  title.textContent = _normalizeTitleLines(slide.title || '');
  el.appendChild(title);

  const body = document.createElement('div');
  body.style.cssText = `
    position: absolute;
    left: 50.59%;
    width: 44.30%;
    top: 57%;
    bottom: 6%;
    font-size: clamp(7px, 1.15cqw, 14px);
    font-weight: 400;
    line-height: 1.35;
    letter-spacing: 0.02em;
    word-spacing: 0.08em;
    color: #0C2340;
    overflow: hidden;
  `;

  let paragraphs = [];
  if (slide.paragraph1 || slide.paragraph2) {
    if (slide.paragraph1) paragraphs.push(truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph1.trim().replace(/\n/g, ' '))), 410));
    if (slide.paragraph2) paragraphs.push(truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph2.trim().replace(/\n/g, ' '))), 410));
  } else if (slide.body) {
    paragraphs = slide.body.split(/\n\n+/).filter(p => p.trim()).slice(0, 2).map(p => truncateToSentence(normalizeBodyText(sanitizeText(p.trim().replace(/\n/g, ' '))), 410));
  }
  body.innerHTML = paragraphs.map(p => {
    return `<p style="margin: 0 0 0.8em 0;">${escapeHtml(p)}</p>`;
  }).join('');

  el.appendChild(body);

  _appendSlideChrome(el, index, { showCornerGraphic: true });

  return el;
}

function renderThreeColumnSlide(slide, index) {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 100%; height: 100%;
    background: #FFFFFF;
    position: relative;
    font-family: 'Work Sans', sans-serif;
    box-sizing: border-box;
    overflow: hidden;
  `;

  el.appendChild(_createTagline(slide));

  const title = document.createElement('div');
  title.style.cssText = `
    position: absolute;
    top: 7%;
    left: 1.87%;
    width: 24%;
    height: 40%;
    font-size: clamp(14px, 3.2cqw, 38px);
    font-weight: 300;
    line-height: 0.95;
    color: #0C2340;
    white-space: pre-line;
    word-break: keep-all;
    overflow-wrap: normal;
    overflow: hidden;
  `;
  title.textContent = _normalizeTitleLines(slide.title || '');
  el.appendChild(title);

  const columnsContainer = document.createElement('div');
  columnsContainer.style.cssText = `
    position: absolute;
    left: 26.71%;
    top: 46.13%;
    width: 68.27%;
    height: 46.93%;
    display: flex;
    gap: 4.43%;
  `;

  const columnTexts = [
    truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph1)), 390),
    truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph2)), 390),
    truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph3 || '')), 390)
  ];

  columnTexts.forEach(text => {
    const col = document.createElement('div');
    col.style.cssText = `
      flex: 1;
      font-size: clamp(7px, 1.15cqw, 14px);
      font-weight: 400;
      line-height: 1.3;
      color: #0C2340;
      overflow: hidden;
    `;
    col.textContent = text;
    columnsContainer.appendChild(col);
  });
  el.appendChild(columnsContainer);

  _appendSlideChrome(el, index, { showCornerGraphic: true });

  return el;
}

const DEMO_SLIDE_TWO_COL = {
  layout: 'twoColumn',
  tagline: 'LOREM IPSUM',
  title: 'Lorem\nipsum sit\namet sit\nlorem',
  paragraph1: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat.',
  paragraph2: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit sed quia consequuntur magni dolores eos ratione voluptatem.'
};

const DEMO_SLIDE_THREE_COL = {
  layout: 'threeColumn',
  tagline: 'LOREM IPSUM',
  title: 'Lorem\nipsum sit\namet sit\nlorem',
  paragraph1: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad',
  paragraph2: 'minim veniam, quis nostrud exercitation Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitationLorem ipsum dolor sit amet, consectetur adipiscing',
  paragraph3: 'elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitationLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor'
};

export class SlidesView {
  constructor(data, sessionId = null) {
    this.sessionId = sessionId;

    this.slides = [DEMO_SLIDE_TWO_COL, DEMO_SLIDE_THREE_COL];

    this.sections = data?.sections || [];

    this.speakerNotes = data?.speakerNotes || null;
    this.speakerNotesVisible = false;
    this.speakerNotesLoading = false;

    this.sectionStartIndices = new Map();
    this.sectionStartIndices.set('demo', 0);

    this.slideIndices = new Map();
    this.sectionSlides = new Map();
    if (this.sections.length) {
      const flattenedSlides = this._flattenSections(this.sections);
      this.slides = this.slides.concat(flattenedSlides);
    }

    this.index = 0;
    this.slideEl = null;
    this.counter = null;
    this.speakerNotesPanel = null;

    this.tocLinks = new Map();
    this.tocContainer = null;

    this._notesManager = new SpeakerNotesManager(this);
    this.isPresentationMode = false;
    this._handleKeyDown = this._onKeyDown.bind(this);
    this._handleFullscreenChange = this._onFullscreenChange.bind(this);
    this._overlayTimeout = null;
    this._container = null;
  }

  _flattenSections(sections) {
    const flatSlides = [];
    let currentIndex = 2;

    for (const section of sections) {
      const sectionId = section.swimlane.toLowerCase().replace(/\s+/g, '-');
      this.sectionStartIndices.set(sectionId, currentIndex);
      this.sectionSlides.set(sectionId, []);
      flatSlides.push({
        layout: 'sectionTitle',
        swimlane: section.swimlane,
        sectionTitle: section.sectionTitle || section.swimlane,
        _sectionId: sectionId
      });
      currentIndex++;
      if (section.slides?.length) {
        section.slides.forEach((slide, slideIdx) => {
          const slideId = `${sectionId}-slide-${slideIdx}`;
          const subTopic = slide.subTopic || slide.tagline || `Slide ${slideIdx + 1}`;

          this.slideIndices.set(slideId, currentIndex);
          this.sectionSlides.get(sectionId).push({
            slideId,
            subTopic,
            index: currentIndex
          });

          flatSlides.push({
            ...slide,
            _sectionId: sectionId,
            _slideId: slideId,
            _subTopic: subTopic
          });
          currentIndex++;
        });
      }
    }

    return flatSlides;
  }

  _renderTableOfContents() {
    const tocContainer = document.createElement('div');
    tocContainer.className = 'toc-sidebar slides-toc';

    const tocTitle = document.createElement('h3');
    tocTitle.className = 'toc-title';
    tocTitle.textContent = 'Contents';
    tocContainer.appendChild(tocTitle);

    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';

    const demoLi = document.createElement('li');
    const demoLink = document.createElement('a');
    demoLink.className = 'toc-link';
    demoLink.href = '#demo';
    demoLink.textContent = 'Templates';
    demoLink.setAttribute('data-section-id', 'demo');

    demoLink.addEventListener('click', (e) => {
      e.preventDefault();
      this._goToSection('demo');
    });

    this.tocLinks.set('demo', demoLink);
    demoLi.appendChild(demoLink);
    tocList.appendChild(demoLi);

    this.sections.forEach(section => {
      const sectionId = section.swimlane.toLowerCase().replace(/\s+/g, '-');

      const li = document.createElement('li');

      const sectionLink = document.createElement('a');
      sectionLink.className = 'toc-link toc-section-link';
      sectionLink.href = `#${sectionId}`;
      sectionLink.textContent = section.swimlane;
      sectionLink.setAttribute('data-section-id', sectionId);

      sectionLink.addEventListener('click', (e) => {
        e.preventDefault();
        this._goToSection(sectionId);
      });

      this.tocLinks.set(sectionId, sectionLink);
      li.appendChild(sectionLink);

      const sectionSlideData = this.sectionSlides.get(sectionId) || [];
      if (sectionSlideData.length > 0) {
        const subList = document.createElement('ul');
        subList.className = 'toc-sublist';

        sectionSlideData.forEach(({ slideId, subTopic }) => {
          const subLi = document.createElement('li');
          const subLink = document.createElement('a');
          subLink.className = 'toc-link toc-slide-link';
          subLink.href = `#${slideId}`;
          subLink.textContent = subTopic;
          subLink.setAttribute('data-slide-id', slideId);
          subLink.setAttribute('data-section-id', sectionId);

          subLink.addEventListener('click', (e) => {
            e.preventDefault();
            this._goToSlide(slideId);
          });

          this.tocLinks.set(slideId, subLink);
          subLi.appendChild(subLink);
          subList.appendChild(subLi);
        });

        li.appendChild(subList);
      }

      tocList.appendChild(li);
    });

    tocContainer.appendChild(tocList);
    this.tocContainer = tocContainer;
    return tocContainer;
  }

  _goToSection(sectionId) {
    const targetIndex = this.sectionStartIndices.get(sectionId);
    if (targetIndex !== undefined) {
      this.index = targetIndex;
      this._update();
    }
  }

  _goToSlide(slideId) {
    const targetIndex = this.slideIndices.get(slideId);
    if (targetIndex !== undefined) {
      this.index = targetIndex;
      this._update();
    }
  }

  _updateActiveTocSection() {
    const currentSlide = this.slides[this.index];
    let activeSectionId = 'demo';
    let activeSlideId = null;

    if (this.index < 2) {
      activeSectionId = 'demo';
    } else if (currentSlide) {
      activeSectionId = currentSlide._sectionId || 'demo';
      activeSlideId = currentSlide._slideId || null;
    }
    this.tocLinks.forEach(link => {
      link.classList.remove('active', 'active-section');
    });

    const activeSectionLink = this.tocLinks.get(activeSectionId);
    if (activeSectionLink) {
      activeSectionLink.classList.add('active-section');
    }

    if (activeSlideId) {
      const activeSlideLink = this.tocLinks.get(activeSlideId);
      if (activeSlideLink) {
        activeSlideLink.classList.add('active');
      }
    } else if (activeSectionLink) {
      activeSectionLink.classList.add('active');
    }
  }

  _onKeyDown(e) {
    if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
      case 'PageDown':
        e.preventDefault();
        this.go(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        this.go(-1);
        break;
      case 'Home':
        e.preventDefault();
        this.index = 0;
        this._update();
        break;
      case 'End':
        e.preventDefault();
        this.index = this.slides.length - 1;
        this._update();
        break;
      case 'F5':
        e.preventDefault();
        this._enterPresentationMode();
        break;
      case 'Escape':
        if (this.isPresentationMode) this._exitPresentationMode();
        break;
    }
  }

  _enterPresentationMode() {
    if (this.isPresentationMode || !this._container) return;
    this._container.classList.add('presentation-mode');
    this.isPresentationMode = true;
    const el = this._container;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    this._container.focus();
    this._showPresentationOverlay();
  }

  _exitPresentationMode() {
    if (!this.isPresentationMode) return;
    this._container.classList.remove('presentation-mode');
    this.isPresentationMode = false;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
    this._removePresentationOverlay();
  }

  _onFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      this.isPresentationMode = false;
      this._container?.classList.remove('presentation-mode');
      this._removePresentationOverlay();
    }
  }

  _showPresentationOverlay() {
    this._removePresentationOverlay();
    const overlay = document.createElement('div');
    overlay.className = 'presentation-overlay';
    overlay.innerHTML = `
      <button class="pres-prev" aria-label="Previous slide">\u2190</button>
      <span class="pres-counter">${this.index + 1} / ${this.slides.length}</span>
      <button class="pres-next" aria-label="Next slide">\u2192</button>
      <button class="pres-exit" aria-label="Exit presentation">\u2715</button>
    `;
    overlay.querySelector('.pres-prev').addEventListener('click', () => this.go(-1));
    overlay.querySelector('.pres-next').addEventListener('click', () => this.go(1));
    overlay.querySelector('.pres-exit').addEventListener('click', () => this._exitPresentationMode());
    this._container.appendChild(overlay);
    this._presOverlay = overlay;

    const showOverlay = () => {
      overlay.style.opacity = '1';
      clearTimeout(this._overlayTimeout);
      this._overlayTimeout = setTimeout(() => { overlay.style.opacity = '0'; }, 3000);
    };
    this._container.addEventListener('mousemove', showOverlay);
    this._presMouseHandler = showOverlay;
    showOverlay();
  }

  _removePresentationOverlay() {
    if (this._presOverlay) {
      this._presOverlay.remove();
      this._presOverlay = null;
    }
    if (this._presMouseHandler) {
      this._container?.removeEventListener('mousemove', this._presMouseHandler);
      this._presMouseHandler = null;
    }
    clearTimeout(this._overlayTimeout);
  }

  render() {
    const container = document.createElement('div');
    container.className = 'slides-view-container';
    container.tabIndex = 0;
    container.__view__ = this;
    this._container = container;

    document.addEventListener('keydown', this._handleKeyDown);
    document.addEventListener('fullscreenchange', this._handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this._handleFullscreenChange);

    const menu = this._createHeaderMenu();
    container.appendChild(menu);

    const mainLayout = document.createElement('div');
    mainLayout.className = 'slides-main-layout';

    const slidesArea = document.createElement('div');
    slidesArea.className = 'slides-area';

    const wrapper = document.createElement('div');
    wrapper.className = 'slides-wrapper';

    this.slideEl = document.createElement('div');
    this.slideEl.className = 'slide-viewport';
    wrapper.appendChild(this.slideEl);

    const nav = document.createElement('div');
    nav.className = 'slides-nav';

    const prevBtn = this._btn('\u2190 Prev', () => this.go(-1));
    const nextBtn = this._btn('Next \u2192', () => this.go(1));

    this.counter = document.createElement('span');
    this.counter.style.cssText = 'color: white; font-size: 14px; min-width: 60px; text-align: center;';

    nav.appendChild(prevBtn);
    nav.appendChild(this.counter);
    nav.appendChild(nextBtn);

    slidesArea.appendChild(wrapper);
    slidesArea.appendChild(nav);
    this.speakerNotesPanel = this._notesManager.renderPanel();
    slidesArea.appendChild(this.speakerNotesPanel);

    const toc = this._renderTableOfContents();
    mainLayout.appendChild(toc);

    mainLayout.appendChild(slidesArea);

    container.appendChild(mainLayout);

    this._update();
    return container;
  }

  _createHeaderMenu() {
    const { container, destroy } = createDropdownMenu({
      containerClass: 'slides-header-menu',
      triggerLabel: 'Open slides menu',
      minWidth: 220,
      items: [
        { id: 'presentation-mode-btn', icon: '\ud83d\udcfa', text: 'Presentation Mode (F5)', ariaLabel: 'Enter fullscreen presentation mode',
          onClick: () => this._enterPresentationMode() },
        { id: 'toggle-notes-btn', icon: '\ud83d\udcdd', text: 'Show Notes', ariaLabel: 'Toggle speaker notes panel',
          onClick: () => this._notesManager.toggle() },
        { id: 'export-ppt-btn', icon: '\ud83d\udcca', text: 'Export to PowerPoint', ariaLabel: 'Export slides as PowerPoint presentation',
          onClick: () => this._exportToPPT() },
      ]
    });
    this._menuCleanup = destroy;
    return container;
  }

  _btn(text, onClick, bgColor = '#444') {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.onclick = onClick;
    btn.style.cssText = `
      padding: 10px 20px; cursor: pointer;
      background: ${bgColor}; color: white;
      border: none; border-radius: 4px; font-size: 14px;
    `;
    return btn;
  }

  async _exportToPPT() {
    if (!this.sessionId) {
      alert('No session available for export. Please generate slides first.');
      return;
    }

    try {
      const response = await fetch(`/api/content/${this.sessionId}/slides/export`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'Presentation.pptx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PPT export failed:', error);
      alert(`Export failed: ${error.message}`);
    }
  }

  go(delta) {
    const next = this.index + delta;
    if (next >= 0 && next < this.slides.length) {
      this.index = next;
      this._update();
    }
  }

  _update() {
    const label = `${this.index + 1} / ${this.slides.length}`;
    this.counter.textContent = label;
    if (this._presOverlay) {
      const presCounter = this._presOverlay.querySelector('.pres-counter');
      if (presCounter) presCounter.textContent = label;
    }
    this.slideEl.innerHTML = '';
    const content = renderSlide(this.slides[this.index], this.index);
    this.slideEl.appendChild(content);
    this._updateActiveTocSection();
    this._notesManager.updateSlideIndicator();
    if (this.speakerNotesVisible) {
      this._notesManager.updateContent();
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._handleKeyDown);
    document.removeEventListener('fullscreenchange', this._handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this._handleFullscreenChange);
    this._removePresentationOverlay();
    if (this._menuCleanup) this._menuCleanup();
    if (this._notesManager?._elapsedInterval) clearInterval(this._notesManager._elapsedInterval);
    this.sectionStartIndices?.clear();
    this.slideIndices?.clear();
    this.sectionSlides?.clear();
    this.tocLinks?.clear();
    this._container = null;
  }
}
