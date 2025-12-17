/**
 * DOCX Template Configuration
 * Document styles and formatting for Word export
 * BIP format (coral red headings, black body)
 */

// Brand colors (hex without #)
export const COLORS = {
  coral: 'C54B4B',        // BIP coral red for headings
  black: '000000',        // Body text
  navy: '1E3A5F',         // Navy for table headers
  white: 'FFFFFF',
  darkGray: '6B7280',     // Subtitles, captions
  lightGray: 'F3F4F6',
  linkBlue: '0563C1'      // Hyperlinks
};

// Brand fonts (BIP uses Arial)
export const FONTS = {
  heading: 'Arial',
  body: 'Arial',
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

// Style definitions for document elements (BIP format - coral headings)
export const STYLES = {
  title: {
    font: FONTS.heading,
    size: FONT_SIZES.title,        // 24pt
    color: COLORS.coral,           // Coral red title
    bold: true
  },
  subtitle: {
    font: FONTS.body,
    size: FONT_SIZES.body,
    color: COLORS.darkGray,
    italics: true
  },
  heading1: {
    font: FONTS.heading,
    size: 28,                       // 14pt
    color: COLORS.coral,           // Coral red heading
    bold: false                    // Not bold per BIP format
  },
  heading2: {
    font: FONTS.heading,
    size: 24,                       // 12pt
    color: COLORS.coral,           // Coral red heading
    bold: false
  },
  heading3: {
    font: FONTS.heading,
    size: 24,                       // 12pt
    color: COLORS.coral,           // Coral red heading
    bold: false
  },
  body: {
    font: FONTS.body,
    size: FONT_SIZES.body,         // 11pt
    color: COLORS.black
  },
  label: {
    font: FONTS.body,
    size: FONT_SIZES.small,
    color: COLORS.coral,          // Coral red labels
    bold: true,
    allCaps: true
  },
  keyInsight: {
    font: FONTS.body,
    size: FONT_SIZES.body,
    color: COLORS.black,
    bold: true,
    italics: false
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
  },
  tableHeader: {
    font: FONTS.body,
    size: FONT_SIZES.small,
    color: COLORS.white,
    bold: true
  },
  tableCell: {
    font: FONTS.body,
    size: FONT_SIZES.small,
    color: COLORS.black
  }
};

export const DEFAULT_METADATA = {
  title: 'Executive Summary',
  creator: 'BIP',
  company: 'BIP',
  description: 'Generated Document'
};

export default { COLORS, FONTS, PAGE, FONT_SIZES, SPACING, STYLES, DEFAULT_METADATA };
