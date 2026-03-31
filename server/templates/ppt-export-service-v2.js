import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeBodyText, truncateToSentence, formatTitle, formatSectionTitle, formatBody } from '../../Public/shared/text-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SLIDE = {
  WIDTH: 13.33,   // inches
  HEIGHT: 7.5     // inches (16:9 aspect ratio)
};
const pctX = (p) => (p / 100) * SLIDE.WIDTH;
const pctY = (p) => (p / 100) * SLIDE.HEIGHT;

const COLORS = {
  navy: '0C2340',       // Primary brand - titles, body text
  red: 'DA291C',        // Accent - taglines, decorative elements
  white: 'FFFFFF',      // Backgrounds, section title text
  darkGray: '6B7280',   // Page numbers on white backgrounds
  mutedWhite: '999999'  // Page numbers on dark backgrounds (~60% white)
};

const SHARED_LOGO = { x: SLIDE.WIDTH - 0.75, y: SLIDE.HEIGHT - 0.50, w: 0.30 * (816/569), h: 0.30 };
const SHARED_PAGE_NUMBER = { w: 0.5, h: 0.2 };
const SHARED_PAGE_NUMBER_POS = {
  x: pctX(2.11),
  y: SLIDE.HEIGHT - pctY(3.43) - 0.3,
  ...SHARED_PAGE_NUMBER
};

// Shared text style objects for content slides
const TAGLINE_STYLE = {
  fontSize: 12,
  fontFace: 'Work Sans SemiBold',
  color: COLORS.red,
  align: 'left',
  charSpacing: 0.5
};

const BODY_TEXT_BASE = {
  fontSize: 10.5,
  fontFace: 'Work Sans',
  color: COLORS.navy,
  align: 'left',
  valign: 'top'
};

const LAYOUTS = {
  sectionTitle: {
    swimlaneLabel: {
      x: pctX(4),
      y: pctY(5),
      w: 5,
      h: 0.4
    },
    title: {
      x: 0.5,
      y: 2.5,
      w: SLIDE.WIDTH - 1,
      h: 2.5
    },
    // Red decorative line (15% width, centered)
    redLine: {
      x: (SLIDE.WIDTH - 2) / 2,
      y: 5.0,
      w: 2,
      h: 0.04
    },
    logo: SHARED_LOGO,
    pageNumber: SHARED_PAGE_NUMBER_POS
  },
  twoColumn: {
    tagline: {
      x: pctX(2.11),
      y: pctY(3.43),
      w: 3,
      h: 0.35
    },
    title: {
      x: pctX(1.87),
      y: pctY(7),
      w: pctX(44.59),
      h: pctY(40)
    },
    body: {
      x: pctX(50.59),
      y: pctY(57),
      w: pctX(44.30),
      h: pctY(37)  // 100% - 57% - 6%
    },
    // SVG actual dimensions: 312x313 (essentially square, ~1:1 ratio)
    cornerGraphic: {
      x: SLIDE.WIDTH - pctX(10),
      y: 0,
      w: pctX(10),
      h: pctX(10)  // Square aspect ratio
    },
    logo: SHARED_LOGO,
    pageNumber: SHARED_PAGE_NUMBER_POS
  },
  threeColumn: {
    tagline: {
      x: pctX(2.10),
      y: pctY(3.47),
      w: 3,
      h: 0.35
    },
    // Width increased from 20.70% to 24% to accommodate 44pt font
    title: {
      x: pctX(1.87),
      y: pctY(7),
      w: pctX(24),
      h: pctY(40)
    },
    columns: {
      x: pctX(26.71),
      y: pctY(46.13),
      w: pctX(68.27),
      h: pctY(46.93)
    },
    columnGap: pctX(4.43),
    // Slightly reduced from 10.9% to 10% for better web rendering
    cornerGraphic: {
      x: SLIDE.WIDTH - pctX(10),
      y: 0,
      w: pctX(10),
      h: pctX(10)  // Square aspect ratio
    },
    logo: SHARED_LOGO,
    pageNumber: SHARED_PAGE_NUMBER_POS  // Was pctX(2.10), merged with pctX(2.11) — diff < 0.002"
  }
};

let ASSETS = {
  logo: null,
  cornerGraphic: null
};

let assetsLoaded = false;

function loadAssets() {
  if (assetsLoaded) return;
  const projectRoot = path.resolve(__dirname, '..', '..');
  const publicDir = path.join(projectRoot, 'Public');
  const logoPath = path.join(publicDir, 'Red BIP Logo.png');
  if (fs.existsSync(logoPath)) {
    const logoData = fs.readFileSync(logoPath);
    ASSETS.logo = `image/png;base64,${logoData.toString('base64')}`;
  }
  const cornerPath = path.join(publicDir, 'bip corner graphic.svg');
  if (fs.existsSync(cornerPath)) {
    const svgData = fs.readFileSync(cornerPath);
    ASSETS.cornerGraphic = `image/svg+xml;base64,${svgData.toString('base64')}`;
  }

  assetsLoaded = true;
}
function getSectionLabel(slideData) {
  const label = slideData.tagline || slideData.section || slideData.sectionLabel;
  return label ? String(label).toUpperCase() : '';
}

function addCornerGraphic(slide, layout) {
  const pos = layout.cornerGraphic;

  if (ASSETS.cornerGraphic) {
    slide.addImage({
      data: ASSETS.cornerGraphic,
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h
    });
  }
}

// Format speaker notes for PPTX (priority: Quick Ref > Talking Points > Q&A > CTA > Sources)
function formatSpeakerNotesForPptx(notes, maxLength = 3000) {
  if (!notes) return '';

  const sections = [];
  let currentLength = 0;

  // Helper to add section if within limit, with graceful truncation for high-priority content
  const addSection = (title, content, priority = 'normal') => {
    if (!content || !content.trim()) return true; // Skip empty content

    const fullSection = `${title}\n${content}\n\n`;

    // If it fits completely, add it
    if (currentLength + fullSection.length <= maxLength) {
      sections.push(fullSection);
      currentLength += fullSection.length;
      return true;
    }

    // For high-priority sections, try to fit partial content at sentence boundary
    if (priority === 'high') {
      const remaining = maxLength - currentLength - title.length - 4; // 4 for \n and spacing
      if (remaining > 100) {
        // Truncate at sentence boundary
        const sentences = content.split(/(?<=[.!?])\s+/);
        let partial = '';
        for (const sentence of sentences) {
          if ((partial + sentence).length < remaining - 20) { // Leave buffer
            partial += (partial ? ' ' : '') + sentence;
          } else {
            break;
          }
        }
        if (partial.trim()) {
          sections.push(`${title}\n${partial.trim()}...\n\n`);
          currentLength = maxLength; // Mark as full
          return true;
        }
      }
    }

    return false;
  };

  // Helper: format key-value pairs from an object, skipping missing fields
  const formatFields = (obj, fields) => {
    if (!obj) return '';
    return fields
      .filter(([key]) => obj[key])
      .map(([key, label, fmt]) => `${label}: ${fmt ? fmt(obj[key]) : obj[key]}`)
      .join('\n');
  };

  // Table-driven speaker notes sections (ordered by priority)
  const NOTES_SECTIONS = [
    // 0. QUICK REFERENCE (cheat sheet for presenter)
    {
      label: 'QUICK REFERENCE:',
      priority: 'high',
      maxPosition: 200,  // Only if near start (currentLength < 200)
      extract: () => {
        if (!notes.quickReference) return null;
        return formatFields(notes.quickReference, [
          ['keyNumber', 'KEY NUMBER'],
          ['keyPhrase', 'KEY PHRASE', v => `"${v}"`],
          ['keyProof', 'PROOF'],
          ['keyAsk', 'ASK']
        ]);
      }
    },
    // 1. TALKING POINTS (highest priority)
    {
      label: 'TALKING POINTS:',
      priority: 'high',
      extract: () => {
        if (!notes.narrative?.talkingPoints?.length) return null;
        return notes.narrative.talkingPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');
      }
    },
    // 1b. KEY PHRASE (sub-item of talking points)
    {
      label: 'KEY PHRASE:',
      priority: 'high',
      headroom: 100,
      extract: () => notes.narrative?.keyPhrase ? `"${notes.narrative.keyPhrase}"` : null
    },
    // 2. STAKEHOLDER ANGLES
    {
      label: 'STAKEHOLDER ANGLES:',
      headroom: 250,
      extract: () => {
        if (!notes.stakeholderAngles) return null;
        return formatFields(notes.stakeholderAngles, [
          ['cfo', 'CFO'], ['cto', 'CTO'], ['ceo', 'CEO'], ['operations', 'OPS']
        ]);
      }
    },
    // 3. TRANSITIONS
    {
      label: 'TRANSITIONS:',
      extract: () => {
        if (!notes.narrative?.transitionIn && !notes.narrative?.transitionOut) return null;
        return formatFields(notes.narrative, [
          ['transitionIn', 'From previous'], ['transitionOut', 'To next']
        ]);
      }
    },
    // 4. ANTICIPATED QUESTIONS (complex formatting)
    {
      label: 'Q&A PREP:',
      headroom: 400,
      extract: () => {
        if (!notes.anticipatedQuestions?.length) return null;
        const severityOrder = { deal_breaker: 0, hostile: 1, skeptical: 2, probing: 3 };
        const prioritized = [...notes.anticipatedQuestions].sort(
          (a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3)
        );
        return prioritized.slice(0, 2).map(qa => {
          let text = `[${(qa.severity || 'probing').toUpperCase()}] Q: ${qa.question}\nA: ${qa.response}`;
          if (qa.escalationResponse && qa.severity === 'deal_breaker') {
            text += `\nIF THEY PUSH BACK: ${qa.escalationResponse}`;
          }
          return text;
        }).join('\n\n');
      }
    },
    // 5. CALL-TO-ACTION VARIANTS
    {
      label: 'CALL-TO-ACTION:',
      headroom: 200,
      extract: () => {
        if (!notes.storyContext?.callToAction) return null;
        const cta = notes.storyContext.callToAction;
        return formatFields(cta, [
          ['warmAudience', 'WARM', v => v.ask],
          ['neutralAudience', 'NEUTRAL', v => v.ask],
          ['hostileAudience', 'HOSTILE', v => v.ask]
        ]);
      }
    },
    // 6. WHY THIS MATTERS
    {
      label: 'WHY THIS MATTERS:',
      priority: 'high',
      headroom: 150,
      extract: () => notes.storyContext?.soWhat || null
    },
    // 7. TIME GUIDANCE
    {
      label: 'TIME:',
      headroom: 100,
      extract: () => {
        if (!notes.storyContext?.timeGuidance) return null;
        return formatFields(notes.storyContext.timeGuidance, [
          ['suggestedDuration', 'Duration'],
          ['condensedVersion', 'Short version', v => `"${v}"`]
        ]);
      }
    },
    // 8. SOURCES
    {
      label: 'SOURCES:',
      headroom: 200,
      extract: () => {
        if (!notes.sourceAttribution?.length) return null;
        return notes.sourceAttribution.slice(0, 2).map(src => {
          const claim = src.claim?.length > 80 ? src.claim.substring(0, 80) + '...' : src.claim;
          return `\u2022 ${src.source}: "${claim}"`;
        }).join('\n');
      }
    },
    // 9. CREDIBILITY ANCHORS
    {
      label: 'CREDIBILITY ANCHORS:',
      headroom: 150,
      extract: () => {
        if (!notes.credibilityAnchors?.length) return null;
        return notes.credibilityAnchors.slice(0, 2).map(anchor => {
          const typeLabel = (anchor.type || 'research').toUpperCase().replace(/_/g, ' ');
          return `[${typeLabel}] ${anchor.dropPhrase}\n  \u2192 ${anchor.statement}`;
        }).join('\n\n');
      }
    }
  ];

  for (const sec of NOTES_SECTIONS) {
    if (sec.maxPosition && currentLength > sec.maxPosition) continue;
    if (sec.headroom && currentLength > maxLength - sec.headroom) continue;
    const content = sec.extract();
    if (!content) continue;
    addSection(sec.label, content, sec.priority || 'normal');
  }

  return sections.join('').trim();
}

// --- Shared slide element helpers ---

function _addLogo(slide, layout) {
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: layout.logo.x,
      y: layout.logo.y,
      w: layout.logo.w,
      h: layout.logo.h
    });
  }
}

function _addPageNumber(slide, layout, slideNumber, color = COLORS.darkGray) {
  slide.addText(String(slideNumber), {
    x: layout.pageNumber.x,
    y: layout.pageNumber.y,
    w: layout.pageNumber.w,
    h: layout.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color,
    align: 'left'
  });
}

function _addSpeakerNotes(slide, speakerNotes) {
  if (speakerNotes) {
    const notesText = formatSpeakerNotesForPptx(speakerNotes);
    if (notesText) {
      slide.addNotes(notesText);
    }
  }
}

function addSectionTitleSlide(pptx, data, slideNumber) {
  const L = LAYOUTS.sectionTitle;
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.navy };
  if (data.swimlane) {
    const swimlaneText = formatSectionTitle(data.swimlane).toUpperCase();
    slide.addText(swimlaneText, {
      x: L.swimlaneLabel.x,
      y: L.swimlaneLabel.y,
      w: L.swimlaneLabel.w,
      h: L.swimlaneLabel.h,
      fontSize: 14,
      fontFace: 'Work Sans SemiBold',
      color: COLORS.white,
      align: 'left',
      charSpacing: 1
    });
  }
  const titleText = formatSectionTitle(data.sectionTitle || data.swimlane || '');
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 72,
    fontFace: 'Work Sans Thin',
    color: COLORS.white,
    align: 'center',
    valign: 'middle',
    lineSpacingMultiple: 1.1
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: L.redLine.x,
    y: L.redLine.y,
    w: L.redLine.w,
    h: L.redLine.h,
    fill: { color: COLORS.red },
    line: { color: COLORS.red, width: 0 }
  });
  _addLogo(slide, L);
  _addPageNumber(slide, L, slideNumber, COLORS.mutedWhite);
}

function addTwoColumnSlide(pptx, data, slideNumber, speakerNotes = null) {
  const L = LAYOUTS.twoColumn;
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  const tagline = getSectionLabel(data);
  if (tagline) {
    slide.addText(tagline, {
      x: L.tagline.x, y: L.tagline.y, w: L.tagline.w, h: L.tagline.h,
      ...TAGLINE_STYLE
    });
  }
  const titleText = formatTitle(data.title, 10);
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 72,
    fontFace: 'Work Sans Thin',
    color: COLORS.navy,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 0.85
  });
  const bodyText = formatBody(data.paragraph1, data.paragraph2, 410);
  if (bodyText) {
    slide.addText(bodyText, {
      x: L.body.x, y: L.body.y, w: L.body.w, h: L.body.h,
      ...BODY_TEXT_BASE,
      lineSpacingMultiple: 1.35,
      paraSpaceAfter: 8,
      charSpacing: 0.3  // Approximate letter-spacing: 0.02em
    });
  }
  addCornerGraphic(slide, L);
  _addLogo(slide, L);
  _addPageNumber(slide, L, slideNumber);
  _addSpeakerNotes(slide, speakerNotes);
}

function addThreeColumnSlide(pptx, data, slideNumber, speakerNotes = null) {
  const L = LAYOUTS.threeColumn;
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  const tagline = getSectionLabel(data);
  if (tagline) {
    slide.addText(tagline, {
      x: L.tagline.x, y: L.tagline.y, w: L.tagline.w, h: L.tagline.h,
      ...TAGLINE_STYLE
    });
  }
  const titleText = formatTitle(data.title, 18);
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 44,
    fontFace: 'Work Sans Light',
    color: COLORS.navy,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 0.85
  });
  const totalWidth = L.columns.w;
  const gapWidth = L.columnGap;
  const columnWidth = (totalWidth - (2 * gapWidth)) / 3;
  const columnTexts = [
    truncateToSentence(normalizeBodyText(data.paragraph1), 390),
    truncateToSentence(normalizeBodyText(data.paragraph2), 390),
    truncateToSentence(normalizeBodyText(data.paragraph3 || data.paragraph1), 390)
  ];

  columnTexts.forEach((text, index) => {
    if (text) {
      const columnX = L.columns.x + (index * (columnWidth + gapWidth));
      slide.addText(text, {
        x: columnX, y: L.columns.y, w: columnWidth, h: L.columns.h,
        ...BODY_TEXT_BASE,
        lineSpacingMultiple: 1.30
      });
    }
  });
  addCornerGraphic(slide, L);
  _addLogo(slide, L);
  _addPageNumber(slide, L, slideNumber);
  _addSpeakerNotes(slide, speakerNotes);
}

function flattenSections(sections) {
  const flatSlides = [];

  for (const section of sections) {
    if (!section.swimlane) continue;
    flatSlides.push({
      layout: 'sectionTitle',
      swimlane: section.swimlane,
      sectionTitle: section.sectionTitle || section.swimlane
    });
    if (section.slides && Array.isArray(section.slides) && section.slides.length > 0) {
      flatSlides.push(...section.slides);
    }
  }

  return flatSlides;
}

// Generate PowerPoint presentation from slides data
export async function generatePptx(slidesData, options = {}) {
  if (!slidesData || typeof slidesData !== 'object') {
    throw new Error('Invalid slides data: expected object');
  }
  loadAssets();

  const pptx = new PptxGenJS();
  pptx.author = options.author || 'BIP';
  pptx.company = options.company || 'BIP';
  pptx.title = slidesData.title || 'Presentation';
  pptx.subject = options.subject || 'Generated Presentation';
  pptx.revision = '1';
  pptx.defineLayout({
    name: 'CUSTOM_16_9',
    width: SLIDE.WIDTH,
    height: SLIDE.HEIGHT
  });
  pptx.layout = 'CUSTOM_16_9';
  let slidesArray = [];
  if (slidesData.sections && Array.isArray(slidesData.sections) && slidesData.sections.length > 0) {
    slidesArray = flattenSections(slidesData.sections);
  }
  const speakerNotesData = slidesData.speakerNotes?.slides || [];
  const hasSpeakerNotes = speakerNotesData.length > 0;
  // Helper to find speaker notes for a slide (three-tier matching strategy)
  const findSpeakerNotes = (slideData, sectionName) => {
    if (!hasSpeakerNotes || slideData.layout === 'sectionTitle') return null;

    const tagline = (slideData.tagline || '').toLowerCase().trim();
    const section = (sectionName || '').toLowerCase().trim();

    // Strategy 1: Exact match on both section and tagline
    const exactMatch = speakerNotesData.find(note =>
      note.slideTagline?.toLowerCase().trim() === tagline &&
      note.sectionName?.toLowerCase().trim() === section
    );
    if (exactMatch) return exactMatch;

    // Strategy 2: Section contains match + exact tagline
    const partialMatch = speakerNotesData.find(note =>
      note.slideTagline?.toLowerCase().trim() === tagline &&
      (note.sectionName?.toLowerCase().includes(section) ||
       section.includes(note.sectionName?.toLowerCase() || ''))
    );
    if (partialMatch) return partialMatch;

    // Strategy 3: Tagline-only (single match only to avoid ambiguity)
    const taglineMatches = speakerNotesData.filter(note =>
      note.slideTagline?.toLowerCase().trim() === tagline
    );
    if (taglineMatches.length === 1) return taglineMatches[0];

    return null;
  };
  let currentSectionName = '';
  for (let i = 0; i < slidesArray.length; i++) {
    const slideData = slidesArray[i];
    const slideNumber = i + 1;
    const layout = slideData.layout || 'twoColumn';
    if (layout === 'sectionTitle') {
      currentSectionName = slideData.swimlane || '';
    }
    const speakerNotes = findSpeakerNotes(slideData, currentSectionName);

    if (layout === 'sectionTitle') {
      addSectionTitleSlide(pptx, slideData, slideNumber);
    } else if (layout === 'threeColumn') {
      addThreeColumnSlide(pptx, slideData, slideNumber, speakerNotes);
    } else {
      addTwoColumnSlide(pptx, slideData, slideNumber, speakerNotes);
    }
  }

  return await pptx.write({ outputType: 'nodebuffer' });
}

export default { generatePptx };
