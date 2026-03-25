// Brand colors (hex without #) - SKILL.md specifications
export const COLORS = {
  red: 'DA291C',           // Section headers
  black: '000000',         // Body text
  navy: '0C2340',          // Table header background (matches PPTX brand)
  white: 'FFFFFF',         // Table header text
  gray: '808080',          // Subtitle/caption
  borderLight: 'CCCCCC',   // Data row borders
  altRowGray: 'F2F2F2',    // Alternating row background
  highlightPink: 'FFE3E3'  // Special emphasis cells
};

// Brand fonts - SKILL.md specifications (Work Sans)
export const FONTS = {
  heading: 'Work Sans',
  body: 'Work Sans',
  title: 'Work Sans Light',  // Title only - NOT bold
  mono: 'Consolas'
};

// Page layout (in twips: 1 inch = 1440 twips) - A4 per SKILL.md
export const PAGE = {
  width: 11906,   // A4 width
  height: 16838,  // A4 height
  margins: {
    top: 1440,    // 1 inch
    right: 1440,
    bottom: 1440,
    left: 1440
  },
  headerDistance: 708,
  footerDistance: 708
};

// Font sizes (in half-points: 24 = 12pt) - SKILL.md specifications
export const FONT_SIZES = {
  title: 48,           // 24pt - Work Sans Light
  heading1Small: 28,   // 14pt - Small section headers
  body: 22,            // 11pt
  subtitle: 22,        // 11pt - Gray italic
  tableHeader: 18,     // 9pt - Bold white on navy
  tableData: 18,       // 9pt
  highlightCell: 16,   // 8pt - Bold in pink cells
};

// Spacing (in twips) - SKILL.md specifications
export const SPACING = {
  // Title block
  titleAfter: 120,
  subtitleAfter: 400,

  // Section headers
  sectionBefore: 360,
  sectionAfter: 160,

  // Body content
  paragraphAfter: 160,
  paragraphBefore: 0,
  bulletAfter: 120,

  // Tables
  tableSpaceBefore: 240,
  tableSpaceAfter: 240,

  // Multi-paragraph cells
  cellParagraphSpacing: 80,

  // Line spacing
  lineSpacing: 276     // 1.15 line spacing
};

// Style definitions for document elements - SKILL.md specifications
export const STYLES = {
  heading1: {
    font: FONTS.heading,           // Work Sans
    size: FONT_SIZES.title,        // 24pt for large headers
    color: COLORS.red,             // Red #DA291C
    bold: false                    // NOT bold per SKILL.md
  },
  heading2: {
    font: FONTS.heading,
    size: FONT_SIZES.heading1Small, // 14pt
    color: COLORS.red,
    bold: false
  },
  heading3: {
    font: FONTS.heading,
    size: FONT_SIZES.heading1Small, // 14pt
    color: COLORS.red,
    bold: false
  },
  body: {
    font: FONTS.body,
    size: FONT_SIZES.body,         // 11pt
    color: COLORS.black
  },
  label: {
    font: FONTS.body,
    size: FONT_SIZES.body,
    color: COLORS.red,             // Red labels
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
    color: COLORS.gray,
    italics: true
  },
  source: {
    font: FONTS.body,
    size: FONT_SIZES.tableData,
    color: COLORS.gray
  }
};

export const DEFAULT_METADATA = {
  title: 'Executive Summary',
  creator: 'BIP',
  description: 'Generated Document'
};

// Column width calculation helpers (in DXA) - SKILL.md specifications
// Total usable width for A4 with 1" margins: ~9300 DXA
export const COLUMN_WIDTHS = {
  singleChar: 800,      // Single character/dash
  percentage: 850,      // "40%", "65%"
  shortText: 1200,      // 1-3 words
  mediumText: 1900,     // 4-8 words
  longText: 3500,       // Full sentences
  rowLabel: 1800,       // First column labels
  highlight: 1100,      // Highlight columns
  TOTAL_A4: 9300        // Target sum for A4
};

export default { COLORS, FONTS, PAGE, FONT_SIZES, SPACING, STYLES, DEFAULT_METADATA, COLUMN_WIDTHS };
