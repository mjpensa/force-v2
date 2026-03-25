import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toSentenceCase, normalizeBodyText, truncateToSentence, enforceTitleLineCount, formatTitle, formatSectionTitle, formatBody, checkAcronym, ACRONYMS_UPPER, ACRONYMS_MIXED } from '../../shared/text-utils.js';

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
    pageNumber: {
      x: pctX(2.11),
      y: SLIDE.HEIGHT - pctY(3.43) - 0.3,
      ...SHARED_PAGE_NUMBER
    }
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
    pageNumber: {
      x: pctX(2.11),
      y: SLIDE.HEIGHT - pctY(3.43) - 0.3,
      ...SHARED_PAGE_NUMBER
    }
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
    pageNumber: {
      x: pctX(2.10),
      y: SLIDE.HEIGHT - pctY(3.43) - 0.3,
      ...SHARED_PAGE_NUMBER
    }
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

  // 0. QUICK REFERENCE (highest priority - cheat sheet for presenter)
  if (notes.quickReference && currentLength < 200) {
    const qr = notes.quickReference;
    let cheatText = '';
    if (qr.keyNumber) cheatText += `KEY NUMBER: ${qr.keyNumber}\n`;
    if (qr.keyPhrase) cheatText += `KEY PHRASE: "${qr.keyPhrase}"\n`;
    if (qr.keyProof) cheatText += `PROOF: ${qr.keyProof}\n`;
    if (qr.keyAsk) cheatText += `ASK: ${qr.keyAsk}`;
    if (cheatText) addSection('QUICK REFERENCE:', cheatText.trim(), 'high');
  }

  // 1. TALKING POINTS (highest priority - always try to include)
  if (notes.narrative?.talkingPoints?.length) {
    const points = notes.narrative.talkingPoints
      .map((p, i) => `${i + 1}. ${p}`)
      .join('\n');
    addSection('TALKING POINTS:', points, 'high');

    // Key phrase (high priority)
    if (notes.narrative.keyPhrase && currentLength < maxLength - 100) {
      addSection('KEY PHRASE:', `"${notes.narrative.keyPhrase}"`, 'high');
    }
  }

  // 2. STAKEHOLDER ANGLES (sales enhancement #1 - high priority for consulting)
  if (notes.stakeholderAngles && currentLength < maxLength - 250) {
    const angles = notes.stakeholderAngles;
    let angleText = '';
    if (angles.cfo) angleText += `CFO: ${angles.cfo}\n`;
    if (angles.cto) angleText += `CTO: ${angles.cto}\n`;
    if (angles.ceo) angleText += `CEO: ${angles.ceo}\n`;
    if (angles.operations) angleText += `OPS: ${angles.operations}`;
    if (angleText) addSection('STAKEHOLDER ANGLES:', angleText.trim());
  }

  // 3. TRANSITIONS (medium priority)
  if (notes.narrative?.transitionIn || notes.narrative?.transitionOut) {
    let transitionText = '';
    if (notes.narrative.transitionIn) {
      transitionText += `From previous: ${notes.narrative.transitionIn}\n`;
    }
    if (notes.narrative.transitionOut) {
      transitionText += `To next: ${notes.narrative.transitionOut}`;
    }
    addSection('TRANSITIONS:', transitionText.trim());
  }

  // 4. ANTICIPATED QUESTIONS (with severity - sales enhancement #2)
  if (notes.anticipatedQuestions?.length && currentLength < maxLength - 400) {
    // Prioritize deal_breaker and hostile questions
    const prioritized = [...notes.anticipatedQuestions].sort((a, b) => {
      const severityOrder = { deal_breaker: 0, hostile: 1, skeptical: 2, probing: 3 };
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });

    const qaText = prioritized
      .slice(0, 2) // Limit to 2 Q&As for space
      .map(qa => {
        let text = `[${(qa.severity || 'probing').toUpperCase()}] Q: ${qa.question}\nA: ${qa.response}`;
        if (qa.escalationResponse && qa.severity === 'deal_breaker') {
          text += `\nIF THEY PUSH BACK: ${qa.escalationResponse}`;
        }
        return text;
      })
      .join('\n\n');
    addSection('Q&A PREP:', qaText);
  }

  // 5. CALL-TO-ACTION VARIANTS (sales enhancement #8)
  if (notes.storyContext?.callToAction && currentLength < maxLength - 200) {
    const cta = notes.storyContext.callToAction;
    let ctaText = '';
    if (cta.warmAudience?.ask) ctaText += `WARM: ${cta.warmAudience.ask}\n`;
    if (cta.neutralAudience?.ask) ctaText += `NEUTRAL: ${cta.neutralAudience.ask}\n`;
    if (cta.hostileAudience?.ask) ctaText += `HOSTILE: ${cta.hostileAudience.ask}`;
    if (ctaText) addSection('CALL-TO-ACTION:', ctaText.trim());
  }

  // 6. WHY THIS MATTERS (medium-high priority)
  if (notes.storyContext?.soWhat && currentLength < maxLength - 150) {
    addSection('WHY THIS MATTERS:', notes.storyContext.soWhat, 'high');
  }

  // 7. TIME GUIDANCE (sales enhancement #9)
  if (notes.storyContext?.timeGuidance && currentLength < maxLength - 100) {
    const tg = notes.storyContext.timeGuidance;
    let timeText = '';
    if (tg.suggestedDuration) timeText += `Duration: ${tg.suggestedDuration}`;
    if (tg.condensedVersion) timeText += `\nShort version: "${tg.condensedVersion}"`;
    if (timeText) addSection('TIME:', timeText.trim());
  }

  // 8. SOURCES (lower priority - truncate claims aggressively)
  if (notes.sourceAttribution?.length && currentLength < maxLength - 200) {
    const sourcesText = notes.sourceAttribution
      .slice(0, 2) // Limit to 2 sources
      .map(src => {
        const truncatedClaim = src.claim?.length > 80
          ? src.claim.substring(0, 80) + '...'
          : src.claim;
        return `• ${src.source}: "${truncatedClaim}"`;
      })
      .join('\n');
    addSection('SOURCES:', sourcesText);
  }

  // 9. CREDIBILITY ANCHORS (third-party validation for skeptical audiences)
  if (notes.credibilityAnchors?.length && currentLength < maxLength - 150) {
    const anchorsText = notes.credibilityAnchors
      .slice(0, 2) // Limit to 2 for space
      .map(anchor => {
        const typeLabel = (anchor.type || 'research').toUpperCase().replace(/_/g, ' ');
        return `[${typeLabel}] ${anchor.dropPhrase}\n  → ${anchor.statement}`;
      })
      .join('\n\n');
    addSection('CREDIBILITY ANCHORS:', anchorsText);
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
      x: L.tagline.x,
      y: L.tagline.y,
      w: L.tagline.w,
      h: L.tagline.h,
      fontSize: 12,
      fontFace: 'Work Sans SemiBold',
      color: COLORS.red,
      align: 'left',
      charSpacing: 0.5
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
  const bodyText = formatBody(data.paragraph1, data.paragraph2, 415);
  if (bodyText) {
    slide.addText(bodyText, {
      x: L.body.x,
      y: L.body.y,
      w: L.body.w,
      h: L.body.h,
      fontSize: 10.5,
      fontFace: 'Work Sans',
      color: COLORS.navy,
      align: 'left',
      valign: 'top',
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
      x: L.tagline.x,
      y: L.tagline.y,
      w: L.tagline.w,
      h: L.tagline.h,
      fontSize: 12,
      fontFace: 'Work Sans SemiBold',
      color: COLORS.red,
      align: 'left',
      charSpacing: 0.5
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
    truncateToSentence(normalizeBodyText(data.paragraph1), 400),
    truncateToSentence(normalizeBodyText(data.paragraph2), 400),
    truncateToSentence(normalizeBodyText(data.paragraph3 || data.paragraph1), 400)
  ];

  columnTexts.forEach((text, index) => {
    if (text) {
      const columnX = L.columns.x + (index * (columnWidth + gapWidth));
      slide.addText(text, {
        x: columnX,
        y: L.columns.y,
        w: columnWidth,
        h: L.columns.h,
        fontSize: 10.5,
        fontFace: 'Work Sans',
          color: COLORS.navy,
        align: 'left',
        valign: 'top',
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
