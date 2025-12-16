/**
 * SlidesView - Templates: sectionTitle, twoColumn, threeColumn
 * EXACT measurements extracted from PPT XML
 *
 * Slide: 12192000 x 6858000 EMU (16:9)
 * All positions calculated as percentages from source XML
 *
 * Sections structure aligned with Gantt chart swimlanes
 */

/**
 * Convert text to sentence case while preserving acronyms (all-caps words like CDM, API, ROI)
 * @param {string} text - Text to convert
 * @returns {string} - Sentence case text with acronyms preserved
 */
function toSentenceCasePreservingAcronyms(text) {
  if (!text) return '';

  // Split into lines first to handle multi-line titles
  return text.split('\n').map((line, lineIndex) => {
    // Split line into words
    const words = line.split(/(\s+)/); // Keep whitespace as separate elements

    return words.map((word, wordIndex) => {
      // Skip whitespace
      if (/^\s*$/.test(word)) return word;

      // Check if word is an acronym (2-5 uppercase letters, optionally with numbers)
      const isAcronym = /^[A-Z][A-Z0-9]{1,4}$/.test(word);

      if (isAcronym) {
        // Keep acronyms uppercase
        return word;
      } else if (lineIndex === 0 && wordIndex === 0) {
        // First word of first line: capitalize first letter, lowercase rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      } else {
        // All other words: lowercase
        return word.toLowerCase();
      }
    }).join('');
  }).join('\n');
}

// Dispatcher - routes to correct renderer based on layout
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

// ========================================
// SECTION TITLE SLIDE RENDERER
// Full-bleed title slide for section breaks
// ========================================
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

  // Section number / swimlane indicator (top left)
  const sectionLabel = document.createElement('div');
  sectionLabel.style.cssText = `
    position: absolute;
    top: 5%;
    left: 4%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(10px, 1.5cqw, 18px);
    font-weight: 600;
    color: #DA291C;
    letter-spacing: 1px;
    text-transform: uppercase;
  `;
  sectionLabel.textContent = slide.swimlane || '';
  el.appendChild(sectionLabel);

  // Main section title (centered, large)
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
  `;
  title.textContent = slide.sectionTitle || slide.title || '';
  el.appendChild(title);

  // Decorative line under title
  const line = document.createElement('div');
  line.style.cssText = `
    width: 15%;
    height: 3px;
    background: #DA291C;
    margin-top: 3%;
  `;
  el.appendChild(line);

  // CORNER GRAPHIC - top right (inverted for dark background)
  const cornerGraphic = document.createElement('img');
  cornerGraphic.src = 'bip corner graphic.svg';
  cornerGraphic.style.cssText = `
    position: absolute;
    top: 0;
    right: 0;
    width: 10.9%;
    height: auto;
    filter: brightness(0) invert(1);
    opacity: 0.3;
  `;
  el.appendChild(cornerGraphic);

  // BIP LOGO - bottom right (white version or filtered)
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

  // SLIDE NUMBER - bottom left
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

  // Use container query units (cqw/cqh) for scalable text
  // Fallback to vw-based calculations for older browsers
  // Base reference: 1200px slide width, so 1% = 12px at full size

  // EYEBROW (red tagline) - EXACT from XML:
  // x=257175/12192000 = 2.11%, y=235177/6858000 = 3.43%
  // width=2039291/12192000 = 16.73%
  // Font: 12pt Work Sans SemiBold, #DA291C (12pt = 1% of 1200px width)
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

  // TITLE - EXACT from XML:
  // x=228208/12192000 = 1.87%, y=613997/6858000 = 8.95%
  // width=5435991/12192000 = 44.59%, height=2150574/6858000 = 31.36%
  // Font: 72pt Work Sans Thin, #0C2340, line-height 70% (tight spacing - content must avoid descender/ascender conflicts)
  const title = document.createElement('div');
  title.style.cssText = `
    position: absolute;
    top: 7%;
    left: 1.87%;
    width: 44.59%;
    height: 40%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(18px, 8cqw, 96px);
    font-weight: 100;
    line-height: 0.85;
    color: #0C2340;
    white-space: pre-line;
  `;
  // Convert to sentence case (preserving acronyms) and enforce exactly 4 lines
  const titleText = slide.title || '';
  const sentenceCase = toSentenceCasePreservingAcronyms(titleText);
  let lines = sentenceCase.split('\n').map(l => l.trim()).filter(l => l);

  // Enforce exactly 4 lines
  if (lines.length > 4) {
    lines = lines.slice(0, 4);
  }
  while (lines.length < 4) {
    lines.push('');
  }

  title.textContent = lines.join('\n');
  el.appendChild(title);

  // BODY (right side) - EXACT from XML:
  // x=6167437/12192000 = 50.59%, y=3159889/6858000 = 46.08%
  // width=5400675/12192000 = 44.30%, height=3221861/6858000 = 46.98%
  // Font: 12pt Work Sans, #0C2340, line-height 120%
  // Top aligned with bottom of title (accounting for descenders on last line)
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

  // Body text - uses paragraph1 and paragraph2 fields (or falls back to body for compatibility)
  // Hard limit: 415 chars per paragraph - truncate at sentence boundary if AI exceeds
  const MAX_CHARS = 415;
  
  const truncateToSentence = (text) => {
    if (text.length <= MAX_CHARS) return text;
    // Find last sentence end before the limit
    const truncated = text.substring(0, MAX_CHARS);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclaim = truncated.lastIndexOf('!');
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);
    if (lastSentenceEnd > MAX_CHARS * 0.6) {
      // Found a sentence end in the last 40% of allowed text
      return text.substring(0, lastSentenceEnd + 1);
    }
    // No good sentence break, cut at word boundary
    return truncated.replace(/\s+\S*$/, '') + '.';
  };

  let paragraphs = [];
  if (slide.paragraph1 || slide.paragraph2) {
    // New schema with separate paragraph fields
    if (slide.paragraph1) paragraphs.push(truncateToSentence(slide.paragraph1.trim().replace(/\n/g, ' ')));
    if (slide.paragraph2) paragraphs.push(truncateToSentence(slide.paragraph2.trim().replace(/\n/g, ' ')));
  } else if (slide.body) {
    // Legacy schema with combined body field
    paragraphs = slide.body.split(/\n\n+/).filter(p => p.trim()).slice(0, 2).map(p => truncateToSentence(p.trim().replace(/\n/g, ' ')));
  }
  body.innerHTML = paragraphs.map(p => {
    return `<p style="margin: 0 0 0.8em 0;">${p}</p>`;
  }).join('');

  el.appendChild(body);

  // CORNER GRAPHIC - top right (1.45" x 1.45" on 13.33" x 7.5" slide)
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

  // BIP LOGO - bottom right
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

  // SLIDE NUMBER - bottom left, matching eyebrow position
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

// ========================================
// THREE COLUMN LAYOUT RENDERER
// Measurements from ppt-template-config.js (13.33" x 7.5" slide)
// ========================================
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

  // TAGLINE - PPT: x=0.28", y=0.26" → 2.10%, 3.47%
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

  // TITLE - PPT: x=0.25", y=0.67", w=2.76", h=2.35" → 1.88%, 8.93%, 20.70%, 31.33%
  // Font: Work Sans Light (weight 300), line-height 0.85 - template 2 uses heavier weight
  const title = document.createElement('div');
  title.style.cssText = `
    position: absolute;
    top: 7%;
    left: 1.87%;
    width: 20.70%;
    height: 40%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(14px, 3.7cqw, 44px);
    font-weight: 300;
    line-height: 0.85;
    color: #0C2340;
    white-space: pre-line;
  `;

  // Convert to sentence case (preserving acronyms) and enforce exactly 4 lines
  const titleText = slide.title || '';
  const sentenceCase = toSentenceCasePreservingAcronyms(titleText);
  let lines = sentenceCase.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length > 4) lines = lines.slice(0, 4);
  while (lines.length < 4) lines.push('');
  title.textContent = lines.join('\n');
  el.appendChild(title);

  // THREE COLUMNS - PPT: x=3.56", y=3.46", w=9.10", h=3.52" → 26.71%, 46.13%, 68.27%, 46.93%
  // Font: 11pt Work Sans, lineSpacing: 120 (1.2 line-height), columnGap: 0.59" → 4.43%
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
    truncateToSentence(slide.paragraph1),
    truncateToSentence(slide.paragraph2),
    truncateToSentence(slide.paragraph3)
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

  // CORNER GRAPHIC - top right
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

  // BIP LOGO - bottom right
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

  // SLIDE NUMBER - bottom left
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

// ========================================
// DEMO SLIDES - Template references
// ========================================
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

// ========================================
// SLIDES VIEW CLASS
// ========================================
export class SlidesView {
  constructor(data, sessionId = null) {
    this.sessionId = sessionId;

    // ALWAYS show demo slides first for template reference
    this.slides = [DEMO_SLIDE_TWO_COL, DEMO_SLIDE_THREE_COL];

    // Store sections for TOC generation
    this.sections = data?.sections || [];

    // Track section start indices for TOC navigation
    this.sectionStartIndices = new Map();
    this.sectionStartIndices.set('demo', 0); // Demo slides start at index 0

    // Handle sections structure (aligned with Gantt swimlanes)
    if (this.sections.length) {
      const flattenedSlides = this._flattenSections(this.sections);
      this.slides = this.slides.concat(flattenedSlides);
    }

    this.index = 0;
    this.slideEl = null;
    this.counter = null;

    // TOC management
    this.tocLinks = new Map();
    this.tocContainer = null;
  }

  /**
   * Flatten sections structure into a linear array of slides
   * Inserts a section title slide at the start of each section
   * @param {Array} sections - Array of section objects with swimlane and slides
   * @returns {Array} Flattened array of slides
   */
  _flattenSections(sections) {
    const flatSlides = [];
    // Start after demo slides (2 demo slides at indices 0 and 1)
    let currentIndex = 2;

    for (const section of sections) {
      // Track section start index for TOC navigation
      const sectionId = section.swimlane.toLowerCase().replace(/\s+/g, '-');
      this.sectionStartIndices.set(sectionId, currentIndex);

      // Add section title slide
      flatSlides.push({
        layout: 'sectionTitle',
        swimlane: section.swimlane,
        sectionTitle: section.sectionTitle || section.swimlane,
        _sectionId: sectionId
      });
      currentIndex++;

      // Add all content slides for this section
      if (section.slides?.length) {
        flatSlides.push(...section.slides.map(slide => ({
          ...slide,
          _sectionId: sectionId
        })));
        currentIndex += section.slides.length;
      }
    }

    return flatSlides;
  }

  /**
   * Render the Table of Contents sidebar
   * Mirrors the DocumentView TOC implementation
   */
  _renderTableOfContents() {
    const tocContainer = document.createElement('div');
    tocContainer.className = 'slides-toc';

    const tocTitle = document.createElement('h3');
    tocTitle.className = 'toc-title';
    tocTitle.textContent = 'Contents';
    tocContainer.appendChild(tocTitle);

    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';

    // 1. Demo templates link
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

    // 2. Section links from data
    this.sections.forEach(section => {
      const sectionId = section.swimlane.toLowerCase().replace(/\s+/g, '-');

      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'toc-link';
      link.href = `#${sectionId}`;
      link.textContent = section.swimlane;
      link.setAttribute('data-section-id', sectionId);

      link.addEventListener('click', (e) => {
        e.preventDefault();
        this._goToSection(sectionId);
      });

      this.tocLinks.set(sectionId, link);
      li.appendChild(link);
      tocList.appendChild(li);
    });

    tocContainer.appendChild(tocList);
    this.tocContainer = tocContainer;
    return tocContainer;
  }

  /**
   * Navigate to a section by its ID
   */
  _goToSection(sectionId) {
    const targetIndex = this.sectionStartIndices.get(sectionId);
    if (targetIndex !== undefined) {
      this.index = targetIndex;
      this._update();
    }
  }

  /**
   * Update active section in TOC based on current slide
   */
  _updateActiveTocSection() {
    const currentSlide = this.slides[this.index];
    let activeSectionId = 'demo';

    // Determine which section the current slide belongs to
    if (this.index < 2) {
      activeSectionId = 'demo';
    } else if (currentSlide?._sectionId) {
      activeSectionId = currentSlide._sectionId;
    }

    // Remove active class from all links
    this.tocLinks.forEach(link => {
      link.classList.remove('active');
    });

    // Add active class to current section link
    const activeLink = this.tocLinks.get(activeSectionId);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'slides-view-container';

    // Main layout wrapper (slides area + TOC)
    const mainLayout = document.createElement('div');
    mainLayout.className = 'slides-main-layout';

    // Slides area (wrapper + nav)
    const slidesArea = document.createElement('div');
    slidesArea.className = 'slides-area';

    // Header with title and menu
    const header = document.createElement('div');
    header.className = 'slides-header';

    const headerTitle = document.createElement('h2');
    headerTitle.className = 'slides-header-title';
    headerTitle.textContent = 'Presentation';

    // Add glassmorphic three-dot menu
    const menu = this._createHeaderMenu();

    header.appendChild(headerTitle);
    header.appendChild(menu);
    slidesArea.appendChild(header);

    // Slide wrapper (centered, 16:9)
    const wrapper = document.createElement('div');
    wrapper.className = 'slides-wrapper';

    this.slideEl = document.createElement('div');
    this.slideEl.className = 'slide-viewport';
    wrapper.appendChild(this.slideEl);

    // Navigation bar (without export button - moved to menu)
    const nav = document.createElement('div');
    nav.className = 'slides-nav';

    const prevBtn = this._btn('← Prev', () => this.go(-1));
    const nextBtn = this._btn('Next →', () => this.go(1));

    this.counter = document.createElement('span');
    this.counter.style.cssText = 'color: white; font-size: 14px; min-width: 60px; text-align: center;';

    nav.appendChild(prevBtn);
    nav.appendChild(this.counter);
    nav.appendChild(nextBtn);

    slidesArea.appendChild(wrapper);
    slidesArea.appendChild(nav);

    // Add TOC sidebar first (for proper DOM order on tablets when static)
    const toc = this._renderTableOfContents();
    mainLayout.appendChild(toc);

    mainLayout.appendChild(slidesArea);

    container.appendChild(mainLayout);

    this._update();
    return container;
  }

  /**
   * Create the glassmorphic three-dot menu for the header
   * @returns {HTMLElement} The menu container
   */
  _createHeaderMenu() {
    const menuContainer = document.createElement('div');
    menuContainer.className = 'slides-header-menu';

    // Three-dot trigger button
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

    // Dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'slides-menu-dropdown';
    dropdown.setAttribute('role', 'menu');

    // Export to PowerPoint
    const exportPptItem = this._createMenuItem({
      id: 'export-ppt-btn',
      icon: '📊',
      text: 'Export to PowerPoint',
      ariaLabel: 'Export slides as PowerPoint presentation'
    });
    exportPptItem.addEventListener('click', () => this._exportToPPT());
    dropdown.appendChild(exportPptItem);

    menuContainer.appendChild(triggerBtn);
    menuContainer.appendChild(dropdown);

    // Setup menu toggle behavior
    this._setupMenuBehavior(triggerBtn, dropdown);

    return menuContainer;
  }

  /**
   * Create a menu item element
   */
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

  /**
   * Setup menu open/close behavior
   */
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

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (isOpen && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        closeMenu();
      }
    });

    // Close menu when a menu item is clicked
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

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'Presentation.pptx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Download the file
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
    // Update TOC active state
    this._updateActiveTocSection();
  }

  destroy() {
    // Cleanup if needed
  }
}
