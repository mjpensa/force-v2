/**
 * PPT Export Service - Simplified
 * Only 3 slide types: textTwoColumn, textThreeColumn, textWithCards
 * Text-only elements (no logos or graphics)
 */

import PptxGenJS from 'pptxgenjs';
import { SLIDE_SIZE, LAYOUTS, DEFAULT_METADATA } from './ppt-template-config.js';

// ============================================================================
// HELPERS
// ============================================================================

function getSectionLabel(slideData) {
  const label = slideData.section || slideData.sectionLabel;
  return label ? String(label).toUpperCase() : null;
}

function getArrayProp(slideData, ...propNames) {
  for (const prop of propNames) {
    const value = slideData[prop];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

function getStringProp(slideData, ...propNames) {
  for (const prop of propNames) {
    const value = slideData[prop];
    if (typeof value === 'string' && value.trim()) return value.trim();
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
    const slideNumber = i + 1;

    switch (slideData.type) {
      case 'textTwoColumn':
        addTextTwoColumnSlide(pptx, slideData, slideNumber);
        break;
      case 'textThreeColumn':
        addTextThreeColumnSlide(pptx, slideData, slideNumber);
        break;
      case 'textWithCards':
        addTextWithCardsSlide(pptx, slideData, slideNumber);
        break;
      default:
        if (slideData.cards?.length > 0) {
          addTextWithCardsSlide(pptx, slideData, slideNumber);
        } else if (slideData.columns?.length > 0) {
          addTextThreeColumnSlide(pptx, slideData, slideNumber);
        } else {
          addTextTwoColumnSlide(pptx, slideData, slideNumber);
        }
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

  const paragraphs = getArrayProp(slideData, 'paragraphs', 'content');
  if (paragraphs.length > 0) {
    const paragraphText = paragraphs.map(p => String(p)).join('\n\n');
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

  const columnsConfig = layout.elements.columns;
  const columns = getArrayProp(slideData, 'columns');
  for (let i = 0; i < Math.min(3, columns.length); i++) {
    const x = columnsConfig.startX + (i * (columnsConfig.columnWidth + columnsConfig.columnGap));
    slide.addText(columns[i] || '', {
      x: x,
      y: columnsConfig.y,
      w: columnsConfig.columnWidth,
      h: columnsConfig.h,
      fontSize: columnsConfig.fontSize,
      fontFace: columnsConfig.fontFace,
      color: columnsConfig.color,
      align: 'left',
      valign: 'top',
      lineSpacing: columnsConfig.lineSpacing
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

function addTextWithCardsSlide(pptx, slideData, slideNumber) {
  const layout = LAYOUTS.textWithCards;
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

  const content = getStringProp(slideData, 'content', 'text', 'description');
  if (content) {
    slide.addText(content, {
      x: layout.elements.content.x,
      y: layout.elements.content.y,
      w: layout.elements.content.w,
      h: layout.elements.content.h,
      fontSize: layout.elements.content.fontSize,
      fontFace: layout.elements.content.fontFace,
      color: layout.elements.content.color,
      align: 'left',
      valign: 'top',
      lineSpacing: layout.elements.content.lineSpacing
    });
  }

  const cardsConfig = layout.elements.cards;
  const cards = getArrayProp(slideData, 'cards');
  cards.slice(0, 6).forEach((card, i) => {
    const row = Math.floor(i / cardsConfig.columns);
    const col = i % cardsConfig.columns;
    const x = cardsConfig.startX + (col * (cardsConfig.cardWidth + cardsConfig.gapX));
    const y = cardsConfig.startY + (row * (cardsConfig.cardHeight + cardsConfig.gapY));

    // Card background
    slide.addShape('rect', {
      x, y, w: cardsConfig.cardWidth, h: cardsConfig.cardHeight,
      fill: { color: cardsConfig.cardBackground }
    });

    // Number circle
    const circleX = x + cardsConfig.padding;
    const circleY = y + cardsConfig.padding;
    slide.addShape('ellipse', {
      x: circleX, y: circleY,
      w: cardsConfig.numberCircleSize, h: cardsConfig.numberCircleSize,
      fill: { color: cardsConfig.numberCircleColor }
    });

    // Number text
    slide.addText(String(i + 1), {
      x: circleX, y: circleY,
      w: cardsConfig.numberCircleSize, h: cardsConfig.numberCircleSize,
      fontSize: cardsConfig.numberFontSize,
      fontFace: cardsConfig.numberFontFace,
      color: cardsConfig.numberColor,
      align: 'center',
      valign: 'middle',
      bold: true
    });

    // Card title
    const titleY = y + cardsConfig.padding + cardsConfig.numberCircleSize + 0.1;
    slide.addText(card.title || '', {
      x: x + cardsConfig.padding,
      y: titleY,
      w: cardsConfig.cardWidth - (cardsConfig.padding * 2),
      h: 0.4,
      fontSize: cardsConfig.titleFontSize,
      fontFace: cardsConfig.titleFontFace,
      color: cardsConfig.titleColor,
      align: 'left',
      valign: 'top',
      bold: true
    });

    // Card content
    if (card.content) {
      slide.addText(card.content, {
        x: x + cardsConfig.padding,
        y: titleY + 0.35,
        w: cardsConfig.cardWidth - (cardsConfig.padding * 2),
        h: cardsConfig.cardHeight - titleY - 0.4 + y,
        fontSize: cardsConfig.contentFontSize,
        fontFace: cardsConfig.contentFontFace,
        color: cardsConfig.contentColor,
        align: 'left',
        valign: 'top'
      });
    }
  });

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
