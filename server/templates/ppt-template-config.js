/**
 * PPT Template Configuration - Simplified
 * Single slide layout: textTwoColumn
 * Text-only elements (no logos or graphics)
 */

// Brand colors (only used colors)
export const COLORS = {
  navy: '0C2340',
  red: 'DA291C',
  white: 'FFFFFF',
  lightGray: 'E8E8E8',
  darkGray: '6B7280'
};

// Brand fonts (only used fonts)
export const FONTS = {
  thin: 'Work Sans Thin',
  regular: 'Work Sans',
  semibold: 'Work Sans SemiBold',
  bold: 'Work Sans Bold'
};

// Slide dimensions (16:9)
export const SLIDE_SIZE = {
  width: 13.33,
  height: 7.5
};

// Single layout - text elements only
export const LAYOUTS = {
  textTwoColumn: {
    name: 'Text Two Column',
    background: COLORS.white,
    elements: {
      sectionLabel: {
        x: 0.33, y: 0.17, w: 3, h: 0.25,
        fontSize: 10, fontFace: FONTS.semibold, color: COLORS.red, align: 'left'
      },
      title: {
        x: 0.33, y: 0.5, w: 4.5, h: 2.5,
        fontSize: 48, fontFace: FONTS.thin, color: COLORS.navy,
        align: 'left', italic: true, lineSpacing: 85
      },
      paragraphs: {
        x: 5.5, y: 0.8, w: 7.5, h: 5.5,
        fontSize: 11, fontFace: FONTS.regular, color: COLORS.navy,
        lineSpacing: 160, paragraphSpacing: 20
      },
      pageNumber: {
        x: 0.33, y: 7.15, w: 0.5, h: 0.2,
        fontSize: 8, fontFace: FONTS.regular, color: COLORS.darkGray, align: 'left'
      }
    }
  }
};

export const DEFAULT_METADATA = {
  title: 'Presentation',
  author: 'BIP',
  company: 'BIP',
  revision: '1',
  subject: 'Generated Presentation'
};

export default { COLORS, FONTS, SLIDE_SIZE, LAYOUTS, DEFAULT_METADATA };
