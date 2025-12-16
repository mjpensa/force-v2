/**
 * PPT Export Service
 * Slide types: sectionTitle, textTwoColumn, textThreeColumn
 * Supports both sections structure (Gantt-aligned) and legacy flat slides
 * Text-only elements (no logos or graphics)
 */

import PptxGenJS from 'pptxgenjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SLIDE_SIZE, LAYOUTS, COLORS, FONTS, DEFAULT_METADATA } from './ppt-template-config.js';
import { CONFIG } from '../config.js';

// Initialize Gemini for title rewording
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// ============================================================================
// HELPERS
// ============================================================================

function getSectionLabel(slideData) {
  const label = slideData.section || slideData.sectionLabel || slideData.tagline;
  return label ? String(label).toUpperCase() : null;
}

// Common acronyms that should always be capitalized
const ACRONYMS = [
  'DRR', 'CDM', 'API', 'ROI', 'KPI', 'CEO', 'CTO', 'CFO', 'COO', 'CIO',
  'AI', 'ML', 'US', 'UK', 'EU', 'UN', 'CFTC', 'SEC', 'FDA', 'EPA',
  'UTI', 'UPI', 'ESG', 'DEI', 'M&A', 'IPO', 'ETF', 'GDP', 'B2B', 'B2C',
  'SaaS', 'PaaS', 'IaaS', 'AWS', 'GCP', 'IT', 'HR', 'PR', 'R&D', 'P&L',
  'CPMI', 'IOSCO', 'OTC', 'FX', 'USD', 'EUR', 'GBP'
];

/**
 * Capitalize known acronyms in text
 */
function capitalizeAcronyms(text) {
  let result = text;
  for (const acronym of ACRONYMS) {
    // Match acronym case-insensitively as a whole word
    const regex = new RegExp(`\\b${acronym}\\b`, 'gi');
    result = result.replace(regex, acronym);
  }
  return result;
}

function enforceExactlyFourLinesFallback(title) {
  const titleText = title || '';
  let lines = titleText.split('\n').map(l => l.trim()).filter(l => l);

  // Merge lines until we have exactly 4
  while (lines.length > 4) {
    // Find the pair of adjacent lines with shortest combined length
    let minCombinedLength = Infinity;
    let mergeIndex = 0;

    for (let i = 0; i < lines.length - 1; i++) {
      const combinedLength = lines[i].length + lines[i + 1].length;
      if (combinedLength < minCombinedLength) {
        minCombinedLength = combinedLength;
        mergeIndex = i;
      }
    }

    // Merge the two shortest adjacent lines
    lines[mergeIndex] = lines[mergeIndex] + ' ' + lines[mergeIndex + 1];
    lines.splice(mergeIndex + 1, 1);
  }

  while (lines.length < 4) {
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Use AI to intelligently reword a title to fit exactly 4 lines
 * Falls back to mechanical merge if AI fails
 */
async function rewordTitleToFourLines(title) {
  const titleText = title || '';
  const lines = titleText.split('\n').map(l => l.trim()).filter(l => l);

  // If already 4 lines or fewer, use fallback (handles padding)
  if (lines.length <= 4) {
    return capitalizeAcronyms(enforceExactlyFourLinesFallback(title));
  }

  try {
    const model = genAI.getGenerativeModel({
      model: CONFIG.API.GEMINI_MODEL,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 100
      }
    });

    const prompt = `Reword this slide title to fit EXACTLY 4 lines while preserving the meaning.

Current title (${lines.length} lines):
${titleText}

Rules:
- Output EXACTLY 4 lines separated by newlines
- Each line should be 1-2 words, max 10 characters
- Preserve the core message and meaning
- Use impactful, concise language
- KEEP ACRONYMS CAPITALIZED (e.g., DRR, CDM, API, ROI, CFTC, ESG)

Output ONLY the 4-line title, nothing else:`;

    const result = await model.generateContent(prompt);
    const rewordedTitle = result.response.text().trim();
    const rewordedLines = rewordedTitle.split('\n').map(l => l.trim()).filter(l => l);

    // Verify AI produced exactly 4 lines
    if (rewordedLines.length === 4) {
      console.log(`[PPT Export] AI reworded title from ${lines.length} to 4 lines`);
      return capitalizeAcronyms(rewordedLines.join('\n'));
    }

    // AI didn't produce 4 lines, fall back
    console.log(`[PPT Export] AI produced ${rewordedLines.length} lines, using fallback`);
    return capitalizeAcronyms(enforceExactlyFourLinesFallback(title));
  } catch (error) {
    console.log(`[PPT Export] AI rewording failed: ${error.message}, using fallback`);
    return capitalizeAcronyms(enforceExactlyFourLinesFallback(title));
  }
}

function getParagraphText(slideData) {
  // Current schema: paragraph1 and paragraph2 as separate string fields
  if (slideData.paragraph1 || slideData.paragraph2) {
    const parts = [];
    if (slideData.paragraph1) parts.push(slideData.paragraph1.trim());
    if (slideData.paragraph2) parts.push(slideData.paragraph2.trim());
    return parts.join('\n\n');
  }
  // Legacy: body field with double-newline separated paragraphs
  if (slideData.body) {
    return slideData.body.trim();
  }
  return '';
}

// ============================================================================
// SECTION FLATTENING - Convert sections structure to flat slides array
// ============================================================================

/**
 * Flatten sections structure into a linear array of slides
 * Inserts section title slides at the start of each section
 * @param {Array} sections - Array of section objects with swimlane and slides
 * @returns {Array} Flattened array of slides
 */
function flattenSections(sections) {
  const flatSlides = [];

  for (const section of sections) {
    // Add section title slide
    flatSlides.push({
      layout: 'sectionTitle',
      swimlane: section.swimlane,
      sectionTitle: section.sectionTitle || section.swimlane
    });

    // Add all content slides for this section
    if (section.slides?.length) {
      flatSlides.push(...section.slides);
    }
  }

  return flatSlides;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function generatePptx(slidesData, options = {}) {
  const pptx = new PptxGenJS();

  pptx.author = options.author || DEFAULT_METADATA.author;
  pptx.company = options.company || DEFAULT_METADATA.company;
  pptx.title = slidesData.title || DEFAULT_METADATA.title;
  pptx.subject = options.subject || DEFAULT_METADATA.subject;
  pptx.revision = DEFAULT_METADATA.revision;

  pptx.defineLayout({ name: 'CUSTOM_16_9', width: SLIDE_SIZE.width, height: SLIDE_SIZE.height });
  pptx.layout = 'CUSTOM_16_9';

  // Handle sections structure (aligned with Gantt swimlanes)
  let slidesArray;
  if (slidesData.sections?.length) {
    console.log(`[PPT Export] Processing ${slidesData.sections.length} sections`);
    slidesArray = flattenSections(slidesData.sections);
  } else {
    console.log(`[PPT Export] No sections found in slides data`);
    slidesArray = [];
  }

  // Pre-process titles that need rewording (more than 4 lines) - only for content slides
  const processedSlides = await Promise.all(
    slidesArray.map(async (slideData) => {
      // Skip title rewording for section title slides
      if (slideData.layout === 'sectionTitle') {
        return slideData;
      }
      const titleLines = (slideData.title || '').split('\n').filter(l => l.trim()).length;
      if (titleLines > 4) {
        const rewordedTitle = await rewordTitleToFourLines(slideData.title);
        return { ...slideData, title: rewordedTitle };
      }
      return slideData;
    })
  );

  for (let i = 0; i < processedSlides.length; i++) {
    const slideData = processedSlides[i];
    const layout = slideData.layout || 'twoColumn';

    if (layout === 'sectionTitle') {
      addSectionTitleSlide(pptx, slideData, i + 1);
    } else if (layout === 'threeColumn') {
      addTextThreeColumnSlide(pptx, slideData, i + 1);
    } else {
      addTextTwoColumnSlide(pptx, slideData, i + 1);
    }
  }

  return await pptx.write({ outputType: 'nodebuffer' });
}

// ============================================================================
// SLIDE RENDERERS
// ============================================================================

/**
 * Add a section title slide (full-bleed red background with centered title)
 */
function addSectionTitleSlide(pptx, slideData, slideNumber) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.red };

  // Swimlane label (top left, navy)
  if (slideData.swimlane) {
    slide.addText(slideData.swimlane.toUpperCase(), {
      x: 0.5,
      y: 0.4,
      w: 5,
      h: 0.4,
      fontSize: 14,
      fontFace: FONTS.workSansSemiBold,
      color: COLORS.navy,
      align: 'left'
    });
  }

  // Main section title (centered, large, white)
  slide.addText(slideData.sectionTitle || slideData.swimlane || '', {
    x: 0.5,
    y: 2.5,
    w: SLIDE_SIZE.width - 1,
    h: 2,
    fontSize: 60,
    fontFace: FONTS.workSansThin,
    color: COLORS.white,
    align: 'center',
    valign: 'middle'
  });

  // Decorative navy line under title
  slide.addShape(pptx.ShapeType.rect, {
    x: (SLIDE_SIZE.width - 2) / 2,
    y: 4.7,
    w: 2,
    h: 0.04,
    fill: { color: COLORS.navy },
    line: { color: COLORS.navy, width: 0 }
  });

  // White BIP logo (bottom right)
  slide.addImage({
    path: 'Public/bip_logo.png',
    x: SLIDE_SIZE.width - 1.5,
    y: SLIDE_SIZE.height - 0.7,
    w: 1.0,
    h: 0.5
  });

  // Page number (bottom left, muted white)
  slide.addText(String(slideNumber), {
    x: 0.28,
    y: SLIDE_SIZE.height - 0.5,
    w: 0.5,
    h: 0.3,
    fontSize: 10,
    fontFace: FONTS.workSansRegular,
    color: 'AAAAAA',
    align: 'left'
  });
}

function addTextTwoColumnSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.textTwoColumn;
  const slide = pptx.addSlide();
  slide.background = { color: layout.background };

  const sectionLabel = getSectionLabel(slideData);
  if (sectionLabel) {
    slide.addText(sectionLabel, {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  slide.addText(capitalizeAcronyms(enforceExactlyFourLinesFallback(slideData.title)), {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align,
    italic: layout.elements.title.italic,
    lineSpacing: layout.elements.title.lineSpacing
  });

  const paragraphText = getParagraphText(slideData);
  if (paragraphText) {
    slide.addText(paragraphText, {
      x: layout.elements.paragraphs.x,
      y: layout.elements.paragraphs.y,
      w: layout.elements.paragraphs.w,
      h: layout.elements.paragraphs.h,
      fontSize: layout.elements.paragraphs.fontSize,
      fontFace: layout.elements.paragraphs.fontFace,
      color: layout.elements.paragraphs.color,
      align: 'left',
      valign: 'top',
      lineSpacing: layout.elements.paragraphs.lineSpacing
    });
  }

  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });
}

function addTextThreeColumnSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.textThreeColumn;
  const slide = pptx.addSlide();
  slide.background = { color: layout.background };

  // Section label / tagline
  const sectionLabel = getSectionLabel(slideData);
  if (sectionLabel) {
    slide.addText(sectionLabel, {
      x: layout.elements.sectionLabel.x,
      y: layout.elements.sectionLabel.y,
      w: layout.elements.sectionLabel.w,
      h: layout.elements.sectionLabel.h,
      fontSize: layout.elements.sectionLabel.fontSize,
      fontFace: layout.elements.sectionLabel.fontFace,
      color: layout.elements.sectionLabel.color,
      align: layout.elements.sectionLabel.align
    });
  }

  // Title (narrower, non-italic for this layout)
  slide.addText(capitalizeAcronyms(enforceExactlyFourLinesFallback(slideData.title)), {
    x: layout.elements.title.x,
    y: layout.elements.title.y,
    w: layout.elements.title.w,
    h: layout.elements.title.h,
    fontSize: layout.elements.title.fontSize,
    fontFace: layout.elements.title.fontFace,
    color: layout.elements.title.color,
    align: layout.elements.title.align,
    italic: layout.elements.title.italic,
    lineSpacing: layout.elements.title.lineSpacing
  });

  // Three columns - each as separate text box
  const colConfig = layout.elements.threeColumns;
  const colWidth = (colConfig.w - (colConfig.columnGap * 2)) / 3;
  const columns = [
    slideData.paragraph1 || '',
    slideData.paragraph2 || '',
    slideData.paragraph3 || ''
  ];

  columns.forEach((text, i) => {
    if (text) {
      const colX = colConfig.x + (i * (colWidth + colConfig.columnGap));
      slide.addText(text.trim(), {
        x: colX,
        y: colConfig.y,
        w: colWidth,
        h: colConfig.h,
        fontSize: colConfig.fontSize,
        fontFace: colConfig.fontFace,
        color: colConfig.color,
        align: 'left',
        valign: 'top',
        lineSpacing: colConfig.lineSpacing
      });
    }
  });

  // Page number
  slide.addText(String(slideNumber), {
    x: layout.elements.pageNumber.x,
    y: layout.elements.pageNumber.y,
    w: layout.elements.pageNumber.w,
    h: layout.elements.pageNumber.h,
    fontSize: layout.elements.pageNumber.fontSize,
    fontFace: layout.elements.pageNumber.fontFace,
    color: layout.elements.pageNumber.color,
    align: layout.elements.pageNumber.align
  });
}

export default { generatePptx };
