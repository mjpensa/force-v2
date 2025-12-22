/**
 * SlidesView - Templates: sectionTitle, twoColumn, threeColumn
 * EXACT measurements extracted from PPT XML
 *
 * Slide: 12192000 x 6858000 EMU (16:9)
 * All positions calculated as percentages from source XML
 *
 * Sections structure aligned with Gantt chart swimlanes
 */

// Proper nouns with periods (place names must always be capitalized)
const PROPER_NOUNS = {
  'u.s.': 'U.S.',
  'u.k.': 'U.K.',
  'e.u.': 'E.U.'
};

// Known acronyms to preserve (case-insensitive matching)
const KNOWN_ACRONYMS = [
  'CDM', 'DRR', 'API', 'ROI', 'KPI', 'CEO', 'CTO', 'CFO', 'COO', 'CIO',
  'AI', 'ML', 'CFTC', 'SEC', 'FDA', 'EPA', 'UTI', 'UPI', 'ESG', 'DEI',
  'IPO', 'ETF', 'GDP', 'CPMI', 'IOSCO', 'OTC', 'FX', 'USD', 'EUR', 'GBP',
  'ISDA', 'DLT', 'IT', 'HR', 'PR', 'EMIR', 'OCC', 'BSA', 'AML', 'FINOS'
];

// Company/brand names with special capitalization
const COMPANY_NAMES = {
  'jpmorgan': 'JPMorgan',
  'jpm': 'JPM'
};

/**
 * Check if a single word (no slashes) is an acronym
 * @param {string} word - Word to check
 * @returns {boolean} - True if the word is an acronym
 */
function isAcronymWord(word) {
  if (!word) return false;
  // Check against known acronyms list (case-insensitive)
  if (KNOWN_ACRONYMS.some(a => a.toLowerCase() === word.toLowerCase())) {
    return true;
  }
  // Fallback: Check if word is all uppercase (2-5 letters, optionally with numbers)
  return /^[A-Z][A-Z0-9]{1,4}$/.test(word);
}

/**
 * Check if a word (possibly compound with slashes) is an acronym
 * Handles compound forms like "CDM/DRR", proper nouns like "U.S.", and trailing punctuation like "CDM:"
 * @param {string} word - Word to check
 * @returns {{ isAcronym: boolean, value: string }}
 */
function checkAcronym(word) {
  if (!word) return { isAcronym: false, value: word };

  // Strip trailing punctuation for acronym check, reattach later
  const punctMatch = word.match(/^(.+?)([.:,;!?]+)$/);
  const baseWord = punctMatch ? punctMatch[1] : word;
  const trailingPunct = punctMatch ? punctMatch[2] : '';

  // Check proper nouns with periods first (e.g., U.S., U.K.)
  const lowerWord = baseWord.toLowerCase();
  if (PROPER_NOUNS[lowerWord]) {
    return { isAcronym: true, value: PROPER_NOUNS[lowerWord] + trailingPunct };
  }

  // Check company names with special capitalization (e.g., JPMorgan)
  if (COMPANY_NAMES[lowerWord]) {
    return { isAcronym: true, value: COMPANY_NAMES[lowerWord] + trailingPunct };
  }

  // Handle slashed compound acronyms like "CDM/DRR"
  if (baseWord.includes('/')) {
    const parts = baseWord.split('/');
    const allAcronyms = parts.every(part => isAcronymWord(part));

    if (allAcronyms) {
      return { isAcronym: true, value: parts.map(p => p.toUpperCase()).join('/') + trailingPunct };
    }
    return { isAcronym: false, value: word };
  }

  if (isAcronymWord(baseWord)) {
    return { isAcronym: true, value: baseWord.toUpperCase() + trailingPunct };
  }

  return { isAcronym: false, value: word };
}

/**
 * Convert text to sentence case while preserving acronyms (all-caps words like CDM, API, ROI)
 * Also handles compound acronyms like "CDM/DRR"
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

      // Check if word is an acronym (handles compound forms like CDM/DRR)
      const acronymCheck = checkAcronym(word);

      if (acronymCheck.isAcronym) {
        // Keep acronyms uppercase
        return acronymCheck.value;
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

/**
 * Sanitize text by removing markdown and converting placeholder terms
 * - Removes **bold** markers
 * - Converts UNDERSCORE_TERMS to lowercase "underscore terms"
 * @param {string} text - Text to sanitize
 * @returns {string} - Cleaned text
 */
function sanitizeText(text) {
  if (!text) return '';

  return text
    // Remove markdown bold markers: **text** → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove markdown italic markers: *text* → text (but not ** which is already handled)
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    // Convert UNDERSCORE_TERMS to lowercase spaced words
    .replace(/\b([A-Z]+(?:_[A-Z]+)+)\b/g, (match) => {
      return match.toLowerCase().replace(/_/g, ' ');
    });
}

/**
 * Normalize body text by converting all-caps words to proper case
 * Preserves known acronyms (CDM, DRR, API, etc.)
 * @param {string} text - Body text to normalize
 * @returns {string} - Normalized text
 */
function normalizeBodyText(text) {
  if (!text) return '';

  // Match all-caps words (3+ letters) that aren't known acronyms
  return text.replace(/\b([A-Z]{3,})\b/g, (match) => {
    // Check if it's a known acronym
    const acronymCheck = checkAcronym(match);
    if (acronymCheck.isAcronym) {
      return acronymCheck.value; // Keep as-is
    }
    // Convert to proper case (first letter uppercase, rest lowercase)
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
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
    color: #FFFFFF;
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
    word-break: normal;
    overflow-wrap: normal;
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
  // Font: 72pt Work Sans Thin, #0C2340
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
    // Pipeline: clean whitespace → sanitize markdown → normalize caps → truncate
    if (slide.paragraph1) paragraphs.push(truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph1.trim().replace(/\n/g, ' ')))));
    if (slide.paragraph2) paragraphs.push(truncateToSentence(normalizeBodyText(sanitizeText(slide.paragraph2.trim().replace(/\n/g, ' ')))));
  } else if (slide.body) {
    // Legacy schema with combined body field
    paragraphs = slide.body.split(/\n\n+/).filter(p => p.trim()).slice(0, 2).map(p => truncateToSentence(normalizeBodyText(sanitizeText(p.trim().replace(/\n/g, ' ')))));
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
  // Font: Work Sans Light (weight 300) - template 2 uses heavier weight
  // NOTE: Width increased to 24% and font reduced to prevent choppy mid-word breaks
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

    // Store speaker notes data (from separate generation pass)
    this.speakerNotes = data?.speakerNotes || null;
    this.speakerNotesVisible = false; // Hidden by default
    this.speakerNotesLoading = false; // Track loading state for on-demand generation

    // Track section start indices for TOC navigation
    this.sectionStartIndices = new Map();
    this.sectionStartIndices.set('demo', 0); // Demo slides start at index 0

    // NEW: Track individual slides for sub-topic navigation (two-level TOC)
    this.slideIndices = new Map();      // slideId -> global index
    this.sectionSlides = new Map();     // sectionId -> [{slideId, subTopic, index}]

    // Handle sections structure (aligned with Gantt swimlanes)
    if (this.sections.length) {
      const flattenedSlides = this._flattenSections(this.sections);
      this.slides = this.slides.concat(flattenedSlides);
    }

    this.index = 0;
    this.slideEl = null;
    this.counter = null;
    this.speakerNotesPanel = null; // Speaker notes panel element

    // TOC management
    this.tocLinks = new Map();
    this.tocContainer = null;
  }

  /**
   * Flatten sections structure into a linear array of slides
   * Inserts a section title slide at the start of each section
   * Tracks sub-topic metadata for two-level TOC navigation
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

      // Initialize section slides array for two-level TOC sub-items
      this.sectionSlides.set(sectionId, []);

      // Add section title slide
      flatSlides.push({
        layout: 'sectionTitle',
        swimlane: section.swimlane,
        sectionTitle: section.sectionTitle || section.swimlane,
        _sectionId: sectionId
      });
      currentIndex++;

      // Add all content slides for this section with sub-topic tracking
      if (section.slides?.length) {
        section.slides.forEach((slide, slideIdx) => {
          const slideId = `${sectionId}-slide-${slideIdx}`;
          // Fallback: subTopic → tagline → generic label
          const subTopic = slide.subTopic || slide.tagline || `Slide ${slideIdx + 1}`;

          // Track for TOC navigation
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

  /**
   * Render the Table of Contents sidebar
   * Two-level structure: Sections + Sub-topics (slides)
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

    // 2. Section links with nested sub-topic (slide) lists
    this.sections.forEach(section => {
      const sectionId = section.swimlane.toLowerCase().replace(/\s+/g, '-');

      const li = document.createElement('li');

      // Section header link
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

      // Sub-topic nested list (slides within section)
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
   * Navigate to a specific slide by its ID
   */
  _goToSlide(slideId) {
    const targetIndex = this.slideIndices.get(slideId);
    if (targetIndex !== undefined) {
      this.index = targetIndex;
      this._update();
    }
  }

  /**
   * Update active section and slide in TOC based on current slide
   * Supports two-level highlighting: section + sub-topic
   */
  _updateActiveTocSection() {
    const currentSlide = this.slides[this.index];
    let activeSectionId = 'demo';
    let activeSlideId = null;

    // Determine which section and slide the current position belongs to
    if (this.index < 2) {
      activeSectionId = 'demo';
    } else if (currentSlide) {
      activeSectionId = currentSlide._sectionId || 'demo';
      activeSlideId = currentSlide._slideId || null;
    }

    // Remove all active classes
    this.tocLinks.forEach(link => {
      link.classList.remove('active', 'active-section');
    });

    // Highlight active section
    const activeSectionLink = this.tocLinks.get(activeSectionId);
    if (activeSectionLink) {
      activeSectionLink.classList.add('active-section');
    }

    // Highlight active slide (sub-topic)
    if (activeSlideId) {
      const activeSlideLink = this.tocLinks.get(activeSlideId);
      if (activeSlideLink) {
        activeSlideLink.classList.add('active');
      }
    } else if (activeSectionLink) {
      // If on section title slide, highlight section itself as active
      activeSectionLink.classList.add('active');
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'slides-view-container';

    // Add glassmorphic three-dot menu in upper right corner (above TOC)
    const menu = this._createHeaderMenu();
    container.appendChild(menu);

    // Main layout wrapper (slides area + TOC)
    const mainLayout = document.createElement('div');
    mainLayout.className = 'slides-main-layout';

    // Slides area (wrapper + nav + speaker notes)
    const slidesArea = document.createElement('div');
    slidesArea.className = 'slides-area';

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

    // Add inline speaker notes panel (collapsible, beneath nav)
    this.speakerNotesPanel = this._renderSpeakerNotesPanel();
    slidesArea.appendChild(this.speakerNotesPanel);

    // Add TOC sidebar first (for proper DOM order on tablets when static)
    const toc = this._renderTableOfContents();
    mainLayout.appendChild(toc);

    mainLayout.appendChild(slidesArea);

    container.appendChild(mainLayout);

    this._update();
    return container;
  }

  /**
   * Render the inline speaker notes panel (collapsible, beneath navigation)
   * Navy blue glassmorphic styling to match UI
   * @returns {HTMLElement} The speaker notes panel container
   */
  _renderSpeakerNotesPanel() {
    const panel = document.createElement('div');
    panel.className = 'speaker-notes-panel speaker-notes-inline';
    panel.setAttribute('aria-label', 'Speaker notes');

    // Collapsible header (click to toggle)
    const header = document.createElement('button');
    header.className = 'speaker-notes-header speaker-notes-toggle';
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('aria-controls', 'speaker-notes-content');
    header.addEventListener('click', () => this._toggleSpeakerNotes());

    const headerLeft = document.createElement('div');
    headerLeft.className = 'speaker-notes-header-left';

    const icon = document.createElement('span');
    icon.className = 'speaker-notes-icon';
    icon.innerHTML = '📝';

    const title = document.createElement('span');
    title.className = 'speaker-notes-title';
    title.textContent = 'Speaker Notes';

    const slideIndicator = document.createElement('span');
    slideIndicator.className = 'speaker-notes-slide-indicator';
    slideIndicator.id = 'speaker-notes-slide-indicator';
    slideIndicator.textContent = '';

    headerLeft.appendChild(icon);
    headerLeft.appendChild(title);
    headerLeft.appendChild(slideIndicator);

    // Loading spinner (hidden by default, shown during on-demand generation)
    const spinner = document.createElement('span');
    spinner.className = 'speaker-notes-spinner';
    spinner.id = 'speaker-notes-spinner';
    spinner.innerHTML = '';
    spinner.style.display = 'none';

    const chevron = document.createElement('span');
    chevron.className = 'speaker-notes-chevron';
    chevron.innerHTML = '▼';

    header.appendChild(headerLeft);
    header.appendChild(spinner);
    header.appendChild(chevron);

    // Content area (hidden by default)
    const content = document.createElement('div');
    content.className = 'speaker-notes-content';
    content.id = 'speaker-notes-content';

    panel.appendChild(header);
    panel.appendChild(content);

    return panel;
  }

  /**
   * Toggle speaker notes panel visibility
   * Triggers on-demand generation if notes don't exist yet
   */
  _toggleSpeakerNotes() {
    this.speakerNotesVisible = !this.speakerNotesVisible;

    if (this.speakerNotesPanel) {
      this.speakerNotesPanel.classList.toggle('expanded', this.speakerNotesVisible);

      // Update aria-expanded on the toggle header
      const toggleHeader = this.speakerNotesPanel.querySelector('.speaker-notes-toggle');
      if (toggleHeader) {
        toggleHeader.setAttribute('aria-expanded', this.speakerNotesVisible);
      }
    }

    // Update the menu button text (keep for backwards compatibility)
    const toggleBtn = document.getElementById('toggle-notes-btn');
    if (toggleBtn) {
      const textSpan = toggleBtn.querySelector('.menu-item-text');
      if (textSpan) {
        textSpan.textContent = this.speakerNotesVisible ? 'Hide Notes' : 'Show Notes';
      }
    }

    // Update notes content if visible
    if (this.speakerNotesVisible) {
      // Check if notes need to be generated on-demand
      if (!this.speakerNotes?.slides?.length && !this.speakerNotesLoading && this.sessionId) {
        this._generateSpeakerNotesOnDemand();
      } else {
        this._updateSpeakerNotesContent();
      }
    }
  }

  /**
   * Generate speaker notes on-demand via API
   * Shows loading indicator while generating
   */
  async _generateSpeakerNotesOnDemand() {
    if (this.speakerNotesLoading || !this.sessionId) return;

    this.speakerNotesLoading = true;
    this._showSpeakerNotesLoading(true);

    // Show loading state in content area with elapsed time
    const contentEl = document.getElementById('speaker-notes-content');
    const startTime = Date.now();
    let elapsedInterval = null;

    const updateElapsedTime = () => {
      const elapsedEl = document.getElementById('notes-elapsed-time');
      if (elapsedEl) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        elapsedEl.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      }
    };

    if (contentEl) {
      contentEl.innerHTML = `
        <div class="notes-placeholder notes-loading">
          <p>Generating speaker notes...</p>
          <p class="notes-hint">This typically takes 2-3 minutes. You can continue navigating slides.</p>
          <p class="notes-elapsed">Elapsed: <span id="notes-elapsed-time">0s</span></p>
          <div class="notes-progress-bar"><div class="notes-progress-fill"></div></div>
        </div>
      `;
      elapsedInterval = setInterval(updateElapsedTime, 1000);
    }

    // Create AbortController with 20-minute timeout to match server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20 * 60 * 1000);

    try {
      const response = await fetch(`/api/content/${this.sessionId}/slides/speaker-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (elapsedInterval) clearInterval(elapsedInterval);
      const result = await response.json();

      if (result.status === 'completed' && result.data) {
        this.speakerNotes = result.data;
        console.log('[SpeakerNotes] On-demand generation complete:', result.data.slides?.length || 0, 'notes');

        // Update content if panel is still visible
        if (this.speakerNotesVisible) {
          this._updateSpeakerNotesContent();
        }
      } else {
        console.error('[SpeakerNotes] Generation failed:', result.error);
        if (contentEl) {
          contentEl.innerHTML = `
            <div class="notes-placeholder notes-error">
              <p>Failed to generate speaker notes.</p>
              <p class="notes-hint">${result.error || 'Unknown error occurred.'}</p>
              <button class="notes-retry-btn" onclick="this.closest('.slides-view-container').__view__._generateSpeakerNotesOnDemand()">Retry</button>
            </div>
          `;
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (elapsedInterval) clearInterval(elapsedInterval);
      console.error('[SpeakerNotes] Request failed:', error);

      const isTimeout = error.name === 'AbortError';
      const errorTitle = isTimeout ? 'Generation timed out.' : 'Network error while generating notes.';
      const errorHint = isTimeout
        ? 'The AI took too long to respond. Please try again.'
        : error.message;

      if (contentEl) {
        contentEl.innerHTML = `
          <div class="notes-placeholder notes-error">
            <p>${errorTitle}</p>
            <p class="notes-hint">${errorHint}</p>
            <button class="notes-retry-btn" onclick="this.closest('.slides-view-container').__view__._generateSpeakerNotesOnDemand()">Retry</button>
          </div>
        `;
      }
    } finally {
      this.speakerNotesLoading = false;
      this._showSpeakerNotesLoading(false);
    }
  }

  /**
   * Show/hide the loading spinner next to the speaker notes chevron
   * @param {boolean} show - Whether to show the spinner
   */
  _showSpeakerNotesLoading(show) {
    const spinner = document.getElementById('speaker-notes-spinner');
    if (spinner) {
      spinner.style.display = show ? 'inline-block' : 'none';
    }

    // Also update the panel class for styling
    if (this.speakerNotesPanel) {
      this.speakerNotesPanel.classList.toggle('loading', show);
    }
  }

  /**
   * Update speaker notes content for current slide
   * Provides detailed feedback for different failure scenarios
   */
  _updateSpeakerNotesContent() {
    const contentEl = document.getElementById('speaker-notes-content');
    if (!contentEl) return;

    const currentSlide = this.slides[this.index];

    // Update slide indicator in header
    const slideIndicator = document.getElementById('speaker-notes-slide-indicator');
    if (slideIndicator) {
      if (currentSlide?.tagline) {
        slideIndicator.textContent = `— ${currentSlide.tagline}`;
      } else if (currentSlide?.layout === 'sectionTitle') {
        slideIndicator.textContent = `— ${currentSlide.sectionTitle || currentSlide.swimlane || 'Section'}`;
      } else {
        slideIndicator.textContent = `— Slide ${this.index + 1}`;
      }
    }

    // Case 1: Section title slides don't have notes
    if (currentSlide?.layout === 'sectionTitle') {
      contentEl.innerHTML = `
        <div class="notes-placeholder">
          <p>Section title slides do not have speaker notes.</p>
          <p class="notes-hint">Navigate to a content slide to view notes.</p>
        </div>
      `;
      return;
    }

    // Case 2: No speaker notes data loaded at all
    if (!this.speakerNotes?.slides || this.speakerNotes.slides.length === 0) {
      contentEl.innerHTML = `
        <div class="notes-placeholder notes-error">
          <p>Speaker notes not available.</p>
          <p class="notes-hint">Notes may not have been generated for this presentation, or generation may have failed.</p>
          <p class="notes-action">Try regenerating the slides to include speaker notes.</p>
        </div>
      `;
      return;
    }

    // Case 3: Try to get notes for current slide
    const { notes, matchInfo } = this._getSpeakerNotesForCurrentSlide();

    if (!notes) {
      // Provide specific feedback based on why matching failed
      let errorMessage = 'No speaker notes found for this slide.';
      let hintMessage = 'Notes may not have been generated for this specific slide.';

      if (matchInfo.reason === 'duplicate_taglines') {
        errorMessage = `Multiple slides share the tagline "${matchInfo.tagline}".`;
        hintMessage = `Found ${matchInfo.duplicateCount} slides with this tagline across different sections. Unable to determine which notes apply.`;
      } else if (matchInfo.reason === 'no_tagline_match') {
        errorMessage = `No notes match tagline "${matchInfo.tagline}".`;
        hintMessage = 'The slide tagline may have changed after notes were generated.';
      }

      contentEl.innerHTML = `
        <div class="notes-placeholder notes-warning">
          <p>${errorMessage}</p>
          <p class="notes-hint">${hintMessage}</p>
          ${matchInfo.reason === 'duplicate_taglines' ? `
            <details class="notes-debug">
              <summary>Sections with this tagline</summary>
              <ul>${matchInfo.duplicateSections.map(s => `<li>${s}</li>`).join('')}</ul>
            </details>
          ` : ''}
        </div>
      `;
      return;
    }

    // Case 4: Success - render notes with match quality indicator
    try {
      const reasoningHTML = this._renderReasoningSection();
      const slideNotesHTML = this._renderSpeakerNotesHTML(notes);

      // Add match quality indicator if not exact match
      let matchIndicator = '';
      if (matchInfo.matchType === 'partial_section') {
        matchIndicator = `<div class="notes-match-indicator notes-match-partial" title="Matched via partial section name">Partial match</div>`;
      } else if (matchInfo.matchType === 'tagline_only') {
        matchIndicator = `<div class="notes-match-indicator notes-match-fallback" title="Matched by tagline only - verify correct slide">Fallback match</div>`;
      } else if (matchInfo.matchType === 'index_disambiguated') {
        matchIndicator = `<div class="notes-match-indicator notes-match-partial" title="Resolved duplicate taglines using slide index">Index matched</div>`;
      } else if (matchInfo.matchType === 'position_disambiguated') {
        matchIndicator = `<div class="notes-match-indicator notes-match-fallback" title="Matched by position - low confidence">Position guess</div>`;
      } else if (matchInfo.matchType === 'fuzzy_tagline') {
        matchIndicator = `<div class="notes-match-indicator notes-match-partial" title="Matched via similar tagline text">Fuzzy match</div>`;
      } else if (matchInfo.matchType === 'fuzzy_section') {
        matchIndicator = `<div class="notes-match-indicator notes-match-partial" title="Matched via similar tagline and section">Fuzzy + section</div>`;
      } else if (matchInfo.matchType === 'section_index_fallback') {
        matchIndicator = `<div class="notes-match-indicator notes-match-fallback" title="Matched by position in section - verify correct notes (expected: ${matchInfo.tagline}, got: ${matchInfo.matchedTagline})">Index fallback</div>`;
      }

      contentEl.innerHTML = matchIndicator + reasoningHTML + slideNotesHTML;

      // Attach click handlers for collapsible sections
      this._attachCollapsibleToggleHandlers(contentEl);
    } catch (renderError) {
      console.error('[SpeakerNotes] Failed to render notes:', renderError);
      contentEl.innerHTML = `
        <div class="notes-placeholder notes-error">
          <p>Failed to render speaker notes.</p>
          <p class="notes-hint">Error: ${renderError.message}</p>
          <p class="notes-action">Try refreshing the page or regenerating notes.</p>
        </div>
      `;
    }
  }

  /**
   * Attach click handlers to collapsible section toggles
   * @param {HTMLElement} container - Container element with toggle elements
   */
  _attachCollapsibleToggleHandlers(container) {
    const toggles = container.querySelectorAll('.notes-section-toggle');
    toggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const section = e.target.closest('.notes-section');
        if (section) {
          section.classList.toggle('notes-section-collapsed');
          // Update aria-expanded for accessibility
          const isCollapsed = section.classList.contains('notes-section-collapsed');
          toggle.setAttribute('aria-expanded', !isCollapsed);
        }
      });
    });
  }

  /**
   * Get speaker notes for the current slide
   * Uses three-tier matching strategy with fallback for duplicates
   * @returns {{ notes: object|null, matchInfo: object }} Speaker notes and match metadata
   */
  _getSpeakerNotesForCurrentSlide() {
    const noMatch = (reason, extra = {}) => ({
      notes: null,
      matchInfo: { matchType: 'none', reason, ...extra }
    });

    if (!this.speakerNotes?.slides) {
      return noMatch('no_data');
    }

    const currentSlide = this.slides[this.index];
    if (!currentSlide || currentSlide.layout === 'sectionTitle') {
      return noMatch('section_title');
    }

    const sectionName = currentSlide._sectionId?.replace(/-/g, ' ') || '';
    const slideTagline = (currentSlide.tagline || '').toLowerCase().trim();
    const slideIndex = currentSlide._slideId ? parseInt(currentSlide._slideId.split('-').pop(), 10) : -1;

    if (!slideTagline) {
      return noMatch('no_tagline');
    }

    // Strategy 1: Exact match on both section and tagline (most reliable)
    const exactMatch = this.speakerNotes.slides.find(note =>
      note.slideTagline?.toLowerCase().trim() === slideTagline &&
      note.sectionName?.toLowerCase().trim() === sectionName.toLowerCase().trim()
    );
    if (exactMatch) {
      return { notes: exactMatch, matchInfo: { matchType: 'exact', tagline: slideTagline } };
    }

    // Strategy 2: Section contains match + exact tagline (handles section name variations)
    const partialSectionMatch = this.speakerNotes.slides.find(note =>
      note.slideTagline?.toLowerCase().trim() === slideTagline &&
      (note.sectionName?.toLowerCase().includes(sectionName.toLowerCase()) ||
       sectionName.toLowerCase().includes(note.sectionName?.toLowerCase() || ''))
    );
    if (partialSectionMatch) {
      return { notes: partialSectionMatch, matchInfo: { matchType: 'partial_section', tagline: slideTagline } };
    }

    // Strategy 3: Tagline-only matches
    const taglineOnlyMatches = this.speakerNotes.slides.filter(note =>
      note.slideTagline?.toLowerCase().trim() === slideTagline
    );

    // 3a: Single tagline match - safe to use
    if (taglineOnlyMatches.length === 1) {
      console.warn(`[SpeakerNotes] Using tagline-only match for "${slideTagline}" - section mismatch`);
      return { notes: taglineOnlyMatches[0], matchInfo: { matchType: 'tagline_only', tagline: slideTagline } };
    }

    // 3b: Multiple tagline matches - try to disambiguate using slide index
    if (taglineOnlyMatches.length > 1) {
      // Try matching by slideIndex if available
      const indexMatch = taglineOnlyMatches.find(note => note.slideIndex === slideIndex);
      if (indexMatch) {
        console.warn(`[SpeakerNotes] Resolved duplicate tagline "${slideTagline}" using slideIndex ${slideIndex}`);
        return { notes: indexMatch, matchInfo: { matchType: 'index_disambiguated', tagline: slideTagline } };
      }

      // Try matching by position within section (heuristic)
      // Count how many slides with this tagline come before this one in the same section
      const slidesInSection = this.slides.filter(s =>
        s._sectionId === currentSlide._sectionId &&
        (s.tagline || '').toLowerCase().trim() === slideTagline
      );
      const positionInSection = slidesInSection.findIndex(s => s === currentSlide);

      if (positionInSection >= 0 && positionInSection < taglineOnlyMatches.length) {
        // Use position as a best-guess match
        const positionalMatch = taglineOnlyMatches[positionInSection];
        console.warn(`[SpeakerNotes] Resolved duplicate tagline "${slideTagline}" using position ${positionInSection}`);
        return {
          notes: positionalMatch,
          matchInfo: {
            matchType: 'position_disambiguated',
            tagline: slideTagline,
            confidence: 'low'
          }
        };
      }

      // Cannot disambiguate - report duplicates for UI feedback
      const duplicateSections = [...new Set(taglineOnlyMatches.map(n => n.sectionName || 'Unknown'))];
      console.warn(`[SpeakerNotes] Ambiguous match: ${taglineOnlyMatches.length} notes with tagline "${slideTagline}" in sections: ${duplicateSections.join(', ')}`);
      return noMatch('duplicate_taglines', {
        tagline: slideTagline,
        duplicateCount: taglineOnlyMatches.length,
        duplicateSections
      });
    }

    // Strategy 4: Partial/fuzzy tagline matching (handles minor variations)
    const fuzzyTaglineMatches = this.speakerNotes.slides.filter(note => {
      const noteTagline = (note.slideTagline || '').toLowerCase().trim();
      if (!noteTagline) return false;
      // Check if either contains the other (handles truncation, extra words, etc.)
      return slideTagline.includes(noteTagline) || noteTagline.includes(slideTagline);
    });

    if (fuzzyTaglineMatches.length === 1) {
      console.warn(`[SpeakerNotes] Using fuzzy tagline match for "${slideTagline}" → "${fuzzyTaglineMatches[0].slideTagline}"`);
      return { notes: fuzzyTaglineMatches[0], matchInfo: { matchType: 'fuzzy_tagline', tagline: slideTagline } };
    }

    // If multiple fuzzy matches, try to disambiguate by section
    if (fuzzyTaglineMatches.length > 1) {
      const fuzzyWithSection = fuzzyTaglineMatches.find(note =>
        note.sectionName?.toLowerCase().includes(sectionName.toLowerCase()) ||
        sectionName.toLowerCase().includes(note.sectionName?.toLowerCase() || '')
      );
      if (fuzzyWithSection) {
        console.warn(`[SpeakerNotes] Resolved fuzzy tagline "${slideTagline}" using section match`);
        return { notes: fuzzyWithSection, matchInfo: { matchType: 'fuzzy_section', tagline: slideTagline } };
      }
    }

    // Strategy 5: Use slide index within section as last resort
    // Count content slides (non-section-title) before this one in the same section
    let contentSlideIndex = 0;
    for (let i = 0; i < this.slides.length && i < this.index; i++) {
      const s = this.slides[i];
      if (s._sectionId === currentSlide._sectionId && s.layout !== 'sectionTitle') {
        contentSlideIndex++;
      }
    }

    // Find notes for this section and index
    const sectionNotes = this.speakerNotes.slides.filter(note =>
      note.sectionName?.toLowerCase().includes(sectionName.toLowerCase()) ||
      sectionName.toLowerCase().includes(note.sectionName?.toLowerCase() || '')
    );

    if (sectionNotes.length > 0) {
      // Sort by slideIndex and use position
      const sortedSectionNotes = [...sectionNotes].sort((a, b) => (a.slideIndex || 0) - (b.slideIndex || 0));
      if (contentSlideIndex < sortedSectionNotes.length) {
        const indexMatch = sortedSectionNotes[contentSlideIndex];
        console.warn(`[SpeakerNotes] Using section index fallback for "${slideTagline}" → matched to "${indexMatch.slideTagline}" at position ${contentSlideIndex}`);
        return {
          notes: indexMatch,
          matchInfo: {
            matchType: 'section_index_fallback',
            tagline: slideTagline,
            matchedTagline: indexMatch.slideTagline,
            confidence: 'low'
          }
        };
      }
    }

    // No matches found at all
    return noMatch('no_tagline_match', { tagline: slideTagline });
  }

  /**
   * Render speaker notes as HTML
   * @param {object} notes - Speaker notes object
   * @returns {string} HTML string
   */
  _renderSpeakerNotesHTML(notes) {
    // Defensive check for notes object
    if (!notes || typeof notes !== 'object') {
      console.warn('[SpeakerNotes] Invalid notes object received');
      return '<p class="notes-placeholder">No notes available.</p>';
    }

    const sections = [];

    // 1. Talking Points (highest priority)
    if (notes.narrative?.talkingPoints?.length) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">💬 Talking Points</h4>
          <ul class="notes-list">
            ${notes.narrative.talkingPoints.map(point => `<li>${this._escapeHtml(point)}</li>`).join('')}
          </ul>
          ${notes.narrative.keyPhrase ? `
            <div class="key-phrase">
              <strong>Key Phrase:</strong> "${this._escapeHtml(notes.narrative.keyPhrase)}"
            </div>
          ` : ''}
        </div>
      `);
    }

    // Transitions
    if (notes.narrative?.transitionIn || notes.narrative?.transitionOut) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">🔄 Transitions</h4>
          ${notes.narrative.transitionIn ? `<p><strong>← From previous:</strong> ${this._escapeHtml(notes.narrative.transitionIn)}</p>` : ''}
          ${notes.narrative.transitionOut ? `<p><strong>→ To next:</strong> ${this._escapeHtml(notes.narrative.transitionOut)}</p>` : ''}
        </div>
      `);
    }

    // 2. Stakeholder Angles (Enhancement #1)
    if (notes.stakeholderAngles) {
      const angles = notes.stakeholderAngles;
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">👥 Stakeholder Angles</h4>
          <div class="stakeholder-tabs">
            ${angles.cfo ? `
              <div class="stakeholder-tab" data-role="cfo">
                <span class="stakeholder-icon">💰</span>
                <span class="stakeholder-label">CFO</span>
                <p class="stakeholder-angle">${this._escapeHtml(angles.cfo)}</p>
              </div>
            ` : ''}
            ${angles.cto ? `
              <div class="stakeholder-tab" data-role="cto">
                <span class="stakeholder-icon">⚙️</span>
                <span class="stakeholder-label">CTO</span>
                <p class="stakeholder-angle">${this._escapeHtml(angles.cto)}</p>
              </div>
            ` : ''}
            ${angles.ceo ? `
              <div class="stakeholder-tab" data-role="ceo">
                <span class="stakeholder-icon">🎯</span>
                <span class="stakeholder-label">CEO</span>
                <p class="stakeholder-angle">${this._escapeHtml(angles.ceo)}</p>
              </div>
            ` : ''}
            ${angles.operations ? `
              <div class="stakeholder-tab" data-role="ops">
                <span class="stakeholder-icon">🔧</span>
                <span class="stakeholder-label">Ops</span>
                <p class="stakeholder-angle">${this._escapeHtml(angles.operations)}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    // 3. Anticipated Questions (Enhanced with severity tiers - Enhancement #2)
    if (notes.anticipatedQuestions?.length) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">❓ Anticipated Questions</h4>
          ${notes.anticipatedQuestions.map(qa => `
            <div class="qa-item qa-severity-${qa.severity || 'probing'}">
              <div class="qa-header">
                <span class="severity-badge severity-${qa.severity || 'probing'}">${(qa.severity || 'probing').replace(/_/g, ' ')}</span>
                <span class="pushback-type">${qa.pushbackType?.replace(/_/g, ' ')}</span>
              </div>
              <p class="question"><strong>Q:</strong> ${this._escapeHtml(qa.question)}</p>
              <p class="response"><strong>A:</strong> ${this._escapeHtml(qa.response)}</p>
              ${qa.escalationResponse ? `
                <div class="escalation-response">
                  <strong>If they push back:</strong> ${this._escapeHtml(qa.escalationResponse)}
                </div>
              ` : ''}
              ${qa.bridgeToStrength ? `
                <div class="bridge-to-strength">
                  <strong>Pivot to strength:</strong> ${this._escapeHtml(qa.bridgeToStrength)}
                </div>
              ` : ''}
              ${qa.deferralOption ? `
                <div class="deferral-option">
                  <strong>Defer with:</strong> "${this._escapeHtml(qa.deferralOption)}"
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `);
    }

    // 4. Story Context (Enhanced with CTA variants #8 and Time Guidance #9)
    if (notes.storyContext) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">📖 Story Context</h4>
          <p class="narrative-position"><strong>Position:</strong> ${notes.storyContext.narrativePosition?.replace(/_/g, ' ')}</p>
          ${notes.storyContext.precededBy ? `<p><strong>Preceded by:</strong> ${this._escapeHtml(notes.storyContext.precededBy)}</p>` : ''}
          ${notes.storyContext.followedBy ? `<p><strong>Followed by:</strong> ${this._escapeHtml(notes.storyContext.followedBy)}</p>` : ''}
          ${notes.storyContext.soWhat ? `<p class="so-what"><strong>So What:</strong> ${this._escapeHtml(notes.storyContext.soWhat)}</p>` : ''}
          ${notes.storyContext.timeGuidance ? `
            <div class="time-guidance">
              <span class="time-badge">⏱️ ${notes.storyContext.timeGuidance.suggestedDuration || '2-3 min'}</span>
              ${notes.storyContext.timeGuidance.canCondense ? '<span class="condensable-badge">Can condense</span>' : ''}
              ${notes.storyContext.timeGuidance.condensedVersion ? `
                <p class="condensed-version"><strong>Short version:</strong> "${this._escapeHtml(notes.storyContext.timeGuidance.condensedVersion)}"</p>
              ` : ''}
              ${notes.storyContext.timeGuidance.mustInclude?.length ? `
                <p class="must-include"><strong>Must include:</strong> ${notes.storyContext.timeGuidance.mustInclude.join(' • ')}</p>
              ` : ''}
            </div>
          ` : ''}
          ${notes.storyContext.callToAction ? `
            <div class="cta-variants">
              <h5>Call-to-Action Options:</h5>
              ${notes.storyContext.callToAction.warmAudience ? `
                <div class="cta-option cta-warm">
                  <span class="cta-label">🟢 Warm</span>
                  <p>${this._escapeHtml(notes.storyContext.callToAction.warmAudience.ask)}</p>
                  ${notes.storyContext.callToAction.warmAudience.timeline ? `<p class="cta-timeline">${this._escapeHtml(notes.storyContext.callToAction.warmAudience.timeline)}</p>` : ''}
                </div>
              ` : ''}
              ${notes.storyContext.callToAction.neutralAudience ? `
                <div class="cta-option cta-neutral">
                  <span class="cta-label">🟡 Neutral</span>
                  <p>${this._escapeHtml(notes.storyContext.callToAction.neutralAudience.ask)}</p>
                  ${notes.storyContext.callToAction.neutralAudience.nextStep ? `<p class="cta-next-step">${this._escapeHtml(notes.storyContext.callToAction.neutralAudience.nextStep)}</p>` : ''}
                </div>
              ` : ''}
              ${notes.storyContext.callToAction.hostileAudience ? `
                <div class="cta-option cta-hostile">
                  <span class="cta-label">🔴 Hostile</span>
                  <p>${this._escapeHtml(notes.storyContext.callToAction.hostileAudience.ask)}</p>
                  ${notes.storyContext.callToAction.hostileAudience.fallback ? `<p class="cta-fallback"><em>Fallback: ${this._escapeHtml(notes.storyContext.callToAction.hostileAudience.fallback)}</em></p>` : ''}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `);
    }

    // 4. Source Attribution
    if (notes.sourceAttribution?.length) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">📚 Sources</h4>
          ${notes.sourceAttribution.map(src => `
            <div class="source-item">
              <p class="claim">"${this._escapeHtml(src.claim)}"</p>
              <p class="source"><strong>Source:</strong> ${this._escapeHtml(src.source)}</p>
              <span class="confidence confidence-${src.confidence}">${src.confidence?.replace(/_/g, ' ')}</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    // 5. Generation Transparency
    if (notes.generationTransparency) {
      sections.push(`
        <div class="notes-section notes-section-collapsed">
          <h4 class="notes-section-title notes-section-toggle" aria-expanded="false">🔍 Content Derivation</h4>
          <div class="notes-section-body">
            <p><strong>Sources:</strong> ${notes.generationTransparency.primarySources?.join(', ') || 'N/A'}</p>
            <p><strong>Method:</strong> ${notes.generationTransparency.derivationMethod || 'N/A'}</p>
            ${notes.generationTransparency.dataLineage ? `<p><strong>Lineage:</strong> ${this._escapeHtml(notes.generationTransparency.dataLineage)}</p>` : ''}
            ${notes.generationTransparency.assumptions?.length ? `
              <p><strong>Assumptions:</strong></p>
              <ul class="assumptions-list">
                ${notes.generationTransparency.assumptions.map(a => `<li>${this._escapeHtml(a)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        </div>
      `);
    }

    // 6. Credibility Anchors (Enhancement #6)
    if (notes.credibilityAnchors?.length) {
      sections.push(`
        <div class="notes-section">
          <h4 class="notes-section-title">🏆 Credibility Anchors</h4>
          ${notes.credibilityAnchors.map(anchor => `
            <div class="credibility-item credibility-${anchor.type || 'research'}">
              <span class="credibility-type">${(anchor.type || 'research').replace(/_/g, ' ')}</span>
              <p class="credibility-statement">${this._escapeHtml(anchor.statement)}</p>
              <p class="drop-phrase"><strong>Say:</strong> "${this._escapeHtml(anchor.dropPhrase)}"</p>
              <p class="full-citation"><em>${this._escapeHtml(anchor.fullCitation)}</em></p>
            </div>
          `).join('')}
        </div>
      `);
    }

    // 7. Risk Mitigation (Enhancement #7)
    if (notes.riskMitigation) {
      const rm = notes.riskMitigation;
      const hasContent = rm.implementationRisk || rm.reputationalRisk || rm.careerRisk;
      if (hasContent) {
        sections.push(`
          <div class="notes-section notes-section-collapsed">
            <h4 class="notes-section-title notes-section-toggle" aria-expanded="false">🛡️ Risk Mitigation</h4>
            <div class="notes-section-body">
              ${rm.implementationRisk ? `
                <div class="risk-block">
                  <h5>Implementation Risk</h5>
                  <p class="risk-concern"><em>"${this._escapeHtml(rm.implementationRisk.concern)}"</em></p>
                  <p class="risk-response">${this._escapeHtml(rm.implementationRisk.response)}</p>
                  ${rm.implementationRisk.proofPoint ? `<p class="risk-proof">Proof: ${this._escapeHtml(rm.implementationRisk.proofPoint)}</p>` : ''}
                </div>
              ` : ''}
              ${rm.reputationalRisk ? `
                <div class="risk-block">
                  <h5>Reputational Risk</h5>
                  <p class="risk-concern"><em>"${this._escapeHtml(rm.reputationalRisk.concern)}"</em></p>
                  <p class="risk-response">${this._escapeHtml(rm.reputationalRisk.response)}</p>
                </div>
              ` : ''}
              ${rm.careerRisk ? `
                <div class="risk-block">
                  <h5>Career Risk</h5>
                  <p class="risk-concern"><em>"${this._escapeHtml(rm.careerRisk.concern)}"</em></p>
                  <p class="risk-response">${this._escapeHtml(rm.careerRisk.response)}</p>
                </div>
              ` : ''}
            </div>
          </div>
        `);
      }
    }

    // 8. Audience Signals / Room Temperature (Enhancement #4)
    if (notes.audienceSignals) {
      const signals = notes.audienceSignals;
      sections.push(`
        <div class="notes-section notes-section-collapsed">
          <h4 class="notes-section-title notes-section-toggle" aria-expanded="false">🌡️ Room Temperature</h4>
          <div class="notes-section-body">
            ${signals.losingThem ? `
              <div class="signal-block signal-losing">
                <h5>⚠️ Losing Them</h5>
                <p><strong>Watch for:</strong> ${signals.losingThem.signs?.join(', ') || 'N/A'}</p>
                <p><strong>Pivot:</strong> ${this._escapeHtml(signals.losingThem.pivotStrategy)}</p>
                ${signals.losingThem.emergencyBridge ? `<p class="emergency-bridge"><strong>Emergency exit:</strong> "${this._escapeHtml(signals.losingThem.emergencyBridge)}"</p>` : ''}
              </div>
            ` : ''}
            ${signals.winningThem ? `
              <div class="signal-block signal-winning">
                <h5>✅ Winning Them</h5>
                <p><strong>Look for:</strong> ${signals.winningThem.signs?.join(', ') || 'N/A'}</p>
                <p><strong>Accelerate:</strong> ${this._escapeHtml(signals.winningThem.accelerationOption)}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    // 9. Quick Reference / Cheat Sheet (Enhancement #5) - Add at beginning for prominence
    if (notes.quickReference) {
      const qr = notes.quickReference;
      const quickRefSection = `
        <div class="notes-section quick-reference-section">
          <h4 class="notes-section-title">⚡ Quick Reference</h4>
          <div class="cheat-sheet">
            ${qr.keyNumber ? `<div class="cheat-item cheat-number"><span class="cheat-label">Key Number</span>${this._escapeHtml(qr.keyNumber)}</div>` : ''}
            ${qr.keyPhrase ? `<div class="cheat-item cheat-phrase"><span class="cheat-label">Key Phrase</span>"${this._escapeHtml(qr.keyPhrase)}"</div>` : ''}
            ${qr.keyProof ? `<div class="cheat-item cheat-proof"><span class="cheat-label">Proof Point</span>${this._escapeHtml(qr.keyProof)}</div>` : ''}
            ${qr.keyAsk ? `<div class="cheat-item cheat-ask"><span class="cheat-label">Ask For</span>${this._escapeHtml(qr.keyAsk)}</div>` : ''}
          </div>
        </div>
      `;
      // Insert at beginning for visibility
      sections.unshift(quickRefSection);
    }

    return sections.join('') || '<p class="notes-placeholder">No notes available.</p>';
  }

  /**
   * Render the reasoning transparency section (from two-pass generation)
   * Shows audience analysis, evidence chains, and pushback preparation
   * @returns {string} HTML for reasoning section
   */
  _renderReasoningSection() {
    const reasoning = this.speakerNotes?.reasoning;
    if (!reasoning || typeof reasoning !== 'object') return '';

    const sections = [];

    // Presentation Narrative Arc
    if (reasoning.presentationNarrativeArc) {
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">🎯 Narrative Arc</h5>
          <p class="reasoning-value">${this._escapeHtml(reasoning.presentationNarrativeArc)}</p>
        </div>
      `);
    }

    // Audience Profile
    if (reasoning.audienceProfile) {
      const profile = reasoning.audienceProfile;
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">👤 Audience Profile</h5>
          ${profile.primaryStakeholder ? `<p><strong>Decision Maker:</strong> ${this._escapeHtml(profile.primaryStakeholder)}</p>` : ''}
          ${profile.painPoints?.length ? `
            <p><strong>Pain Points:</strong></p>
            <ul class="reasoning-list">
              ${profile.painPoints.map(p => `<li>${this._escapeHtml(p)}</li>`).join('')}
            </ul>
          ` : ''}
          ${profile.decisionCriteria?.length ? `
            <p><strong>Decision Criteria:</strong></p>
            <ul class="reasoning-list">
              ${profile.decisionCriteria.map(c => `<li>${this._escapeHtml(c)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `);
    }

    // Key Evidence Chains
    if (reasoning.keyEvidenceChains?.length) {
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">📊 Key Evidence Chains</h5>
          ${reasoning.keyEvidenceChains.map((chain, i) => `
            <div class="evidence-chain">
              <p class="chain-number">Chain ${i + 1}</p>
              <p><strong>Evidence:</strong> ${this._escapeHtml(chain.evidence)}</p>
              <p><strong>Insight:</strong> ${this._escapeHtml(chain.insight)}</p>
              ${chain.anticipatedQuestion ? `<p><strong>Q:</strong> ${this._escapeHtml(chain.anticipatedQuestion)}</p>` : ''}
              ${chain.preparedResponse ? `<p><strong>A:</strong> ${this._escapeHtml(chain.preparedResponse)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `);
    }

    // Source Inventory
    if (reasoning.sourceInventory?.length) {
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">📚 Source Inventory</h5>
          ${reasoning.sourceInventory.map(src => `
            <div class="source-inventory-item">
              <p class="source-name"><strong>${this._escapeHtml(src.sourceName)}</strong>
                <span class="confidence-badge confidence-${src.confidenceLevel}">${src.confidenceLevel}</span>
              </p>
              ${src.keyFindings?.length ? `
                <ul class="findings-list">
                  ${src.keyFindings.map(f => `<li>${this._escapeHtml(f)}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `);
    }

    // Anticipated Pushback
    if (reasoning.anticipatedPushback?.length) {
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">⚡ Anticipated Pushback</h5>
          ${reasoning.anticipatedPushback.map(pb => `
            <div class="pushback-item">
              <span class="pushback-type-badge">${pb.pushbackType?.replace(/_/g, ' ')}</span>
              <p class="objection"><strong>Objection:</strong> "${this._escapeHtml(pb.specificObjection)}"</p>
              <p><strong>Counter:</strong> ${this._escapeHtml(pb.evidenceToCounter)}</p>
              <p><strong>Reframe:</strong> ${this._escapeHtml(pb.reframingStrategy)}</p>
            </div>
          `).join('')}
        </div>
      `);
    }

    // Competitive Positioning (Enhancement #3)
    if (reasoning.competitivePositioning) {
      const cp = reasoning.competitivePositioning;
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">⚔️ Competitive Positioning</h5>
          ${cp.primaryCompetitors?.length ? `
            <div class="competitors-list">
              ${cp.primaryCompetitors.map(comp => `
                <div class="competitor-card">
                  <p class="competitor-name"><strong>${this._escapeHtml(comp.name)}</strong></p>
                  <p class="competitor-strength"><em>Their strength:</em> ${this._escapeHtml(comp.theirStrength)}</p>
                  <p class="our-counter"><em>Our counter:</em> ${this._escapeHtml(comp.ourCounter)}</p>
                  <p class="bridge-phrase">"${this._escapeHtml(comp.bridgePhrase)}"</p>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${cp.internalTeamResponse ? `
            <div class="internal-team-block">
              <strong>If they ask "why not in-house?":</strong>
              <p>${this._escapeHtml(cp.internalTeamResponse)}</p>
            </div>
          ` : ''}
          ${cp.doNothingRisk ? `
            <div class="do-nothing-risk">
              <strong>Cost of inaction:</strong>
              <p>${this._escapeHtml(cp.doNothingRisk)}</p>
            </div>
          ` : ''}
        </div>
      `);
    }

    // Bridge Phrases Library (Enhancement #10)
    if (reasoning.bridgePhrases) {
      const bp = reasoning.bridgePhrases;
      sections.push(`
        <div class="reasoning-item">
          <h5 class="reasoning-label">🌉 Bridge Phrases</h5>
          <div class="bridge-phrases-grid">
            ${bp.dontKnowAnswer?.length ? `
              <div class="phrase-category">
                <h6>Don't Know Answer</h6>
                <ul>${bp.dontKnowAnswer.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${bp.hostileInterruption?.length ? `
              <div class="phrase-category phrase-hostile">
                <h6>Hostile Interruption</h6>
                <ul>${bp.hostileInterruption.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${bp.goingOffTopic?.length ? `
              <div class="phrase-category">
                <h6>Going Off Topic</h6>
                <ul>${bp.goingOffTopic.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${bp.technicalDive?.length ? `
              <div class="phrase-category">
                <h6>Technical Deep-Dive</h6>
                <ul>${bp.technicalDive.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${bp.losingTheRoom?.length ? `
              <div class="phrase-category phrase-warning">
                <h6>Losing the Room</h6>
                <ul>${bp.losingTheRoom.map(p => `<li>"${this._escapeHtml(p)}"</li>`).join('')}</ul>
              </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    if (sections.length === 0) return '';

    return `
      <div class="notes-section notes-section-collapsed reasoning-section">
        <h4 class="notes-section-title notes-section-toggle" aria-expanded="false">🧠 Presentation Reasoning (CoT)</h4>
        <div class="notes-section-body">
          <p class="reasoning-intro">Chain-of-thought analysis from two-pass generation:</p>
          ${sections.join('')}
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

    // Toggle Speaker Notes
    const toggleNotesItem = this._createMenuItem({
      id: 'toggle-notes-btn',
      icon: '📝',
      text: 'Show Notes',
      ariaLabel: 'Toggle speaker notes panel'
    });
    toggleNotesItem.addEventListener('click', () => this._toggleSpeakerNotes());
    dropdown.appendChild(toggleNotesItem);

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
    // Always update slide indicator in speaker notes header
    this._updateSlideIndicator();
    // Update full speaker notes content if panel is expanded
    if (this.speakerNotesVisible) {
      this._updateSpeakerNotesContent();
    }
  }

  /**
   * Update just the slide indicator in the speaker notes header
   * Called on every slide change regardless of panel visibility
   */
  _updateSlideIndicator() {
    const slideIndicator = document.getElementById('speaker-notes-slide-indicator');
    if (!slideIndicator) return;

    const currentSlide = this.slides[this.index];
    if (currentSlide?.tagline) {
      slideIndicator.textContent = `— ${currentSlide.tagline}`;
    } else if (currentSlide?.layout === 'sectionTitle') {
      slideIndicator.textContent = `— ${currentSlide.sectionTitle || currentSlide.swimlane || 'Section'}`;
    } else {
      slideIndicator.textContent = `— Slide ${this.index + 1}`;
    }
  }

  destroy() {
    // Cleanup if needed
  }
}
