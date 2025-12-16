/**
 * DOCX Template Configuration
 * Document styles and formatting for Word export
 * Matches PPT branding (navy, red, white)
 */

// Brand colors (hex without #)
export const COLORS = {
  navy: '0C2340',
  red: 'DA291C',
  white: 'FFFFFF',
  darkGray: '6B7280',
  lightGray: 'F3F4F6'
};

// Brand fonts
export const FONTS = {
  heading: 'Work Sans',
  body: 'Work Sans',
  mono: 'Consolas'
};

// Page layout (in twips: 1 inch = 1440 twips)
export const PAGE = {
  width: 12240,  // 8.5 inches
  height: 15840, // 11 inches
  margins: {
    top: 1440,    // 1 inch
    right: 1440,
    bottom: 1440,
    left: 1440
  }
};

// Font sizes (in half-points: 24 = 12pt)
export const FONT_SIZES = {
  title: 48,           // 24pt
  heading1: 36,        // 18pt
  heading2: 28,        // 14pt
  heading3: 24,        // 12pt
  body: 22,            // 11pt
  small: 20,           // 10pt
  caption: 18          // 9pt
};

// Spacing (in twips)
export const SPACING = {
  paragraphAfter: 200,
  paragraphBefore: 0,
  lineSpacing: 276,    // 1.15 line spacing
  sectionGap: 400
};

// Style definitions for document elements
export const STYLES = {
  title: {
    font: FONTS.heading,
    size: FONT_SIZES.title,
    color: COLORS.navy,
    bold: true
  },
  heading1: {
    font: FONTS.heading,
    size: FONT_SIZES.heading1,
    color: COLORS.navy,
    bold: true
  },
  heading2: {
    font: FONTS.heading,
    size: FONT_SIZES.heading2,
    color: COLORS.navy,
    bold: true
  },
  heading3: {
    font: FONTS.heading,
    size: FONT_SIZES.heading3,
    color: COLORS.navy,
    bold: true
  },
  body: {
    font: FONTS.body,
    size: FONT_SIZES.body,
    color: COLORS.navy
  },
  label: {
    font: FONTS.body,
    size: FONT_SIZES.small,
    color: COLORS.red,
    bold: true,
    allCaps: true
  },
  keyInsight: {
    font: FONTS.body,
    size: FONT_SIZES.body,
    color: COLORS.navy,
    bold: true,
    italics: true
  },
  quote: {
    font: FONTS.body,
    size: FONT_SIZES.body,
    color: COLORS.darkGray,
    italics: true
  },
  source: {
    font: FONTS.body,
    size: FONT_SIZES.caption,
    color: COLORS.darkGray
  }
};

export const DEFAULT_METADATA = {
  title: 'Executive Summary',
  creator: 'BIP',
  company: 'BIP',
  description: 'Generated Document'
};

export default { COLORS, FONTS, PAGE, FONT_SIZES, SPACING, STYLES, DEFAULT_METADATA };
