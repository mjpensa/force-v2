/**
 * PPT Template Configuration
 * Slide layouts: textTwoColumn, textThreeColumn
 * Text-only elements (no logos or graphics)
 */

// Brand colors (only used colors)
export const COLORS = {
  navy: '0C2340',
  red: 'DA291C',
  white: 'FFFFFF',
  darkGray: '6B7280'
};

// Brand fonts (only used fonts)
export const FONTS = {
  workSansThin: 'Work Sans Thin',
  workSansRegular: 'Work Sans',
  workSansSemiBold: 'Work Sans SemiBold'
};

// Slide dimensions (16:9)
export const SLIDE_SIZE = {
  width: 13.33,
  height: 7.5
};

// Slide layouts - text elements only
export const LAYOUTS = {
  textTwoColumn: {
    name: 'Text Two Column',
    background: COLORS.white,
    elements: {
      sectionLabel: {
        x: 0.28, y: 0.26, w: 2.23, h: 0.26,
        fontSize: 12, fontFace: FONTS.workSansSemiBold, color: COLORS.red, align: 'left'
      },
      title: {
        x: 0.25, y: 0.52, w: 5.94, h: 3.0,
        fontSize: 72, fontFace: FONTS.workSansThin, color: COLORS.navy,
        align: 'left', italic: false, lineSpacing: 70
      },
      paragraphs: {
        x: 6.74, y: 4.28, w: 5.91, h: 2.78,
        fontSize: 12, fontFace: FONTS.workSansRegular, color: COLORS.navy,
        lineSpacing: 135, paragraphSpacing: 12
      },
      pageNumber: {
        x: 0.28, y: 7.15, w: 0.5, h: 0.2,
        fontSize: 10, fontFace: FONTS.workSansRegular, color: COLORS.darkGray, align: 'left'
      }
    }
  },
  textThreeColumn: {
    name: 'Text Three Column',
    background: COLORS.white,
    elements: {
      sectionLabel: {
        x: 0.28, y: 0.26, w: 2.23, h: 0.26,
        fontSize: 12, fontFace: FONTS.workSansSemiBold, color: COLORS.red, align: 'left'
      },
      title: {
        x: 0.25, y: 0.52, w: 2.76, h: 3.0,
        fontSize: 44, fontFace: FONTS.workSansThin, color: COLORS.navy,
        align: 'left', italic: false, lineSpacing: 70
      },
      threeColumns: {
        x: 3.56, y: 3.46, w: 9.10, h: 3.52,
        fontSize: 12, fontFace: FONTS.workSansRegular, color: COLORS.navy,
        lineSpacing: 130, columnGap: 0.59
      },
      pageNumber: {
        x: 0.28, y: 7.15, w: 0.5, h: 0.2,
        fontSize: 10, fontFace: FONTS.workSansRegular, color: COLORS.darkGray, align: 'left'
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
