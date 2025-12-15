/**
 * SlidesView - Two Templates: twoColumn, threeColumn
 * EXACT measurements extracted from PPT XML
 *
 * Slide: 12192000 x 6858000 EMU (16:9)
 * All positions calculated as percentages from source XML
 */

// Dispatcher - routes to correct renderer based on layout
function renderSlide(slide, index) {
  const layout = slide.layout || 'twoColumn';
  if (layout === 'threeColumn') {
    return renderThreeColumnSlide(slide, index);
  }
  return renderTwoColumnSlide(slide, index);
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
  // Convert to sentence case and enforce exactly 4 lines
  const titleText = slide.title || '';
  const sentenceCase = titleText.charAt(0).toUpperCase() + titleText.slice(1).toLowerCase();
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
  // Font: 44pt Work Sans Light, lineSpacing: 70 (0.70 line-height)
  const title = document.createElement('div');
  title.style.cssText = `
    position: absolute;
    top: 8.93%;
    left: 1.88%;
    width: 20.70%;
    height: 31.33%;
    font-family: 'Work Sans', sans-serif;
    font-size: clamp(14px, 4.6cqw, 55px);
    font-weight: 300;
    line-height: 0.70;
    color: #0C2340;
    white-space: pre-line;
  `;

  // Convert to sentence case and enforce exactly 4 lines
  const titleText = slide.title || '';
  const sentenceCase = titleText.charAt(0).toUpperCase() + titleText.slice(1).toLowerCase();
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
  paragraph1: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna.',
  paragraph2: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna.',
  paragraph3: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna.'
};

// ========================================
// SLIDES VIEW CLASS
// ========================================
export class SlidesView {
  constructor(data, sessionId = null) {
    this.sessionId = sessionId;

    // ALWAYS show demo slides first for template reference
    this.slides = [DEMO_SLIDE_TWO_COL, DEMO_SLIDE_THREE_COL];

    // Then add any provided slides after the demos
    if (data?.slides?.length) {
      this.slides = this.slides.concat(data.slides);
    }

    this.index = 0;
    this.slideEl = null;
    this.counter = null;
    this._keyHandler = null;
  }

  render() {
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      background: #1a1a1a;
    `;

    // Slide wrapper (centered, 16:9)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      flex: 1; display: flex;
      justify-content: center; align-items: center;
      padding: 20px;
    `;

    this.slideEl = document.createElement('div');
    this.slideEl.style.cssText = `
      width: 100%; max-width: 1200px;
      aspect-ratio: 16 / 9;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      overflow: hidden; position: relative;
      background: white;
      container-type: inline-size;
    `;
    wrapper.appendChild(this.slideEl);

    // Navigation bar
    const nav = document.createElement('div');
    nav.style.cssText = `
      padding: 16px; display: flex;
      justify-content: center; align-items: center;
      gap: 24px; background: #2a2a2a;
    `;

    const prevBtn = this._btn('← Prev', () => this.go(-1));
    const nextBtn = this._btn('Next →', () => this.go(1));
    const exportBtn = this._btn('Export to PPT', () => this._exportToPPT(), '#DA291C');

    this.counter = document.createElement('span');
    this.counter.style.cssText = 'color: white; font-size: 14px; min-width: 60px; text-align: center;';

    nav.appendChild(prevBtn);
    nav.appendChild(this.counter);
    nav.appendChild(nextBtn);
    nav.appendChild(exportBtn);

    container.appendChild(wrapper);
    container.appendChild(nav);

    // Keyboard navigation
    this._keyHandler = e => {
      if (e.key === 'ArrowLeft') this.go(-1);
      if (e.key === 'ArrowRight') this.go(1);
    };
    document.addEventListener('keydown', this._keyHandler);

    this._update();
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
  }

  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }
}
