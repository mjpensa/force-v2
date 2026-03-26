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

// Shared table cell margins (precomputed twips)
const CELL_MARGINS = {
  header: {
    top: convertInchesToTwip(0.03),
    bottom: convertInchesToTwip(0.03),
    left: convertInchesToTwip(0.06),
    right: convertInchesToTwip(0.06)
  },
  data: {
    top: convertInchesToTwip(0.04),
    bottom: convertInchesToTwip(0.04),
    left: convertInchesToTwip(0.06),
    right: convertInchesToTwip(0.06)
  },
  highlight: {
    top: convertInchesToTwip(0.03),
    bottom: convertInchesToTwip(0.03),
    left: convertInchesToTwip(0.02),
    right: convertInchesToTwip(0.02)
  }
};

// Shared table border definition (all 6 borders identical)
const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const TABLE_BORDERS = {
  top: TABLE_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
  insideHorizontal: TABLE_BORDER,
  insideVertical: TABLE_BORDER
};

function hexColor(color) {
  return color.replace('#', '');
}

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

function createHeading(text, level = 1) {
  const headingStyles = {
    1: { level: HeadingLevel.HEADING_1, ...STYLES.heading1 },
    2: { level: HeadingLevel.HEADING_2, ...STYLES.heading2 },
    3: { level: HeadingLevel.HEADING_3, ...STYLES.heading3 }
  };

  const style = headingStyles[level] || headingStyles[2];
  const spaceBefore = SPACING.sectionBefore;
  const spaceAfter = SPACING.sectionAfter;

  return new Paragraph({
    heading: style.level,
    spacing: { before: spaceBefore, after: spaceAfter },
    children: [styledText(text, style)]
  });
}

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

function createLabeledParagraph(label, text, options = {}) {
  const {
    labelStyle = STYLES.bodyBold,
    textStyle = STYLES.body,
    spaceBefore = 150,
    spaceAfter = 200,
    indent
  } = options;
  return new Paragraph({
    spacing: { before: spaceBefore, after: spaceAfter },
    ...(indent ? { indent } : {}),
    children: [
      styledText(label, labelStyle),
      styledText(text, textStyle)
    ]
  });
}

function createQuoteBlock(quote, source) {
  const children = [];
  children.push(new Paragraph({
    spacing: { before: 150, after: 100 },
    indent: { left: 400 },
    children: [
      styledText('"', { ...STYLES.quote, size: 28 }),
      styledText(quote, STYLES.quote),
      styledText('"', { ...STYLES.quote, size: 28 })
    ]
  }));
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

function splitIntoParagraphs(text) {
  if (!text) return [];
  return text.split(/\n\n+/).filter(p => p.trim());
}

function buildDocument({ creator, title, description, margins, children }) {
  return new Document({
    creator: creator || DEFAULT_METADATA.creator,
    title: title || DEFAULT_METADATA.title,
    description: description || DEFAULT_METADATA.description,
    numbering: BULLET_NUMBERING,
    styles: {
      default: {
        document: {
          run: { font: FONTS.body, size: STYLES.body.size }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE.width, height: PAGE.height },
          margin: margins || {
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
}

function createHeaderCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: {
      fill: hexColor(COLORS.navy),
      type: ShadingType.CLEAR,
      color: 'auto'
    },
    verticalAlign: VerticalAlign.CENTER,
    margins: CELL_MARGINS.header,
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
    margins: CELL_MARGINS.data,
    shading: isAlternateRow
      ? { fill: hexColor(COLORS.altRowGray), type: ShadingType.CLEAR, color: 'auto' }
      : undefined,
    children: children
  });
}

function createHighlightCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: {
      fill: hexColor(COLORS.highlightPink),
      type: ShadingType.CLEAR,
      color: 'auto'
    },
    verticalAlign: VerticalAlign.CENTER,
    margins: CELL_MARGINS.highlight,
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

function calculateColumnWidths(headers, rows, options = {}) {
  const numCols = headers.length;
  const { hasHighlightColumn = false } = options;
  const contentLengths = headers.map((_, colIdx) => {
    const allContent = [headers[colIdx], ...rows.map(r => r[colIdx] || '')];
    const avgLength = allContent.reduce((sum, c) => sum + (c?.length || 0), 0) / allContent.length;
    return avgLength;
  });
  const widths = contentLengths.map((len, idx) => {
    if (idx === 0) return COLUMN_WIDTHS.rowLabel; // First column gets more space
    if (hasHighlightColumn && idx === numCols - 1) return COLUMN_WIDTHS.highlight;
    if (len < 5) return COLUMN_WIDTHS.singleChar;
    if (len < 10) return COLUMN_WIDTHS.percentage;
    if (len < 25) return COLUMN_WIDTHS.shortText;
    if (len < 50) return COLUMN_WIDTHS.mediumText;
    return COLUMN_WIDTHS.longText;
  });
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = COLUMN_WIDTHS.TOTAL_A4 / total;

  return widths.map(w => Math.round(w * scale));
}

function buildTitleSection(title, subtitle) {
  const elements = [];
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

function createStyledTable(headers, rows, options = {}) {
  const {
    columnWidths = null,
    hasHighlightColumn = false
  } = options;

  // Calculate column widths if not provided
  const widths = columnWidths || calculateColumnWidths(headers, rows, { hasHighlightColumn });

  const tableRows = [];
  tableRows.push(new TableRow({
    tableHeader: true,
    children: headers.map((header, idx) => createHeaderCell(header, widths[idx]))
  }));
  rows.forEach((row, rowIdx) => {
    const isAlternateRow = rowIdx % 2 === 1; // Even index = white, odd = gray

    tableRows.push(new TableRow({
      children: row.map((cell, colIdx) => {
        if (hasHighlightColumn && colIdx === row.length - 1) {
          return createHighlightCell(cell, widths[colIdx]);
        }
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
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    columnWidths: widths,  // CRITICAL: Explicit columnWidths array
    rows: tableRows
  });
}

function buildExecutiveSummary(execSummary) {
  if (!execSummary) return [];

  const elements = [];
  elements.push(createHeading('Executive Summary', 1));
  if (execSummary.source) {
    elements.push(createLabeledParagraph('Source: ', execSummary.source, {
      labelStyle: { ...STYLES.source, bold: true },
      textStyle: STYLES.source,
      spaceBefore: 0, spaceAfter: 200
    }));
  }
  if (execSummary.narrative) {
    const paragraphs = splitIntoParagraphs(execSummary.narrative);
    paragraphs.forEach(p => {
      elements.push(createParagraph(p));
    });
  }
  if (execSummary.situation) {
    elements.push(createParagraph(execSummary.situation));
  }
  if (execSummary.insight) {
    elements.push(createParagraph(execSummary.insight));
  }
  if (execSummary.action) {
    elements.push(createParagraph(execSummary.action));
  }
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

function buildAnalysisOverview(overview) {
  if (!overview) return [];

  const elements = [];
  elements.push(createHeading('Analysis Overview', 1));
  if (overview.narrative) {
    const paragraphs = splitIntoParagraphs(overview.narrative);
    paragraphs.forEach(p => {
      elements.push(createParagraph(p));
    });
  }
  if (overview.keyThemes && overview.keyThemes.length > 0) {
    elements.push(createHeading('Key Themes', 2));

    overview.keyThemes.forEach(theme => {
      elements.push(new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [styledText(theme.theme, STYLES.bodyBold)]
      }));
      if (theme.description) {
        elements.push(createParagraph(theme.description, {
          style: STYLES.body,
          spaceBefore: 0
        }));
      }
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
  if (overview.criticalFindings && overview.criticalFindings.length > 0) {
    elements.push(createHeading('Critical Findings', 3));
    overview.criticalFindings.forEach(finding => {
      elements.push(createBullet(finding));
    });
  }
  if (overview.strategicContext) {
    elements.push(createHeading('Strategic Context', 3));
    const paragraphs = splitIntoParagraphs(overview.strategicContext);
    paragraphs.forEach(p => {
      elements.push(createParagraph(p));
    });
  }

  return elements;
}

function buildContentSection(section, index) {
  const elements = [];
  const sectionNumber = index + 1;
  const sectionTitle = section.heading || `Section ${sectionNumber}`;
  const formattedTitle = section.swimlaneTopic
    ? `Section ${sectionNumber}: ${sectionTitle}`
    : sectionTitle;

  elements.push(createHeading(formattedTitle, 1));
  if (section.keyInsight) {
    elements.push(new Paragraph({
      spacing: { before: 200, after: 200 },
      children: [styledText(section.keyInsight, STYLES.bodyBold)]
    }));
  }
  if (section.researchSummary) {
    elements.push(createLabeledParagraph('Research Summary: ', section.researchSummary, {
      spaceBefore: 200, spaceAfter: 150
    }));
  }
  if (section.implications) {
    elements.push(createLabeledParagraph('Implications: ', section.implications));
  }
  if (section.paragraphs && section.paragraphs.length > 0) {
    section.paragraphs.forEach(para => {
      if (typeof para === 'string') {
        elements.push(createParagraph(para));
      }
    });
  }
  if (section.supportingEvidence && section.supportingEvidence.length > 0) {
    elements.push(createHeading('Supporting Evidence', 2));

    section.supportingEvidence.forEach(evidence => {
      if (evidence.claim) {
        elements.push(new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [styledText(evidence.claim, STYLES.bodyBold)]
        }));
      }
      if (evidence.quote) {
        elements.push(...createQuoteBlock(evidence.quote, evidence.source));
      }
    });
  }
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

export async function generateDocx(documentData, options = {}) {
  const children = [];
  if (documentData.title) {
    children.push(...buildTitleSection(documentData.title, documentData.subtitle));
  }
  if (documentData.executiveSummary) {
    children.push(...buildExecutiveSummary(documentData.executiveSummary));
  }
  if (documentData.analysisOverview) {
    children.push(...buildAnalysisOverview(documentData.analysisOverview));
  }
  if (documentData.sections && documentData.sections.length > 0) {
    documentData.sections.forEach((section, index) => {
      children.push(...buildContentSection(section, index));
    });
  }
  if (documentData.tables && documentData.tables.length > 0) {
    documentData.tables.forEach(tableData => {
      if (tableData.title) {
        children.push(createHeading(tableData.title, 3));
      }
      children.push(createStyledTable(tableData.headers, tableData.rows));
      children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
    });
  }
  const doc = buildDocument({
    creator: options.creator,
    title: documentData.title,
    description: options.description,
    children
  });
  return Packer.toBuffer(doc);
}

export async function generateIntelligenceBriefDocx(briefData, meetingContext) {
  const children = [];
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
  children.push(createLabeledParagraph('Attendees: ', meetingContext.meetingAttendees, {
    labelStyle: { ...STYLES.bodyBold, size: 20 },
    textStyle: { ...STYLES.body, size: 20 },
    spaceBefore: 0, spaceAfter: 200
  }));
  if (meetingContext.keyConcerns) {
    children.push(createLabeledParagraph('Key Concerns: ', meetingContext.keyConcerns, {
      labelStyle: { ...STYLES.bodyBold, size: 20 },
      textStyle: { ...STYLES.body, size: 20, italics: true },
      spaceBefore: 0, spaceAfter: 250
    }));
  }
  children.push(new Paragraph({
    spacing: { after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: hexColor(COLORS.navy) }
    },
    children: []
  }));
  if (briefData.keyInsights?.length > 0) {
    children.push(createHeading('Key Insights', 2));
    briefData.keyInsights.forEach(insight => {
      children.push(createBullet(insight));
    });
  }
  if (briefData.talkingPoints?.length > 0) {
    children.push(createHeading('Talking Points', 2));
    briefData.talkingPoints.forEach((tp, i) => {
      children.push(new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [
          styledText(`${i + 1}. `, STYLES.bodyBold),
          styledText(tp.point, STYLES.bodyBold)
        ]
      }));
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
  if (briefData.anticipatedQuestions?.length > 0) {
    children.push(createHeading('Anticipated Questions', 2));
    briefData.anticipatedQuestions.forEach(qa => {
      children.push(new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [
          styledText('Q: ', { ...STYLES.bodyBold, color: COLORS.red }),
          styledText(qa.question, { ...STYLES.body, italics: true })
        ]
      }));
      children.push(createLabeledParagraph('A: ', qa.suggestedResponse, {
        spaceBefore: 0, spaceAfter: 100, indent: { left: 200 }
      }));
    });
  }
  if (briefData.roadmapHighlights?.length > 0) {
    children.push(createHeading('Roadmap Highlights', 2));
    briefData.roadmapHighlights.forEach(highlight => {
      children.push(createBullet(highlight));
    });
  }
  if (briefData.recommendedNextSteps?.length > 0) {
    children.push(createHeading('Recommended Next Steps', 2));
    briefData.recommendedNextSteps.forEach((step, i) => {
      children.push(createLabeledParagraph(`${i + 1}. `, step, {
        spaceBefore: 0, spaceAfter: 80
      }));
    });
  }
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
  const doc = buildDocument({
    title: 'Pre-Meeting Intelligence Brief',
    description: 'Meeting preparation brief',
    margins: { top: 720, right: 720, bottom: 720, left: 720 },
    children
  });
  return Packer.toBuffer(doc);
}

export default { generateDocx, generateIntelligenceBriefDocx, createStyledTable };
