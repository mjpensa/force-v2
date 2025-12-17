/**
 * DOCX Export Service
 * Generates Word documents from document data
 * BIP format (Arial, coral red headings, black body text)
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
  Header,
  VerticalAlign,
  TableLayoutType
} from 'docx';
import { COLORS, FONTS, STYLES, PAGE, SPACING, DEFAULT_METADATA } from './docx-template-config.js';

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
 * Create a heading paragraph (BIP format - coral red)
 */
function createHeading(text, level = 1) {
  const headingStyles = {
    1: { level: HeadingLevel.HEADING_1, ...STYLES.heading1 },
    2: { level: HeadingLevel.HEADING_2, ...STYLES.heading2 },
    3: { level: HeadingLevel.HEADING_3, ...STYLES.heading3 }
  };

  const style = headingStyles[level] || headingStyles[2];

  // Larger spacing before major sections
  const spaceBefore = level === 1 ? SPACING.sectionGap * 1.5 : SPACING.sectionGap;

  return new Paragraph({
    heading: style.level,
    spacing: { before: spaceBefore, after: SPACING.paragraphAfter },
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
 * Create a key insight callout (BIP format)
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
 * Create a bullet point
 */
function createBullet(text) {
  return new Paragraph({
    spacing: { after: 100, line: SPACING.lineSpacing },
    bullet: { level: 0 },
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
// SECTION BUILDERS
// ============================================================================

/**
 * Build the title section (BIP format - centered, coral red)
 */
function buildTitleSection(title, subtitle) {
  const elements = [];

  // Main title - coral red, centered (BIP format)
  elements.push(new Paragraph({
    spacing: { before: 400, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [styledText(title, STYLES.title)]
  }));

  // Subtitle if provided - gray italic
  if (subtitle) {
    elements.push(new Paragraph({
      spacing: { after: 600 },
      alignment: AlignmentType.CENTER,
      children: [styledText(subtitle, STYLES.subtitle)]
    }));
  } else {
    elements.push(new Paragraph({
      spacing: { after: 400 },
      children: []
    }));
  }

  return elements;
}

/**
 * Create header with bip. logo (v19 format - right aligned)
 * Note: v19 uses an actual image, this is a text fallback
 */
function createBipHeader() {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          styledText('bip', {
            font: FONTS.heading,
            size: 28,
            color: 'C54B4B',  // BIP coral red for logo
            bold: true
          }),
          styledText('.', {
            font: FONTS.heading,
            size: 28,
            color: 'C54B4B',
            bold: true
          })
        ]
      })
    ]
  });
}

/**
 * Create a styled table with navy headers (BIP format)
 */
function createStyledTable(headers, rows) {
  const tableRows = [];

  // Header row with navy background
  tableRows.push(new TableRow({
    tableHeader: true,
    children: headers.map(header => new TableCell({
      shading: { fill: hexColor(COLORS.navy), type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [styledText(header, STYLES.tableHeader)]
      })]
    }))
  }));

  // Data rows
  rows.forEach(row => {
    tableRows.push(new TableRow({
      children: row.map(cell => new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [styledText(cell, STYLES.tableCell)]
        })]
      }))
    }));
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: tableRows
  });
}

/**
 * Build the executive summary section (BIP format)
 */
function buildExecutiveSummary(execSummary) {
  if (!execSummary) return [];

  const elements = [];

  // Section heading - coral red (BIP format)
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

  // Main narrative paragraphs (clean BIP format)
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
 * Build the analysis overview section (BIP format)
 */
function buildAnalysisOverview(overview) {
  if (!overview) return [];

  const elements = [];

  // Section heading - coral red (BIP format)
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
 * Build a content section (BIP format)
 */
function buildContentSection(section, index) {
  const elements = [];

  // Section heading with number prefix (BIP format: "Section 1: Title")
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

  // Subsection/spotlight if present (BIP format: "Implementation Spotlight: ...")
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
 * Generate a Word document from document data (BIP format)
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

  // Create the document with BIP header
  const doc = new Document({
    creator: options.creator || DEFAULT_METADATA.creator,
    title: documentData.title || DEFAULT_METADATA.title,
    description: options.description || DEFAULT_METADATA.description,
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
          margin: {
            top: PAGE.margins.top,
            right: PAGE.margins.right,
            bottom: PAGE.margins.bottom,
            left: PAGE.margins.left
          }
        }
      },
      headers: {
        default: createBipHeader()
      },
      children
    }]
  });

  // Generate and return buffer
  const buffer = await Packer.toBuffer(doc);
  console.log(`[DOCX Export] Generated document: ${documentData.title || 'Untitled'} (${buffer.length} bytes)`);

  return buffer;
}

export default { generateDocx, createStyledTable };
