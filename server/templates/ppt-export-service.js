/**
 * PPT Export Service
 * Slide types: textTwoColumn, textThreeColumn
 * Text-only elements (no logos or graphics)
 */

import PptxGenJS from 'pptxgenjs';
import { SLIDE_SIZE, LAYOUTS, DEFAULT_METADATA } from './ppt-template-config.js';

// ============================================================================
// HELPERS
// ============================================================================

function getSectionLabel(slideData) {
  const label = slideData.section || slideData.sectionLabel || slideData.tagline;
  return label ? String(label).toUpperCase() : null;
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

  for (let i = 0; i < slidesData.slides.length; i++) {
    const slideData = slidesData.slides[i];
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

  slide.addText(slideData.title || 'Slide Title', {
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
  slide.addText(slideData.title || 'Slide Title', {
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
