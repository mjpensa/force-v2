/**
 * SlidesView - Single Template Only
 * EXACT measurements extracted from PPT Templates_SHORT3.pptx
 *
 * Slide: 12192000 x 6858000 EMU (16:9)
 * All positions calculated as percentages from source XML
 */

function renderSlide(slide, index) {
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

  // Body text with proper paragraph spacing - limit to 2 paragraphs
  const bodyText = slide.body || '';
  const paragraphs = bodyText.split(/\n\n+/).filter(p => p.trim()).slice(0, 2);
  body.innerHTML = paragraphs.map(p => 
    `<p style="margin: 0 0 0.8em 0;">${p.trim().replace(/\n/g, ' ')}</p>`
  ).join('');

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
// DEMO SLIDE - Exact content from template
// ========================================
const DEMO_SLIDE = {
  tagline: 'LOREM IPSUM',
  title: 'Lorem ipsum sit amet sit lorem',
  body: `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitationLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitationLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.`
};

// ========================================
// SLIDES VIEW CLASS
// ========================================
export class SlidesView {
  constructor(data, sessionId = null) {
    this.sessionId = sessionId;
    
    // Use provided slides or show demo slide if none
    if (data?.slides?.length) {
      this.slides = data.slides;
    } else {
      this.slides = [DEMO_SLIDE];
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
