/**
 * PPT Export Service v2
 * Rebuilt to match browser preview exactly
 *
 * Slide types: sectionTitle, twoColumn, threeColumn
 * All positions calculated from browser CSS percentages
 */

import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// SLIDE DIMENSIONS
// ============================================================================

const SLIDE = {
  WIDTH: 13.33,   // inches
  HEIGHT: 7.5     // inches (16:9 aspect ratio)
};

// Convert percentage to inches
const pctX = (p) => (p / 100) * SLIDE.WIDTH;
const pctY = (p) => (p / 100) * SLIDE.HEIGHT;

// ============================================================================
// COLORS
// ============================================================================

const COLORS = {
  navy: '0C2340',       // Primary brand - titles, body text
  red: 'DA291C',        // Accent - taglines, decorative elements
  white: 'FFFFFF',      // Backgrounds, section title text
  darkGray: '6B7280',   // Page numbers on white backgrounds
  mutedWhite: '999999'  // Page numbers on dark backgrounds (~60% white)
};

// ============================================================================
// LAYOUTS - Exact browser CSS measurements converted to inches
// ============================================================================

const LAYOUTS = {
  // Section Title Slide (navy background, centered title)
  sectionTitle: {
    // Browser: top: 5%, left: 4%
    swimlaneLabel: {
      x: pctX(4),
      y: pctY(5),
      w: 5,
      h: 0.4
    },
    // Centered title
    title: {
      x: 0.5,
      y: 2.5,
      w: SLIDE.WIDTH - 1,
      h: 2.5
    },
    // Red decorative line (15% width, centered)
    redLine: {
      x: (SLIDE.WIDTH - 2) / 2,
      y: 5.0,
      w: 2,
      h: 0.04
    },
    // Corner graphic: top: 0, right: 0, width: 10.9%
    cornerGraphic: {
      x: SLIDE.WIDTH - pctX(10.9),
      y: 0,
      w: pctX(10.9),
      h: pctX(10.9) * 0.75  // Maintain aspect ratio
    },
    // Logo: bottom: 3%, right: 2%, height: 4%
    logo: {
      x: SLIDE.WIDTH - 1.3,
      y: SLIDE.HEIGHT - 0.55,
      w: 1.0,
      h: 0.3
    },
    // Page number: bottom: 3.43%, left: 2.11%
    pageNumber: {
      x: pctX(2.11),
      y: SLIDE.HEIGHT - pctY(3.43) - 0.3,  // bottom position - element height
      w: 0.5,
      h: 0.3
    }
  },

  // Two Column Content Slide
  twoColumn: {
    // Tagline: top: 3.43%, left: 2.11%
    tagline: {
      x: pctX(2.11),
      y: pctY(3.43),
      w: 3,
      h: 0.35
    },
    // Title: top: 7%, left: 1.87%, width: 44.59%, height: 40%
    title: {
      x: pctX(1.87),
      y: pctY(7),
      w: pctX(44.59),
      h: pctY(40)
    },
    // Body: left: 50.59%, top: 57%, width: 44.30%, bottom: 6%
    body: {
      x: pctX(50.59),
      y: pctY(57),
      w: pctX(44.30),
      h: pctY(37)  // 100% - 57% - 6%
    },
    // Corner graphic: top: 0, right: 0, width: 10.9%
    cornerGraphic: {
      x: SLIDE.WIDTH - pctX(10.9),
      y: 0,
      w: pctX(10.9),
      h: pctX(10.9) * 0.75
    },
    // Logo: bottom: 3%, right: 2%
    logo: {
      x: SLIDE.WIDTH - 1.3,
      y: SLIDE.HEIGHT - 0.55,
      w: 1.0,
      h: 0.3
    },
    // Page number: bottom: 3.43%, left: 2.11%
    pageNumber: {
      x: pctX(2.11),
      y: SLIDE.HEIGHT - pctY(3.43) - 0.3,  // bottom position - element height
      w: 0.5,
      h: 0.3
    }
  },

  // Three Column Content Slide
  threeColumn: {
    // Tagline: top: 3.47%, left: 2.10%
    tagline: {
      x: pctX(2.10),
      y: pctY(3.47),
      w: 3,
      h: 0.35
    },
    // Title: top: 7%, left: 1.87%, width: 20.70%, height: 40%
    title: {
      x: pctX(1.87),
      y: pctY(7),
      w: pctX(20.70),
      h: pctY(40)
    },
    // Columns: left: 26.71%, top: 46.13%, width: 68.27%, height: 46.93%
    columns: {
      x: pctX(26.71),
      y: pctY(46.13),
      w: pctX(68.27),
      h: pctY(46.93)
    },
    // Column gap: 4.43%
    columnGap: pctX(4.43),
    // Corner graphic
    cornerGraphic: {
      x: SLIDE.WIDTH - pctX(10.9),
      y: 0,
      w: pctX(10.9),
      h: pctX(10.9) * 0.75
    },
    // Logo
    logo: {
      x: SLIDE.WIDTH - 1.3,
      y: SLIDE.HEIGHT - 0.55,
      w: 1.0,
      h: 0.3
    },
    // Page number
    pageNumber: {
      x: pctX(2.10),
      y: SLIDE.HEIGHT - pctY(3.43) - 0.3,  // bottom position - element height
      w: 0.5,
      h: 0.3
    }
  }
};

// ============================================================================
// ASSETS - Loaded as base64 for reliable embedding
// ============================================================================

let ASSETS = {
  logo: null,
  logoWhite: null,
  cornerGraphic: null,
  cornerGraphicWhite: null
};

let assetsLoaded = false;

/**
 * Load image assets as base64 encoded strings
 */
function loadAssets() {
  if (assetsLoaded) return;

  // Find project root (go up from server/templates)
  const projectRoot = path.resolve(__dirname, '..', '..');
  const publicDir = path.join(projectRoot, 'Public');

  // Load red BIP logo
  const logoPath = path.join(publicDir, 'Red BIP Logo.png');
  if (fs.existsSync(logoPath)) {
    const logoData = fs.readFileSync(logoPath);
    ASSETS.logo = `image/png;base64,${logoData.toString('base64')}`;
    console.log('[PPT Export v2] Loaded logo asset');
  } else {
    console.warn('[PPT Export v2] Logo not found at:', logoPath);
  }

  // Load corner graphic SVG (convert to base64)
  const cornerPath = path.join(publicDir, 'bip corner graphic.svg');
  if (fs.existsSync(cornerPath)) {
    const svgData = fs.readFileSync(cornerPath);
    ASSETS.cornerGraphic = `image/svg+xml;base64,${svgData.toString('base64')}`;
    console.log('[PPT Export v2] Loaded corner graphic asset');
  }

  assetsLoaded = true;
}

// ============================================================================
// TEXT FORMATTING HELPERS
// ============================================================================

// ALL CAPS acronyms - these get uppercased
const ACRONYMS_UPPER = [
  'DRR', 'CDM', 'API', 'APIS', 'ROI', 'KPI', 'KPIS', 'CEO', 'CTO', 'CFO', 'COO', 'CIO',
  'AI', 'ML', 'US', 'UK', 'EU', 'UN', 'CFTC', 'SEC', 'FDA', 'EPA',
  'UTI', 'UPI', 'ESG', 'DEI', 'M&A', 'IPO', 'ETF', 'ETL', 'GDP', 'B2B', 'B2C', 'P2P',
  'AWS', 'GCP', 'IT', 'HR', 'PR', 'R&D', 'P&L',
  'CPMI', 'IOSCO', 'OTC', 'FX', 'USD', 'EUR', 'GBP',
  'CRM', 'ERP', 'ISDA', 'LEI', 'EMIR', 'SFTR', 'NFA',  // Note: MiFID handled in ACRONYMS_MIXED
  'FINRA', 'OCC', 'DTCC', 'SWIFT', 'ISO', 'XML', 'JSON', 'REST', 'SDK'
];

// MIXED CASE acronyms - preserve exact capitalization
const ACRONYMS_MIXED = {
  'fpml': 'FpML',
  'saas': 'SaaS',
  'paas': 'PaaS',
  'iaas': 'IaaS',
  'regtech': 'RegTech',
  'fintech': 'FinTech',
  'devops': 'DevOps',
  'mifid': 'MiFID'  // Can be MiFID or MIFID depending on context
};

/**
 * Check if a single word (no slashes) is an acronym
 * Returns: { isAcronym: boolean, value: string }
 */
function checkSingleAcronym(word) {
  if (!word) return { isAcronym: false, value: word };

  const lowerWord = word.toLowerCase();
  const upperWord = word.toUpperCase();

  // Check mixed-case acronyms first (exact match needed)
  if (ACRONYMS_MIXED[lowerWord]) {
    return { isAcronym: true, value: ACRONYMS_MIXED[lowerWord] };
  }

  // Check ALL CAPS acronyms
  if (ACRONYMS_UPPER.includes(upperWord)) {
    return { isAcronym: true, value: upperWord };
  }

  // Dynamic check: 2-5 uppercase letters/numbers (already uppercase = acronym)
  if (/^[A-Z][A-Z0-9]{1,4}$/.test(word)) {
    return { isAcronym: true, value: word };
  }

  return { isAcronym: false, value: word };
}

/**
 * Get the correct form of an acronym, handling compound forms like "CDM/DRR"
 * Returns: { isAcronym: boolean, value: string }
 */
function getAcronymForm(word) {
  if (!word) return { isAcronym: false, value: word };

  // Handle slashed compound acronyms like "CDM/DRR"
  if (word.includes('/')) {
    const parts = word.split('/');
    const results = parts.map(part => checkSingleAcronym(part));
    const allAcronyms = results.every(r => r.isAcronym);

    if (allAcronyms) {
      return { isAcronym: true, value: results.map(r => r.value).join('/') };
    }
    return { isAcronym: false, value: word };
  }

  return checkSingleAcronym(word);
}

/**
 * Convert text to sentence case while preserving acronyms
 */
function toSentenceCase(text) {
  if (!text) return '';

  return text.split('\n').map((line, lineIndex) => {
    const words = line.split(/(\s+)/);

    return words.map((word, wordIndex) => {
      if (/^\s*$/.test(word)) return word;

      // Check if word is an acronym and get correct form
      const acronymResult = getAcronymForm(word);
      if (acronymResult.isAcronym) {
        return acronymResult.value;
      }

      // First word of first line: capitalize
      if (lineIndex === 0 && wordIndex === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      // All other words: lowercase
      return word.toLowerCase();
    }).join('');
  }).join('\n');
}

/**
 * Enforce 3-4 lines for title (merge if >4, keep as-is if 3-4)
 * Does NOT pad to 4 lines - allows clean 3-line titles
 */
function enforceTitleLineCount(title) {
  if (!title) return '';

  let lines = title.split('\n').map(l => l.trim()).filter(l => l);

  // If already 3 or 4 lines, keep as-is
  if (lines.length >= 3 && lines.length <= 4) {
    return lines.join('\n');
  }

  // If fewer than 3 lines, just return what we have (don't pad)
  if (lines.length < 3) {
    return lines.join('\n');
  }

  // Merge lines if more than 4
  while (lines.length > 4) {
    let minCombinedLength = Infinity;
    let mergeIndex = 0;

    for (let i = 0; i < lines.length - 1; i++) {
      const combinedLength = lines[i].length + lines[i + 1].length;
      if (combinedLength < minCombinedLength) {
        minCombinedLength = combinedLength;
        mergeIndex = i;
      }
    }

    lines[mergeIndex] = lines[mergeIndex] + ' ' + lines[mergeIndex + 1];
    lines.splice(mergeIndex + 1, 1);
  }

  return lines.join('\n');
}

/**
 * Format title: sentence case + enforce 3-4 lines
 */
function formatTitle(title) {
  const sentenceCase = toSentenceCase(title);
  return enforceTitleLineCount(sentenceCase);
}

/**
 * Format section title: preserve acronyms but don't apply full sentence case
 * (Section titles are typically title case, not sentence case)
 */
function formatSectionTitle(title) {
  if (!title) return '';

  // Apply acronym corrections to each word
  return title.split(/(\s+)/).map(word => {
    if (/^\s*$/.test(word)) return word;
    const acronymResult = getAcronymForm(word);
    if (acronymResult.isAcronym) {
      return acronymResult.value;
    }
    return word;
  }).join('');
}

/**
 * Format body paragraphs with proper spacing
 */
function formatBody(p1, p2) {
  const parts = [];
  if (p1) parts.push(p1.trim());
  if (p2) parts.push(p2.trim());
  return parts.join('\n\n');
}

/**
 * Get section/tagline label
 */
function getSectionLabel(slideData) {
  const label = slideData.tagline || slideData.section || slideData.sectionLabel;
  return label ? String(label).toUpperCase() : '';
}

// ============================================================================
// CORNER GRAPHIC - Shape-based alternative (more reliable than SVG)
// ============================================================================

/**
 * Draw corner graphic using shapes (triangle overlays)
 * This replicates the visual appearance without needing external images
 */
function addCornerGraphic(pptx, slide, layout, isDarkBackground = false) {
  const pos = layout.cornerGraphic;

  // Main red triangle (bottom-left to top-right diagonal)
  slide.addShape(pptx.ShapeType.rtTriangle, {
    x: pos.x + pos.w * 0.1,
    y: pos.y,
    w: pos.w * 0.9,
    h: pos.h * 0.8,
    fill: { color: isDarkBackground ? '4A5568' : COLORS.red },
    line: { color: isDarkBackground ? '4A5568' : COLORS.red, width: 0 },
    rotate: 180,
    flipH: true
  });

  // Navy overlay triangle (smaller, creates layered effect)
  slide.addShape(pptx.ShapeType.rtTriangle, {
    x: pos.x + pos.w * 0.35,
    y: pos.y,
    w: pos.w * 0.65,
    h: pos.h * 0.55,
    fill: { color: isDarkBackground ? '2D3748' : COLORS.navy },
    line: { color: isDarkBackground ? '2D3748' : COLORS.navy, width: 0 },
    rotate: 180,
    flipH: true
  });

  // Gray accent triangle (topmost)
  slide.addShape(pptx.ShapeType.rtTriangle, {
    x: pos.x + pos.w * 0.55,
    y: pos.y,
    w: pos.w * 0.45,
    h: pos.h * 0.35,
    fill: { color: isDarkBackground ? '1A202C' : COLORS.darkGray },
    line: { color: isDarkBackground ? '1A202C' : COLORS.darkGray, width: 0 },
    rotate: 180,
    flipH: true
  });
}

// ============================================================================
// SLIDE RENDERERS
// ============================================================================

/**
 * Add Section Title Slide
 * Navy background, centered title, white text
 */
function addSectionTitleSlide(pptx, data, slideNumber) {
  const L = LAYOUTS.sectionTitle;
  const slide = pptx.addSlide();

  // Navy background
  slide.background = { color: COLORS.navy };

  // Swimlane label (white on dark - per updated browser CSS)
  if (data.swimlane) {
    const swimlaneText = formatSectionTitle(data.swimlane).toUpperCase();
    slide.addText(swimlaneText, {
      x: L.swimlaneLabel.x,
      y: L.swimlaneLabel.y,
      w: L.swimlaneLabel.w,
      h: L.swimlaneLabel.h,
      fontSize: 14,
      fontFace: 'Work Sans',
      bold: true,
      color: COLORS.white,
      align: 'left',
      charSpacing: 1
    });
  }

  // Main section title (centered, large, thin font)
  const titleText = formatSectionTitle(data.sectionTitle || data.swimlane || '');
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 60,
    fontFace: 'Work Sans',
    bold: false,
    color: COLORS.white,
    align: 'center',
    valign: 'middle',
    lineSpacingMultiple: 1.1
  });

  // Red decorative line under title
  slide.addShape(pptx.ShapeType.rect, {
    x: L.redLine.x,
    y: L.redLine.y,
    w: L.redLine.w,
    h: L.redLine.h,
    fill: { color: COLORS.red },
    line: { color: COLORS.red, width: 0 }
  });

  // Corner graphic (shape-based, muted for dark bg)
  addCornerGraphic(pptx, slide, L, true);

  // Logo
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: L.logo.x,
      y: L.logo.y,
      w: L.logo.w,
      h: L.logo.h
    });
  }

  // Page number (muted white)
  slide.addText(String(slideNumber), {
    x: L.pageNumber.x,
    y: L.pageNumber.y,
    w: L.pageNumber.w,
    h: L.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color: COLORS.mutedWhite,
    align: 'left'
  });
}

/**
 * Add Two-Column Content Slide
 * White background, title left, body right
 */
function addTwoColumnSlide(pptx, data, slideNumber) {
  const L = LAYOUTS.twoColumn;
  const slide = pptx.addSlide();

  // White background
  slide.background = { color: COLORS.white };

  // Tagline (red, uppercase, semi-bold)
  const tagline = getSectionLabel(data);
  if (tagline) {
    slide.addText(tagline, {
      x: L.tagline.x,
      y: L.tagline.y,
      w: L.tagline.w,
      h: L.tagline.h,
      fontSize: 12,
      fontFace: 'Work Sans',
      bold: true,
      color: COLORS.red,
      align: 'left',
      charSpacing: 0.5
    });
  }

  // Title (navy, large, thin font, 4 lines)
  const titleText = formatTitle(data.title);
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 54,
    fontFace: 'Work Sans',
    bold: false,
    color: COLORS.navy,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 0.85
  });

  // Body text (two paragraphs)
  const bodyText = formatBody(data.paragraph1, data.paragraph2);
  if (bodyText) {
    slide.addText(bodyText, {
      x: L.body.x,
      y: L.body.y,
      w: L.body.w,
      h: L.body.h,
      fontSize: 11,
      fontFace: 'Work Sans',
      bold: false,
      color: COLORS.navy,
      align: 'left',
      valign: 'top',
      lineSpacingMultiple: 1.35,
      paraSpaceAfter: 12
    });
  }

  // Corner graphic (shape-based)
  addCornerGraphic(pptx, slide, L, false);

  // Logo
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: L.logo.x,
      y: L.logo.y,
      w: L.logo.w,
      h: L.logo.h
    });
  }

  // Page number (dark gray)
  slide.addText(String(slideNumber), {
    x: L.pageNumber.x,
    y: L.pageNumber.y,
    w: L.pageNumber.w,
    h: L.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color: COLORS.darkGray,
    align: 'left'
  });
}

/**
 * Add Three-Column Content Slide
 * White background, narrow title left, three columns below
 */
function addThreeColumnSlide(pptx, data, slideNumber) {
  const L = LAYOUTS.threeColumn;
  const slide = pptx.addSlide();

  // White background
  slide.background = { color: COLORS.white };

  // Tagline
  const tagline = getSectionLabel(data);
  if (tagline) {
    slide.addText(tagline, {
      x: L.tagline.x,
      y: L.tagline.y,
      w: L.tagline.w,
      h: L.tagline.h,
      fontSize: 12,
      fontFace: 'Work Sans',
      bold: true,
      color: COLORS.red,
      align: 'left',
      charSpacing: 0.5
    });
  }

  // Title (narrower, lighter weight than two-column)
  const titleText = formatTitle(data.title);
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 33,
    fontFace: 'Work Sans',
    bold: false,
    color: COLORS.navy,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 0.85
  });

  // Three columns - calculate widths
  const totalWidth = L.columns.w;
  const gapWidth = L.columnGap;
  const columnWidth = (totalWidth - (2 * gapWidth)) / 3;

  const columnTexts = [
    data.paragraph1 || '',
    data.paragraph2 || '',
    data.paragraph3 || ''
  ];

  columnTexts.forEach((text, index) => {
    if (text) {
      const columnX = L.columns.x + (index * (columnWidth + gapWidth));
      slide.addText(text.trim(), {
        x: columnX,
        y: L.columns.y,
        w: columnWidth,
        h: L.columns.h,
        fontSize: 11,
        fontFace: 'Work Sans',
        bold: false,
        color: COLORS.navy,
        align: 'left',
        valign: 'top',
        lineSpacingMultiple: 1.30
      });
    }
  });

  // Corner graphic
  addCornerGraphic(pptx, slide, L, false);

  // Logo
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: L.logo.x,
      y: L.logo.y,
      w: L.logo.w,
      h: L.logo.h
    });
  }

  // Page number
  slide.addText(String(slideNumber), {
    x: L.pageNumber.x,
    y: L.pageNumber.y,
    w: L.pageNumber.w,
    h: L.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color: COLORS.darkGray,
    align: 'left'
  });
}

// ============================================================================
// SECTION FLATTENING
// ============================================================================

/**
 * Flatten sections structure into linear array of slides
 * Inserts section title slide at start of each section
 */
function flattenSections(sections) {
  const flatSlides = [];

  for (const section of sections) {
    // Skip sections without valid swimlane
    if (!section.swimlane) {
      console.warn('[PPT Export v2] Skipping section with no swimlane');
      continue;
    }

    // Add section title slide
    flatSlides.push({
      layout: 'sectionTitle',
      swimlane: section.swimlane,
      sectionTitle: section.sectionTitle || section.swimlane
    });

    // Add all content slides for this section
    if (section.slides && Array.isArray(section.slides) && section.slides.length > 0) {
      flatSlides.push(...section.slides);
    } else {
      console.warn(`[PPT Export v2] Section "${section.swimlane}" has no content slides`);
    }
  }

  return flatSlides;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Generate PowerPoint presentation from slides data
 * @param {Object} slidesData - Slides data with sections array
 * @param {Object} options - Optional metadata overrides
 * @returns {Promise<Buffer>} PowerPoint file as Node buffer
 */
export async function generatePptx(slidesData, options = {}) {
  // Validate input
  if (!slidesData || typeof slidesData !== 'object') {
    throw new Error('Invalid slides data: expected object');
  }

  // Load assets on first call
  loadAssets();

  const pptx = new PptxGenJS();

  // Set metadata
  pptx.author = options.author || 'BIP';
  pptx.company = options.company || 'BIP';
  pptx.title = slidesData.title || 'Presentation';
  pptx.subject = options.subject || 'Generated Presentation';
  pptx.revision = '1';

  // Define custom 16:9 layout
  pptx.defineLayout({
    name: 'CUSTOM_16_9',
    width: SLIDE.WIDTH,
    height: SLIDE.HEIGHT
  });
  pptx.layout = 'CUSTOM_16_9';

  // Get slides array from sections
  let slidesArray = [];
  if (slidesData.sections && Array.isArray(slidesData.sections) && slidesData.sections.length > 0) {
    console.log(`[PPT Export v2] Processing ${slidesData.sections.length} sections`);
    slidesArray = flattenSections(slidesData.sections);
  } else {
    console.warn('[PPT Export v2] No sections found in slides data - generating empty presentation');
  }

  // Warn if no slides
  if (slidesArray.length === 0) {
    console.warn('[PPT Export v2] Warning: No slides to render');
  }

  // Render each slide
  for (let i = 0; i < slidesArray.length; i++) {
    const slideData = slidesArray[i];
    const slideNumber = i + 1;
    const layout = slideData.layout || 'twoColumn';

    console.log(`[PPT Export v2] Rendering slide ${slideNumber}: ${layout}`);

    if (layout === 'sectionTitle') {
      addSectionTitleSlide(pptx, slideData, slideNumber);
    } else if (layout === 'threeColumn') {
      addThreeColumnSlide(pptx, slideData, slideNumber);
    } else {
      addTwoColumnSlide(pptx, slideData, slideNumber);
    }
  }

  console.log(`[PPT Export v2] Generated ${slidesArray.length} slides`);

  // Export as buffer
  return await pptx.write({ outputType: 'nodebuffer' });
}

export default { generatePptx };
