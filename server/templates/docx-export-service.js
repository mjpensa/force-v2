/**
 * DOCX Export Service
 * Generates Word documents from document data
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
  ShadingType
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
    color: hexColor(style.color || COLORS.navy),
    bold: style.bold || false,
    italics: style.italics || false,
    allCaps: style.allCaps || false
  });
}

/**
 * Create a heading paragraph
 */
function createHeading(text, level = 1) {
  const headingStyles = {
    1: { level: HeadingLevel.HEADING_1, ...STYLES.heading1 },
    2: { level: HeadingLevel.HEADING_2, ...STYLES.heading2 },
    3: { level: HeadingLevel.HEADING_3, ...STYLES.heading3 }
  };

  const style = headingStyles[level] || headingStyles[2];

  return new Paragraph({
    heading: style.level,
    spacing: { before: SPACING.sectionGap, after: SPACING.paragraphAfter },
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
 * Create a label paragraph (red, uppercase)
 */
function createLabel(text) {
  return new Paragraph({
    spacing: { before: SPACING.sectionGap, after: 100 },
    children: [styledText(text.toUpperCase(), STYLES.label)]
  });
}

/**
 * Create a key insight callout
 */
function createKeyInsight(text) {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 24, color: hexColor(COLORS.red) }
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
 * Build the title section
 */
function buildTitleSection(title) {
  return [
    new Paragraph({
      spacing: { after: 400 },
      alignment: AlignmentType.CENTER,
      children: [styledText(title, STYLES.title)]
    }),
    new Paragraph({
      spacing: { after: 600 },
      alignment: AlignmentType.CENTER,
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: hexColor(COLORS.red) }
      },
      children: []
    })
  ];
}

/**
 * Build the executive summary section
 */
function buildExecutiveSummary(execSummary) {
  if (!execSummary) return [];

  const elements = [];

  // Section label
  elements.push(createLabel('Executive Summary'));

  // At a Glance heading
  elements.push(createHeading('At a Glance', 2));

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

  // Context (formerly Situation)
  if (execSummary.situation) {
    elements.push(new Paragraph({
      spacing: { before: 200, after: 150 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: '4A9EFF' } },
      indent: { left: 200 },
      children: [
        styledText('CONTEXT: ', { ...STYLES.body, bold: true, color: '4A9EFF' }),
        styledText(execSummary.situation, STYLES.body)
      ]
    }));
  }

  // Key Insight (formerly Insight)
  if (execSummary.insight) {
    elements.push(new Paragraph({
      spacing: { before: 150, after: 150 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'FFBB33' } },
      indent: { left: 200 },
      children: [
        styledText('KEY INSIGHT: ', { ...STYLES.body, bold: true, color: 'D97706' }),
        styledText(execSummary.insight, STYLES.body)
      ]
    }));
  }

  // Recommended Action (formerly Action)
  if (execSummary.action) {
    elements.push(new Paragraph({
      spacing: { before: 150, after: 300 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: '4CAF50' } },
      indent: { left: 200 },
      children: [
        styledText('RECOMMENDED ACTION: ', { ...STYLES.body, bold: true, color: '16A34A' }),
        styledText(execSummary.action, { ...STYLES.body, italics: true })
      ]
    }));
  }

  // Legacy format support (stakes, keyFinding, recommendation)
  if (!execSummary.situation && execSummary.stakes) {
    elements.push(new Paragraph({
      spacing: { before: 200, after: 150 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: '4A9EFF' } },
      indent: { left: 200 },
      children: [
        styledText('CONTEXT: ', { ...STYLES.body, bold: true, color: '4A9EFF' }),
        styledText(execSummary.stakes, STYLES.body)
      ]
    }));
  }
  if (!execSummary.insight && execSummary.keyFinding) {
    elements.push(new Paragraph({
      spacing: { before: 150, after: 150 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'FFBB33' } },
      indent: { left: 200 },
      children: [
        styledText('KEY INSIGHT: ', { ...STYLES.body, bold: true, color: 'D97706' }),
        styledText(execSummary.keyFinding, STYLES.body)
      ]
    }));
  }
  if (!execSummary.action && execSummary.recommendation) {
    elements.push(new Paragraph({
      spacing: { before: 150, after: 300 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: '4CAF50' } },
      indent: { left: 200 },
      children: [
        styledText('RECOMMENDED ACTION: ', { ...STYLES.body, bold: true, color: '16A34A' }),
        styledText(execSummary.recommendation, { ...STYLES.body, italics: true })
      ]
    }));
  }

  return elements;
}

/**
 * Build the analysis overview section
 */
function buildAnalysisOverview(overview) {
  if (!overview) return [];

  const elements = [];

  // Section label and heading
  elements.push(createLabel('Strategic Analysis'));
  elements.push(createHeading('Analysis Overview', 2));

  // Narrative paragraphs
  if (overview.narrative) {
    const paragraphs = splitIntoParagraphs(overview.narrative);
    paragraphs.forEach(p => {
      elements.push(createParagraph(p));
    });
  }

  // Key Themes
  if (overview.keyThemes && overview.keyThemes.length > 0) {
    elements.push(createHeading('Key Themes', 3));

    overview.keyThemes.forEach(theme => {
      // Theme name
      elements.push(new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [styledText(theme.theme, { ...STYLES.body, bold: true, color: COLORS.navy })]
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
 * Build a content section
 */
function buildContentSection(section, index) {
  const elements = [];

  // Swimlane topic label
  if (section.swimlaneTopic) {
    elements.push(new Paragraph({
      spacing: { before: SPACING.sectionGap, after: 100 },
      children: [styledText(section.swimlaneTopic.toUpperCase(), STYLES.label)]
    }));
  }

  // Section heading
  elements.push(createHeading(section.heading || `Section ${index + 1}`, 2));

  // Key insight callout
  if (section.keyInsight) {
    elements.push(createKeyInsight(section.keyInsight));
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
    elements.push(createHeading('Supporting Evidence', 3));

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

  return elements;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Generate a Word document from document data
 * @param {Object} documentData - Document content object
 * @param {Object} options - Export options
 * @returns {Promise<Buffer>} - Document buffer
 */
export async function generateDocx(documentData, options = {}) {
  const children = [];

  // Title
  if (documentData.title) {
    children.push(...buildTitleSection(documentData.title));
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

  // Create the document
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
      children
    }]
  });

  // Generate and return buffer
  const buffer = await Packer.toBuffer(doc);
  console.log(`[DOCX Export] Generated document: ${documentData.title || 'Untitled'} (${buffer.length} bytes)`);

  return buffer;
}

export default { generateDocx };
