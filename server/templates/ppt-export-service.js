/**
 * PPT Export Service
 * Slide types: textTwoColumn, textThreeColumn
 * Text-only elements (no logos or graphics)
 */

import PptxGenJS from 'pptxgenjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SLIDE_SIZE, LAYOUTS, DEFAULT_METADATA } from './ppt-template-config.js';
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
    return enforceExactlyFourLinesFallback(title);
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

Output ONLY the 4-line title, nothing else:`;

    const result = await model.generateContent(prompt);
    const rewordedTitle = result.response.text().trim();
    const rewordedLines = rewordedTitle.split('\n').map(l => l.trim()).filter(l => l);

    // Verify AI produced exactly 4 lines
    if (rewordedLines.length === 4) {
      console.log(`[PPT Export] AI reworded title from ${lines.length} to 4 lines`);
      return rewordedLines.join('\n');
    }

    // AI didn't produce 4 lines, fall back
    console.log(`[PPT Export] AI produced ${rewordedLines.length} lines, using fallback`);
    return enforceExactlyFourLinesFallback(title);
  } catch (error) {
    console.log(`[PPT Export] AI rewording failed: ${error.message}, using fallback`);
    return enforceExactlyFourLinesFallback(title);
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

  // Pre-process titles that need rewording (more than 4 lines)
  const processedSlides = await Promise.all(
    slidesData.slides.map(async (slideData) => {
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

    if (layout === 'threeColumn') {
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

  slide.addText(enforceExactlyFourLinesFallback(slideData.title), {
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
  slide.addText(enforceExactlyFourLinesFallback(slideData.title), {
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
