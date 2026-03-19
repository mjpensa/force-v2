import { toSentenceCasePreservingAcronyms, sanitizeText, normalizeBodyText } from './text.js';
import { SpeakerNotesManager } from './SpeakerNotesManager.js';

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
    font-family: 'Work Sans', sans-serif;
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
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(32px, 8cqw, 96px);
    font-weight: 100;
    color: #FFFFFF;
    text-align: center;
    line-height: 1.1;
    max-width: 80%;
    padding: 0 10%;
    word-break: normal;
    overflow-wrap: normal;
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

  const bipLogo = document.createElement('img');
  bipLogo.src = 'Red BIP Logo.png';
  bipLogo.style.cssText = `
    position: absolute;
    bottom: 3%;
    right: 2%;
    height: 4%;
    width: auto;
  `;
  el.appendChild(bipLogo);

  const footer = document.createElement('div');
  footer.style.cssText = `
    position: absolute;
    bottom: 3.43%;
    left: 2.11%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(6px, 1cqw, 12px);
    font-weight: 400;
    color: rgba(255, 255, 255, 0.6);
  `;
  footer.textContent = index + 1;
  el.appendChild(footer);

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

  const tagline = document.createElement('div');
  tagline.style.cssText = `
    position: absolute;
    top: 3.43%;
    left: 2.11%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(8px, 1.3cqw, 16px);
    font-weight: 600;
    color: #DA291C;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    white-space: nowrap;
  `;
  tagline.textContent = slide.tagline || '';
  el.appendChild(tagline);

  const title = document.createElement('div');
  title.style.cssText = `
    position: absolute;
    top: 7%;
    left: 1.87%;
    width: 44.59%;
    height: 40%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(18px, 6cqw, 72px);
    font-weight: 100;
    line-height: 0.95;
    color: #0C2340;
    white-space: pre-line;
    word-break: keep-all;
    overflow-wrap: normal;
  `;
  const titleText = slide.title || '';
  const sentenceCase = toSentenceCasePreservingAcronyms(titleText);
  let lines = sentenceCase.split('\n').map(l => l.trim()).filter(l => l);

  if (lines.length > 4) {
    lines = lines.slice(0, 4);
  }
  while (lines.length < 4) {
    lines.push('');
  }

  title.textContent = lines.join('\n');
  el.appendChild(title);

  const body = document.createElement('div');
  body.style.cssText = `
    position: absolute;
    left: 50.59%;
    width: 44.30%;
    top: 57%;
    bottom: 6%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(7px, 1.15cqw, 14px);
    font-weight: 400;
    line-height: 1.35;
    letter-spacing: 0.02em;
    word-spacing: 0.08em;
    color: #0C2340;
    overflow: hidden;
  `;

  const MAX_CHARS = 415;

  const truncateToSentence = (text) => {
    if (text.length <= MAX_CHARS) return text;
    const truncated = text.substring(0, MAX_CHARS);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclaim = truncated.lastIndexOf('!');
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);
    if (lastSentenceEnd > MAX_CHARS * 0.6) {
      return text.substring(0, lastSentenceEnd + 1);
    }
    return truncated.replace(/\s+\S*$/, '') + '.';
  };

  let paragraphs = [];
  if (slide.paragraph1 || slide.paragraph2) {
    if (slide.paragraph1) paragraphs.push(truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph1.trim().replace(/\n/g, ' ')))));
    if (slide.paragraph2) paragraphs.push(truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph2.trim().replace(/\n/g, ' ')))));
  } else if (slide.body) {
    paragraphs = slide.body.split(/\n\n+/).filter(p => p.trim()).slice(0, 2).map(p => truncateToSentence(normalizeBodyText(sanitizeText(p.trim().replace(/\n/g, ' ')))));
  }
  body.innerHTML = paragraphs.map(p => {
    return `<p style="margin: 0 0 0.8em 0;">${p}</p>`;
  }).join('');

  el.appendChild(body);

  const cornerGraphic = document.createElement('img');
  cornerGraphic.src = 'bip corner graphic.svg';
  cornerGraphic.style.cssText = `
    position: absolute;
    top: 0;
    right: 0;
    width: 10.9%;
    height: auto;
  `;
  el.appendChild(cornerGraphic);

  const bipLogo = document.createElement('img');
  bipLogo.src = 'Red BIP Logo.png';
  bipLogo.style.cssText = `
    position: absolute;
    bottom: 3%;
    right: 2%;
    height: 4%;
    width: auto;
  `;
  el.appendChild(bipLogo);

  const footer = document.createElement('div');
  footer.style.cssText = `
    position: absolute;
    bottom: 3.43%;
    left: 2.11%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(6px, 1cqw, 12px);
    font-weight: 400;
    color: #0C2340;
  `;
  footer.textContent = index + 1;
  el.appendChild(footer);

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

  const tagline = document.createElement('div');
  tagline.style.cssText = `
    position: absolute;
    top: 3.47%;
    left: 2.10%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(8px, 1.3cqw, 16px);
    font-weight: 600;
    color: #DA291C;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    white-space: nowrap;
  `;
  tagline.textContent = slide.tagline || '';
  el.appendChild(tagline);

  const title = document.createElement('div');
  title.style.cssText = `
    position: absolute;
    top: 7%;
    left: 1.87%;
    width: 24%;
    height: 40%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(14px, 3.2cqw, 38px);
    font-weight: 300;
    line-height: 0.95;
    color: #0C2340;
    white-space: pre-line;
    word-break: keep-all;
    overflow-wrap: normal;
  `;

  const titleText = slide.title || '';
  const sentenceCase = toSentenceCasePreservingAcronyms(titleText);
  let lines = sentenceCase.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length > 4) lines = lines.slice(0, 4);
  while (lines.length < 4) lines.push('');
  title.textContent = lines.join('\n');
  el.appendChild(title);

  const MAX_CHARS = 400;
  const truncateToSentence = (text) => {
    if (!text || text.length <= MAX_CHARS) return text || '';
    const truncated = text.substring(0, MAX_CHARS);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclaim = truncated.lastIndexOf('!');
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);
    if (lastSentenceEnd > MAX_CHARS * 0.6) {
      return text.substring(0, lastSentenceEnd + 1);
    }
    return truncated.replace(/\s+\S*$/, '') + '.';
  };

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
    truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph1))),
    truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph2))),
    truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph3 || slide.paragraph1)))
  ];

  columnTexts.forEach(text => {
    const col = document.createElement('div');
    col.style.cssText = `
      flex: 1;
      font-family: 'Work Sans', sans-serif;
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

  const cornerGraphic = document.createElement('img');
  cornerGraphic.src = 'bip corner graphic.svg';
  cornerGraphic.style.cssText = `
    position: absolute;
    top: 0;
    right: 0;
    width: 10.9%;
    height: auto;
  `;
  el.appendChild(cornerGraphic);

  const bipLogo = document.createElement('img');
  bipLogo.src = 'Red BIP Logo.png';
  bipLogo.style.cssText = `
    position: absolute;
    bottom: 3%;
    right: 2%;
    height: 4%;
    width: auto;
  `;
  el.appendChild(bipLogo);

  const footer = document.createElement('div');
  footer.style.cssText = `
    position: absolute;
    bottom: 3.43%;
    left: 2.11%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(6px, 1cqw, 12px);
    font-weight: 400;
    color: #0C2340;
  `;
  footer.textContent = index + 1;
  el.appendChild(footer);

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
    tocContainer.className = 'slides-toc';

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

  render() {
    const container = document.createElement('div');
    container.className = 'slides-view-container';
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
    const menuContainer = document.createElement('div');
    menuContainer.className = 'slides-header-menu';

    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'slides-menu-trigger';
    triggerBtn.setAttribute('aria-label', 'Open slides menu');
    triggerBtn.setAttribute('aria-haspopup', 'true');
    triggerBtn.setAttribute('aria-expanded', 'false');
    triggerBtn.innerHTML = `
      <span class="menu-dot"></span>
      <span class="menu-dot"></span>
      <span class="menu-dot"></span>
    `;

    const dropdown = document.createElement('div');
    dropdown.className = 'slides-menu-dropdown';
    dropdown.setAttribute('role', 'menu');

    const toggleNotesItem = this._createMenuItem({
      id: 'toggle-notes-btn',
      icon: '\ud83d\udcdd',
      text: 'Show Notes',
      ariaLabel: 'Toggle speaker notes panel'
    });
    toggleNotesItem.addEventListener('click', () => this._notesManager.toggle());
    dropdown.appendChild(toggleNotesItem);

    const exportPptItem = this._createMenuItem({
      id: 'export-ppt-btn',
      icon: '\ud83d\udcca',
      text: 'Export to PowerPoint',
      ariaLabel: 'Export slides as PowerPoint presentation'
    });
    exportPptItem.addEventListener('click', () => this._exportToPPT());
    dropdown.appendChild(exportPptItem);

    menuContainer.appendChild(triggerBtn);
    menuContainer.appendChild(dropdown);
    this._setupMenuBehavior(triggerBtn, dropdown);

    return menuContainer;
  }

  _createMenuItem({ id, icon, text, ariaLabel }) {
    const item = document.createElement('button');
    item.id = id;
    item.className = 'menu-item';
    item.setAttribute('role', 'menuitem');
    item.setAttribute('aria-label', ariaLabel);
    item.innerHTML = `
      <span class="menu-item-icon">${icon}</span>
      <span class="menu-item-text">${text}</span>
    `;
    return item;
  }

  _setupMenuBehavior(trigger, dropdown) {
    let isOpen = false;

    const openMenu = () => {
      isOpen = true;
      dropdown.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    };

    const closeMenu = () => {
      isOpen = false;
      dropdown.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (isOpen && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        closeMenu();
      }
    });

    dropdown.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.menu-item');
      if (menuItem) {
        closeMenu();
      }
    });
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
    this.counter.textContent = `${this.index + 1} / ${this.slides.length}`;
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
  }
}
