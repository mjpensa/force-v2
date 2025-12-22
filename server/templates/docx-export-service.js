/**
 * DOCX Export Service
 * Generates Word documents from document data
 * SKILL.md format (Work Sans fonts, red headings, proper table formatting)
 * Supports executive summary, analysis overview, and content sections
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  VerticalAlign,
  TableLayoutType,
  convertInchesToTwip,
  LevelFormat
} from 'docx';
import { COLORS, FONTS, STYLES, PAGE, SPACING, DEFAULT_METADATA, COLUMN_WIDTHS, FONT_SIZES } from './docx-template-config.js';

// ============================================================================
// NUMBERING (Custom bullet definitions)
// ============================================================================

/**
 * Standard bullet numbering configuration
 * Uses a small bullet character (•) with proper sizing
 */
const BULLET_NUMBERING = {
  config: [
    {
      reference: 'standard-bullets',
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: 720, hanging: 360 }
            },
            run: {
              font: FONTS.body,
              size: FONT_SIZES.body
            }
          }
        },
        {
          level: 1,
          format: LevelFormat.BULLET,
          text: '◦',
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: 1080, hanging: 360 }
            },
            run: {
              font: FONTS.body,
              size: FONT_SIZES.body
            }
          }
        }
      ]
    }
  ]
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert hex color to docx format (without #)
 */
function hexColor(color) {
  return color.replace('#', '');
}

/**
 * Create a styled text run
 */
function styledText(text, style = {}) {
  return new TextRun({
    text: text || '',
    font: style.font || FONTS.body,
    size: style.size || STYLES.body.size,
    color: hexColor(style.color || COLORS.black),
    bold: style.bold || false,
    italics: style.italics || false,
    allCaps: style.allCaps || false
  });
}

/**
 * Create a heading paragraph (SKILL.md format - red, not bold)
 */
function createHeading(text, level = 1) {
  const headingStyles = {
    1: { level: HeadingLevel.HEADING_1, ...STYLES.heading1 },
    2: { level: HeadingLevel.HEADING_2, ...STYLES.heading2 },
    3: { level: HeadingLevel.HEADING_3, ...STYLES.heading3 }
  };

  const style = headingStyles[level] || headingStyles[2];

  // SKILL.md spacing: 360 before, 160 after for section headers
  const spaceBefore = level === 1 ? SPACING.sectionLargeBefore : SPACING.sectionSmallBefore;
  const spaceAfter = level === 1 ? SPACING.sectionLargeAfter : SPACING.sectionSmallAfter;

  return new Paragraph({
    heading: style.level,
    spacing: { before: spaceBefore, after: spaceAfter },
    children: [styledText(text, style)]
  });
}

/**
 * Create a body paragraph
 */
function createParagraph(text, options = {}) {
  return new Paragraph({
    spacing: {
      before: options.spaceBefore || 0,
      after: options.spaceAfter || SPACING.paragraphAfter,
      line: SPACING.lineSpacing
    },
    alignment: options.alignment || AlignmentType.LEFT,
    children: [styledText(text, options.style || STYLES.body)]
  });
}

/**
 * Create a label paragraph (black bold, uppercase - v19)
 */
function createLabel(text) {
  return new Paragraph({
    spacing: { before: SPACING.sectionGap, after: 100 },
    children: [styledText(text.toUpperCase(), STYLES.label)]
  });
}

/**
 * Create a key insight callout (navy left border)
 */
function createKeyInsight(text) {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 24, color: hexColor(COLORS.navy) }
    },
    indent: { left: 200 },
    children: [styledText(text, STYLES.keyInsight)]
  });
}

/**
 * Create a quote/evidence block
 */
function createQuoteBlock(quote, source) {
  const children = [];

  // Quote text
  children.push(new Paragraph({
    spacing: { before: 150, after: 100 },
    indent: { left: 400 },
    children: [
      styledText('"', { ...STYLES.quote, size: 28 }),
      styledText(quote, STYLES.quote),
      styledText('"', { ...STYLES.quote, size: 28 })
    ]
  }));

  // Source attribution
  if (source) {
    children.push(new Paragraph({
      spacing: { after: 150 },
      indent: { left: 400 },
      alignment: AlignmentType.RIGHT,
      children: [styledText(`— ${source}`, STYLES.source)]
    }));
  }

  return children;
}

/**
 * Create a bullet point (SKILL.md format)
 * Uses custom numbering reference for standard-sized bullets
 */
function createBullet(text) {
  return new Paragraph({
    spacing: { after: SPACING.bulletAfter, line: SPACING.lineSpacing },
    numbering: {
      reference: 'standard-bullets',
      level: 0
    },
    children: [styledText(text, STYLES.body)]
  });
}

/**
 * Split text into paragraphs by double newlines
 */
function splitIntoParagraphs(text) {
  if (!text) return [];
  return text.split(/\n\n+/).filter(p => p.trim());
}

// ============================================================================
// TABLE HELPERS (SKILL.md compliant)
// ============================================================================

/**
 * Create a table header cell (navy background, white bold text)
 * @param {string} text - Cell text
 * @param {number} width - Cell width in DXA
 */
function createHeaderCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: {
      fill: hexColor(COLORS.navy),
      type: ShadingType.CLEAR,
      color: 'auto'
    },
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: convertInchesToTwip(0.03),
      bottom: convertInchesToTwip(0.03),
      left: convertInchesToTwip(0.06),
      right: convertInchesToTwip(0.06)
    },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: text || '',
        bold: true,
        color: hexColor(COLORS.white),
        size: FONT_SIZES.tableHeader,
        font: FONTS.body
      })]
    })]
  });
}

/**
 * Create a data cell with alternating row support
 * @param {string|string[]} content - Cell text or array for multi-paragraph
 * @param {number} width - Cell width in DXA
 * @param {boolean} isFirstCol - Bold if first column
 * @param {boolean} isAlternateRow - Apply gray background
 * @param {boolean} centered - Center align text
 */
function createDataCell(content, width, isFirstCol = false, isAlternateRow = false, centered = false) {
  const paragraphs = Array.isArray(content) ? content : [content];

  const children = paragraphs.map((para, idx) => new Paragraph({
    alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: idx > 0 ? { before: SPACING.cellParagraphSpacing } : {},
    children: [new TextRun({
      text: para || '',
      bold: isFirstCol,
      size: FONT_SIZES.tableData,
      font: FONTS.body
    })]
  }));

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: convertInchesToTwip(0.04),
      bottom: convertInchesToTwip(0.04),
      left: convertInchesToTwip(0.06),
      right: convertInchesToTwip(0.06)
    },
    shading: isAlternateRow
      ? { fill: hexColor(COLORS.altRowGray), type: ShadingType.CLEAR, color: 'auto' }
      : undefined,
    children: children
  });
}

/**
 * Create a highlight cell (pink background, bold centered)
 * IMPORTANT: Use placeholder for empty cells to maintain styling
 * @param {string} text - Cell text (use "\u2014" for empty)
 * @param {number} width - Cell width in DXA
 */
function createHighlightCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: {
      fill: hexColor(COLORS.highlightPink),
      type: ShadingType.CLEAR,
      color: 'auto'
    },
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: convertInchesToTwip(0.03),
      bottom: convertInchesToTwip(0.03),
      left: convertInchesToTwip(0.02),
      right: convertInchesToTwip(0.02)
    },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: text || '\u2014',  // Em dash placeholder for empty
        bold: true,
        color: hexColor(COLORS.black),
        size: FONT_SIZES.highlightCell,
        font: FONTS.body
      })]
    })]
  });
}

/**
 * Calculate column widths based on content
 * @param {string[]} headers - Column header texts
 * @param {string[][]} rows - Data rows
 * @param {Object} options - Options like hasHighlightColumn
 * @returns {number[]} Column widths in DXA (sum ~9300 for A4)
 */
function calculateColumnWidths(headers, rows, options = {}) {
  const numCols = headers.length;
  const { hasHighlightColumn = false } = options;

  // Calculate average content length per column
  const contentLengths = headers.map((_, colIdx) => {
    const allContent = [headers[colIdx], ...rows.map(r => r[colIdx] || '')];
    const avgLength = allContent.reduce((sum, c) => sum + (c?.length || 0), 0) / allContent.length;
    return avgLength;
  });

  // Map content lengths to width categories
  const widths = contentLengths.map((len, idx) => {
    if (idx === 0) return COLUMN_WIDTHS.rowLabel; // First column gets more space
    if (hasHighlightColumn && idx === numCols - 1) return COLUMN_WIDTHS.highlight;
    if (len < 5) return COLUMN_WIDTHS.singleChar;
    if (len < 10) return COLUMN_WIDTHS.percentage;
    if (len < 25) return COLUMN_WIDTHS.shortText;
    if (len < 50) return COLUMN_WIDTHS.mediumText;
    return COLUMN_WIDTHS.longText;
  });

  // Normalize to sum to ~9300
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = COLUMN_WIDTHS.TOTAL_A4 / total;

  return widths.map(w => Math.round(w * scale));
}

// ============================================================================
// SECTION BUILDERS
// ============================================================================

/**
 * Build the title section (SKILL.md format - Work Sans Light, centered)
 */
function buildTitleSection(title, subtitle) {
  const elements = [];

  // Main title - Work Sans Light 24pt, centered, NOT bold
  elements.push(new Paragraph({
    spacing: { before: 0, after: SPACING.titleAfter },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: title || '',
      font: FONTS.title,           // Work Sans Light
      size: FONT_SIZES.title,      // 48 (24pt)
      color: hexColor(COLORS.black),
      bold: false                  // NOT bold per SKILL.md
    })]
  }));

  // Subtitle if provided - Work Sans 11pt italic gray, centered
  if (subtitle) {
    elements.push(new Paragraph({
      spacing: { after: SPACING.subtitleAfter },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: subtitle,
        font: FONTS.body,
        size: FONT_SIZES.subtitle,
        color: hexColor(COLORS.gray),  // Gray #808080
        italics: true
      })]
    }));
  } else {
    elements.push(new Paragraph({
      spacing: { after: SPACING.subtitleAfter },
      children: []
    }));
  }

  return elements;
}


/**
 * Create a styled table with SKILL.md formatting
 * @param {string[]} headers - Column headers
 * @param {string[][]} rows - Data rows
 * @param {Object} options - Table options
 * @param {number[]} options.columnWidths - Explicit column widths (DXA)
 * @param {boolean} options.hasHighlightColumn - Last column is highlight style
 */
function createStyledTable(headers, rows, options = {}) {
  const {
    columnWidths = null,
    hasHighlightColumn = false
  } = options;

  // Calculate column widths if not provided
  const widths = columnWidths || calculateColumnWidths(headers, rows, { hasHighlightColumn });

  const tableRows = [];

  // Header row with navy background
  tableRows.push(new TableRow({
    tableHeader: true,
    children: headers.map((header, idx) => createHeaderCell(header, widths[idx]))
  }));

  // Data rows with alternating background
  rows.forEach((row, rowIdx) => {
    const isAlternateRow = rowIdx % 2 === 1; // Even index = white, odd = gray

    tableRows.push(new TableRow({
      children: row.map((cell, colIdx) => {
        // Use highlight cell for last column if specified
        if (hasHighlightColumn && colIdx === row.length - 1) {
          return createHighlightCell(cell, widths[colIdx]);
        }
        // Use data cell with alternating row support
        return createDataCell(
          cell,
          widths[colIdx],
          colIdx === 0,      // First column is bold
          isAlternateRow,    // Alternating gray background
          false              // Left aligned by default
        );
      })
    }));
  });

  // Table borders per SKILL.md
  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: hexColor(COLORS.borderLight) },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: hexColor(COLORS.borderLight) },
    left: { style: BorderStyle.SINGLE, size: 4, color: hexColor(COLORS.borderLight) },
    right: { style: BorderStyle.SINGLE, size: 4, color: hexColor(COLORS.borderLight) },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: hexColor(COLORS.borderLight) },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: hexColor(COLORS.borderLight) }
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: tableBorders,
    columnWidths: widths,  // CRITICAL: Explicit columnWidths array
    rows: tableRows
  });
}

/**
 * Build the executive summary section (SKILL.md format)
 */
function buildExecutiveSummary(execSummary) {
  if (!execSummary) return [];

  const elements = [];

  // Section heading - red (SKILL.md format)
  elements.push(createHeading('Executive Summary', 1));

  // Source badge if present
  if (execSummary.source) {
    elements.push(new Paragraph({
      spacing: { after: 200 },
      children: [
        styledText('Source: ', { ...STYLES.source, bold: true }),
        styledText(execSummary.source, STYLES.source)
      ]
    }));
  }

  // Main narrative paragraphs
  if (execSummary.narrative) {
    const paragraphs = splitIntoParagraphs(execSummary.narrative);
    paragraphs.forEach(p => {
      elements.push(createParagraph(p));
    });
  }

  // Context/Situation as clean paragraph
  if (execSummary.situation) {
    elements.push(createParagraph(execSummary.situation));
  }

  // Key Insight as clean paragraph
  if (execSummary.insight) {
    elements.push(createParagraph(execSummary.insight));
  }

  // Recommended Action
  if (execSummary.action) {
    elements.push(createParagraph(execSummary.action));
  }

  // Legacy format support
  if (!execSummary.situation && execSummary.stakes) {
    elements.push(createParagraph(execSummary.stakes));
  }
  if (!execSummary.insight && execSummary.keyFinding) {
    elements.push(createParagraph(execSummary.keyFinding));
  }
  if (!execSummary.action && execSummary.recommendation) {
    elements.push(createParagraph(execSummary.recommendation));
  }

  return elements;
}

/**
 * Build the analysis overview section (SKILL.md format)
 */
function buildAnalysisOverview(overview) {
  if (!overview) return [];

  const elements = [];

  // Section heading - red (SKILL.md format)
  elements.push(createHeading('Analysis Overview', 1));

  // Narrative paragraphs
  if (overview.narrative) {
    const paragraphs = splitIntoParagraphs(overview.narrative);
    paragraphs.forEach(p => {
      elements.push(createParagraph(p));
    });
  }

  // Key Themes
  if (overview.keyThemes && overview.keyThemes.length > 0) {
    elements.push(createHeading('Key Themes', 2));

    overview.keyThemes.forEach(theme => {
      // Theme name - bold black
      elements.push(new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [styledText(theme.theme, { ...STYLES.body, bold: true })]
      }));

      // Theme description
      if (theme.description) {
        elements.push(createParagraph(theme.description, {
          style: STYLES.body,
          spaceBefore: 0
        }));
      }

      // Affected topics
      if (theme.affectedTopics && theme.affectedTopics.length > 0) {
        elements.push(new Paragraph({
          spacing: { after: 150 },
          children: [
            styledText('Affects: ', { ...STYLES.source, italics: true }),
            styledText(theme.affectedTopics.join(', '), STYLES.source)
          ]
        }));
      }
    });
  }

  // Critical Findings
  if (overview.criticalFindings && overview.criticalFindings.length > 0) {
    elements.push(createHeading('Critical Findings', 3));
    overview.criticalFindings.forEach(finding => {
      elements.push(createBullet(finding));
    });
  }

  // Strategic Context
  if (overview.strategicContext) {
    elements.push(createHeading('Strategic Context', 3));
    const paragraphs = splitIntoParagraphs(overview.strategicContext);
    paragraphs.forEach(p => {
      elements.push(createParagraph(p));
    });
  }

  return elements;
}

/**
 * Build a content section (SKILL.md format)
 */
function buildContentSection(section, index) {
  const elements = [];

  // Section heading with number prefix ("Section 1: Title")
  const sectionNumber = index + 1;
  const sectionTitle = section.heading || `Section ${sectionNumber}`;
  const formattedTitle = section.swimlaneTopic
    ? `Section ${sectionNumber}: ${sectionTitle}`
    : sectionTitle;

  elements.push(createHeading(formattedTitle, 1));

  // Key insight as emphasized paragraph
  if (section.keyInsight) {
    elements.push(new Paragraph({
      spacing: { before: 200, after: 200 },
      children: [styledText(section.keyInsight, { ...STYLES.body, bold: true })]
    }));
  }

  // Research summary
  if (section.researchSummary) {
    elements.push(new Paragraph({
      spacing: { before: 200, after: 150 },
      children: [
        styledText('Research Summary: ', { ...STYLES.body, bold: true }),
        styledText(section.researchSummary, STYLES.body)
      ]
    }));
  }

  // Implications
  if (section.implications) {
    elements.push(new Paragraph({
      spacing: { before: 150, after: 200 },
      children: [
        styledText('Implications: ', { ...STYLES.body, bold: true }),
        styledText(section.implications, STYLES.body)
      ]
    }));
  }

  // Body paragraphs
  if (section.paragraphs && section.paragraphs.length > 0) {
    section.paragraphs.forEach(para => {
      if (typeof para === 'string') {
        elements.push(createParagraph(para));
      }
    });
  }

  // Supporting evidence
  if (section.supportingEvidence && section.supportingEvidence.length > 0) {
    elements.push(createHeading('Supporting Evidence', 2));

    section.supportingEvidence.forEach(evidence => {
      // Claim
      if (evidence.claim) {
        elements.push(new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [styledText(evidence.claim, { ...STYLES.body, bold: true })]
        }));
      }

      // Quote and source
      if (evidence.quote) {
        elements.push(...createQuoteBlock(evidence.quote, evidence.source));
      }
    });
  }

  // Subsection/spotlight if present ("Implementation Spotlight: ...")
  if (section.spotlight) {
    elements.push(createHeading(section.spotlight.title || 'Implementation Spotlight', 2));
    if (section.spotlight.content) {
      const paragraphs = splitIntoParagraphs(section.spotlight.content);
      paragraphs.forEach(p => {
        elements.push(createParagraph(p));
      });
    }
  }

  return elements;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Generate a Word document from document data (SKILL.md format)
 * @param {Object} documentData - Document content object
 * @param {Object} options - Export options
 * @returns {Promise<Buffer>} - Document buffer
 */
export async function generateDocx(documentData, options = {}) {
  const children = [];

  // Title with optional subtitle
  if (documentData.title) {
    children.push(...buildTitleSection(documentData.title, documentData.subtitle));
  }

  // Executive Summary
  if (documentData.executiveSummary) {
    children.push(...buildExecutiveSummary(documentData.executiveSummary));
  }

  // Analysis Overview
  if (documentData.analysisOverview) {
    children.push(...buildAnalysisOverview(documentData.analysisOverview));
  }

  // Content Sections
  if (documentData.sections && documentData.sections.length > 0) {
    documentData.sections.forEach((section, index) => {
      children.push(...buildContentSection(section, index));
    });
  }

  // Tables if provided
  if (documentData.tables && documentData.tables.length > 0) {
    documentData.tables.forEach(tableData => {
      if (tableData.title) {
        children.push(createHeading(tableData.title, 3));
      }
      children.push(createStyledTable(tableData.headers, tableData.rows));
      children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
    });
  }

  // Create the document (SKILL.md format - no header graphics)
  const doc = new Document({
    creator: options.creator || DEFAULT_METADATA.creator,
    title: documentData.title || DEFAULT_METADATA.title,
    description: options.description || DEFAULT_METADATA.description,
    numbering: BULLET_NUMBERING,
    styles: {
      default: {
        document: {
          run: {
            font: FONTS.body,
            size: STYLES.body.size
          }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: PAGE.width,     // A4: 11906
            height: PAGE.height    // A4: 16838
          },
          margin: {
            top: PAGE.margins.top,
            right: PAGE.margins.right,
            bottom: PAGE.margins.bottom,
            left: PAGE.margins.left,
            header: PAGE.headerDistance,
            footer: PAGE.footerDistance
          }
        }
      },
      children
    }]
  });

  // Generate and return buffer
  const buffer = await Packer.toBuffer(doc);
  console.log(`[DOCX Export] Generated document: ${documentData.title || 'Untitled'} (${buffer.length} bytes)`);

  return buffer;
}

/**
 * Generate a one-page intelligence brief DOCX
 * Optimized for meeting preparation with concise, actionable content
 * @param {Object} briefData - Intelligence brief data from generator
 * @param {Object} meetingContext - Meeting context (attendees, objective, keyConcerns)
 * @returns {Promise<Buffer>} - Document buffer
 */
export async function generateIntelligenceBriefDocx(briefData, meetingContext) {
  const children = [];

  // Title - centered, red
  children.push(new Paragraph({
    spacing: { before: 0, after: 100 },
    alignment: AlignmentType.CENTER,
    children: [styledText('Pre-Meeting Intelligence Brief', {
      font: FONTS.heading,
      size: 32,
      color: COLORS.red,
      bold: false  // NOT bold per SKILL.md
    })]
  }));

  // Company name - centered, navy
  children.push(new Paragraph({
    spacing: { after: 100 },
    alignment: AlignmentType.CENTER,
    children: [styledText(meetingContext.companyName, {
      font: FONTS.heading,
      size: 26,
      color: COLORS.navy,
      bold: true
    })]
  }));

  // Meeting Objective subtitle - gray italic
  children.push(new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [styledText(meetingContext.meetingObjective, {
      font: FONTS.body,
      size: 22,
      color: COLORS.gray,
      italics: true
    })]
  }));

  // Attendees line
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [
      styledText('Attendees: ', { ...STYLES.body, bold: true, size: 20 }),
      styledText(meetingContext.meetingAttendees, { ...STYLES.body, size: 20 })
    ]
  }));

  // Key Concerns if provided
  if (meetingContext.keyConcerns) {
    children.push(new Paragraph({
      spacing: { after: 250 },
      children: [
        styledText('Key Concerns: ', { ...STYLES.body, bold: true, size: 20 }),
        styledText(meetingContext.keyConcerns, { ...STYLES.body, size: 20, italics: true })
      ]
    }));
  }

  // Divider line
  children.push(new Paragraph({
    spacing: { after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: hexColor(COLORS.navy) }
    },
    children: []
  }));

  // Key Insights (most important - appears first)
  if (briefData.keyInsights?.length > 0) {
    children.push(createHeading('Key Insights', 2));
    briefData.keyInsights.forEach(insight => {
      children.push(createBullet(insight));
    });
  }

  // Talking Points (with supporting evidence)
  if (briefData.talkingPoints?.length > 0) {
    children.push(createHeading('Talking Points', 2));
    briefData.talkingPoints.forEach((tp, i) => {
      // Main point - numbered and bold
      children.push(new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [
          styledText(`${i + 1}. `, { ...STYLES.body, bold: true }),
          styledText(tp.point, { ...STYLES.body, bold: true })
        ]
      }));
      // Supporting evidence (if present) - indented, gray italic
      if (tp.supporting) {
        children.push(new Paragraph({
          spacing: { after: 100 },
          indent: { left: 300 },
          children: [styledText(`→ ${tp.supporting}`, {
            ...STYLES.body,
            size: 20,
            color: COLORS.gray,
            italics: true
          })]
        }));
      }
    });
  }

  // Anticipated Questions (Q&A format)
  if (briefData.anticipatedQuestions?.length > 0) {
    children.push(createHeading('Anticipated Questions', 2));
    briefData.anticipatedQuestions.forEach(qa => {
      // Question - red Q prefix
      children.push(new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [
          styledText('Q: ', { ...STYLES.body, bold: true, color: COLORS.red }),
          styledText(qa.question, { ...STYLES.body, italics: true })
        ]
      }));
      // Suggested response
      children.push(new Paragraph({
        spacing: { after: 100 },
        indent: { left: 200 },
        children: [
          styledText('A: ', { ...STYLES.body, bold: true }),
          styledText(qa.suggestedResponse, STYLES.body)
        ]
      }));
    });
  }

  // Roadmap Highlights (if present)
  if (briefData.roadmapHighlights?.length > 0) {
    children.push(createHeading('Roadmap Highlights', 2));
    briefData.roadmapHighlights.forEach(highlight => {
      children.push(createBullet(highlight));
    });
  }

  // Recommended Next Steps - numbered list
  if (briefData.recommendedNextSteps?.length > 0) {
    children.push(createHeading('Recommended Next Steps', 2));
    briefData.recommendedNextSteps.forEach((step, i) => {
      children.push(new Paragraph({
        spacing: { after: 80 },
        children: [
          styledText(`${i + 1}. `, { ...STYLES.body, bold: true }),
          styledText(step, STYLES.body)
        ]
      }));
    });
  }

  // Caution Areas (if present - smaller section at end)
  if (briefData.cautionAreas?.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 200, after: 100 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: hexColor(COLORS.gray) }
      },
      children: [styledText('Caution Areas', {
        ...STYLES.body,
        bold: true,
        size: 20,
        color: COLORS.red
      })]
    }));
    briefData.cautionAreas.forEach(caution => {
      children.push(new Paragraph({
        spacing: { after: 50 },
        children: [styledText(`⚠ ${caution}`, {
          ...STYLES.body,
          size: 18,
          color: COLORS.gray
        })]
      }));
    });
  }

  // Create the document (SKILL.md format - tighter margins for one-page fit, no header graphics)
  const doc = new Document({
    creator: DEFAULT_METADATA.creator,
    title: 'Pre-Meeting Intelligence Brief',
    description: 'Meeting preparation brief',
    numbering: BULLET_NUMBERING,
    styles: {
      default: {
        document: {
          run: {
            font: FONTS.body,
            size: STYLES.body.size
          }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: PAGE.width,     // A4: 11906
            height: PAGE.height    // A4: 16838
          },
          margin: {
            top: 720,    // 0.5 inch (tighter margins for one-page fit)
            right: 720,
            bottom: 720,
            left: 720
          }
        }
      },
      children
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  console.log(`[DOCX Export] Generated intelligence brief (${buffer.length} bytes)`);

  return buffer;
}

export default { generateDocx, generateIntelligenceBriefDocx, createStyledTable };
