/**
 * PPT Export Service v2
 * Rebuilt to match browser preview exactly
 *
 * Slide types: sectionTitle, twoColumn, threeColumn
 * All positions calculated from browser CSS percentages
 */

import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// SLIDE DIMENSIONS
// ============================================================================

const SLIDE = {
  WIDTH: 13.33,   // inches
  HEIGHT: 7.5     // inches (16:9 aspect ratio)
};

// Convert percentage to inches
const pctX = (p) => (p / 100) * SLIDE.WIDTH;
const pctY = (p) => (p / 100) * SLIDE.HEIGHT;

// ============================================================================
// COLORS
// ============================================================================

const COLORS = {
  navy: '0C2340',       // Primary brand - titles, body text
  red: 'DA291C',        // Accent - taglines, decorative elements
  white: 'FFFFFF',      // Backgrounds, section title text
  darkGray: '6B7280',   // Page numbers on white backgrounds
  mutedWhite: '999999'  // Page numbers on dark backgrounds (~60% white)
};

// ============================================================================
// LAYOUTS - Exact browser CSS measurements converted to inches
// ============================================================================

const LAYOUTS = {
  // Section Title Slide (navy background, centered title)
  sectionTitle: {
    // Browser: top: 5%, left: 4%
    swimlaneLabel: {
      x: pctX(4),
      y: pctY(5),
      w: 5,
      h: 0.4
    },
    // Centered title
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
    // No corner graphic on section title slides - only used on templates 1 and 2
    // Logo: bottom: 3%, right: 2%, height: 4%
    // Logo actual dimensions: 816x569 (aspect ratio ~1.434:1)
    // Reduced size for cleaner web rendering
    logo: {
      x: SLIDE.WIDTH - 0.75,
      y: SLIDE.HEIGHT - 0.50,
      w: 0.30 * (816 / 569),  // ~0.43 inches (calculated from aspect ratio)
      h: 0.30
    },
    // Page number: bottom: 3.43%, left: 2.11%
    pageNumber: {
      x: pctX(2.11),
      y: SLIDE.HEIGHT - pctY(3.43) - 0.3,  // bottom position - element height
      w: 0.5,
      h: 0.3
    }
  },

  // Two Column Content Slide
  twoColumn: {
    // Tagline: top: 3.43%, left: 2.11%
    tagline: {
      x: pctX(2.11),
      y: pctY(3.43),
      w: 3,
      h: 0.35
    },
    // Title: top: 7%, left: 1.87%, width: 44.59%, height: 40%
    title: {
      x: pctX(1.87),
      y: pctY(7),
      w: pctX(44.59),
      h: pctY(40)
    },
    // Body: left: 50.59%, top: 57%, width: 44.30%, bottom: 6%
    body: {
      x: pctX(50.59),
      y: pctY(57),
      w: pctX(44.30),
      h: pctY(37)  // 100% - 57% - 6%
    },
    // Corner graphic: top: 0, right: 0, width: 10%
    // SVG actual dimensions: 312x313 (essentially square, ~1:1 ratio)
    // Slightly reduced from 10.9% to 10% for better web rendering
    cornerGraphic: {
      x: SLIDE.WIDTH - pctX(10),
      y: 0,
      w: pctX(10),
      h: pctX(10)  // Square aspect ratio
    },
    // Logo: bottom: 3%, right: 2%
    // Logo actual dimensions: 816x569 (aspect ratio ~1.434:1)
    // Reduced size for cleaner web rendering
    logo: {
      x: SLIDE.WIDTH - 0.75,
      y: SLIDE.HEIGHT - 0.50,
      w: 0.30 * (816 / 569),  // ~0.43 inches
      h: 0.30
    },
    // Page number: bottom: 3.43%, left: 2.11%
    pageNumber: {
      x: pctX(2.11),
      y: SLIDE.HEIGHT - pctY(3.43) - 0.3,  // bottom position - element height
      w: 0.5,
      h: 0.3
    }
  },

  // Three Column Content Slide
  threeColumn: {
    // Tagline: top: 3.47%, left: 2.10%
    tagline: {
      x: pctX(2.10),
      y: pctY(3.47),
      w: 3,
      h: 0.35
    },
    // Title: top: 7%, left: 1.87%, width: 20.70%, height: 40%
    title: {
      x: pctX(1.87),
      y: pctY(7),
      w: pctX(20.70),
      h: pctY(40)
    },
    // Columns: left: 26.71%, top: 46.13%, width: 68.27%, height: 46.93%
    columns: {
      x: pctX(26.71),
      y: pctY(46.13),
      w: pctX(68.27),
      h: pctY(46.93)
    },
    // Column gap: 4.43%
    columnGap: pctX(4.43),
    // Corner graphic - SVG actual dimensions: 312x313 (essentially square)
    // Slightly reduced from 10.9% to 10% for better web rendering
    cornerGraphic: {
      x: SLIDE.WIDTH - pctX(10),
      y: 0,
      w: pctX(10),
      h: pctX(10)  // Square aspect ratio
    },
    // Logo - actual dimensions: 816x569 (aspect ratio ~1.434:1)
    // Reduced size for cleaner web rendering
    logo: {
      x: SLIDE.WIDTH - 0.75,
      y: SLIDE.HEIGHT - 0.50,
      w: 0.30 * (816 / 569),  // ~0.43 inches
      h: 0.30
    },
    // Page number
    pageNumber: {
      x: pctX(2.10),
      y: SLIDE.HEIGHT - pctY(3.43) - 0.3,  // bottom position - element height
      w: 0.5,
      h: 0.3
    }
  }
};

// ============================================================================
// ASSETS - Loaded as base64 for reliable embedding
// ============================================================================

let ASSETS = {
  logo: null,
  logoWhite: null,
  cornerGraphic: null,
  cornerGraphicWhite: null
};

let assetsLoaded = false;

/**
 * Load image assets as base64 encoded strings
 */
function loadAssets() {
  if (assetsLoaded) return;

  // Find project root (go up from server/templates)
  const projectRoot = path.resolve(__dirname, '..', '..');
  const publicDir = path.join(projectRoot, 'Public');

  // Load red BIP logo
  const logoPath = path.join(publicDir, 'Red BIP Logo.png');
  if (fs.existsSync(logoPath)) {
    const logoData = fs.readFileSync(logoPath);
    ASSETS.logo = `image/png;base64,${logoData.toString('base64')}`;
    console.log('[PPT Export v2] Loaded logo asset');
  } else {
    console.warn('[PPT Export v2] Logo not found at:', logoPath);
  }

  // Load corner graphic SVG (convert to base64)
  const cornerPath = path.join(publicDir, 'bip corner graphic.svg');
  if (fs.existsSync(cornerPath)) {
    const svgData = fs.readFileSync(cornerPath);
    ASSETS.cornerGraphic = `image/svg+xml;base64,${svgData.toString('base64')}`;
    console.log('[PPT Export v2] Loaded corner graphic asset');
  }

  assetsLoaded = true;
}

// ============================================================================
// TEXT FORMATTING HELPERS
// ============================================================================

// ALL CAPS acronyms - these get uppercased
const ACRONYMS_UPPER = [
  'DRR', 'CDM', 'API', 'APIS', 'ROI', 'KPI', 'KPIS', 'CEO', 'CTO', 'CFO', 'COO', 'CIO',
  'AI', 'ML', 'US', 'UK', 'EU', 'UN', 'CFTC', 'SEC', 'FDA', 'EPA',
  'UTI', 'UPI', 'ESG', 'DEI', 'M&A', 'IPO', 'ETF', 'ETL', 'GDP', 'B2B', 'B2C', 'P2P',
  'AWS', 'GCP', 'IT', 'HR', 'PR', 'R&D', 'P&L',
  'CPMI', 'IOSCO', 'OTC', 'FX', 'USD', 'EUR', 'GBP',
  'CRM', 'ERP', 'ISDA', 'LEI', 'EMIR', 'SFTR', 'NFA',  // Note: MiFID handled in ACRONYMS_MIXED
  'FINRA', 'OCC', 'DTCC', 'SWIFT', 'ISO', 'XML', 'JSON', 'REST', 'SDK'
];

// MIXED CASE acronyms - preserve exact capitalization
const ACRONYMS_MIXED = {
  'fpml': 'FpML',
  'saas': 'SaaS',
  'paas': 'PaaS',
  'iaas': 'IaaS',
  'regtech': 'RegTech',
  'fintech': 'FinTech',
  'devops': 'DevOps',
  'mifid': 'MiFID',  // Can be MiFID or MIFID depending on context
  // Proper nouns with periods (place names must always be capitalized)
  'u.s.': 'U.S.',
  'u.k.': 'U.K.',
  'e.u.': 'E.U.'
};

/**
 * Check if a single word (no slashes) is an acronym
 * Returns: { isAcronym: boolean, value: string }
 */
function checkSingleAcronym(word) {
  if (!word) return { isAcronym: false, value: word };

  const lowerWord = word.toLowerCase();
  const upperWord = word.toUpperCase();

  // Check mixed-case acronyms first (exact match needed)
  if (ACRONYMS_MIXED[lowerWord]) {
    return { isAcronym: true, value: ACRONYMS_MIXED[lowerWord] };
  }

  // Check ALL CAPS acronyms
  if (ACRONYMS_UPPER.includes(upperWord)) {
    return { isAcronym: true, value: upperWord };
  }

  // Dynamic check: 2-5 uppercase letters/numbers (already uppercase = acronym)
  if (/^[A-Z][A-Z0-9]{1,4}$/.test(word)) {
    return { isAcronym: true, value: word };
  }

  return { isAcronym: false, value: word };
}

/**
 * Get the correct form of an acronym, handling compound forms like "CDM/DRR"
 * Returns: { isAcronym: boolean, value: string }
 */
function getAcronymForm(word) {
  if (!word) return { isAcronym: false, value: word };

  // Handle slashed compound acronyms like "CDM/DRR"
  if (word.includes('/')) {
    const parts = word.split('/');
    const results = parts.map(part => checkSingleAcronym(part));
    const allAcronyms = results.every(r => r.isAcronym);

    if (allAcronyms) {
      return { isAcronym: true, value: results.map(r => r.value).join('/') };
    }
    return { isAcronym: false, value: word };
  }

  return checkSingleAcronym(word);
}

/**
 * Convert text to sentence case while preserving acronyms
 */
function toSentenceCase(text) {
  if (!text) return '';

  return text.split('\n').map((line, lineIndex) => {
    const words = line.split(/(\s+)/);

    return words.map((word, wordIndex) => {
      if (/^\s*$/.test(word)) return word;

      // Check if word is an acronym and get correct form
      const acronymResult = getAcronymForm(word);
      if (acronymResult.isAcronym) {
        return acronymResult.value;
      }

      // First word of first line: capitalize
      if (lineIndex === 0 && wordIndex === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      // All other words: lowercase
      return word.toLowerCase();
    }).join('');
  }).join('\n');
}

/**
 * Enforce 3-4 lines for title (merge if >4, keep as-is if 3-4)
 * Does NOT pad to 4 lines - allows clean 3-line titles
 * @param {string} title - The title text with \n separators
 * @param {number} maxCharsPerLine - Maximum characters per line (10 for twoColumn, 18 for threeColumn)
 */
function enforceTitleLineCount(title, maxCharsPerLine = 10) {
  if (!title) return '';

  let lines = title.split('\n').map(l => l.trim()).filter(l => l);

  // If already 3 or 4 lines, keep as-is
  if (lines.length >= 3 && lines.length <= 4) {
    return lines.join('\n');
  }

  // If fewer than 3 lines, just return what we have (don't pad)
  if (lines.length < 3) {
    return lines.join('\n');
  }

  // Merge lines if more than 4, respecting character limits
  while (lines.length > 4) {
    // Find the shortest pair that won't exceed character limit
    let bestMergeIndex = -1;
    let bestCombinedLength = Infinity;

    for (let i = 0; i < lines.length - 1; i++) {
      const combinedLength = lines[i].length + lines[i + 1].length + 1; // +1 for space
      // Only consider merges that stay within character limit
      if (combinedLength <= maxCharsPerLine && combinedLength < bestCombinedLength) {
        bestCombinedLength = combinedLength;
        bestMergeIndex = i;
      }
    }

    if (bestMergeIndex === -1) {
      // No valid merge possible without exceeding char limit - truncate to 4 lines
      console.warn(`[PPT Export] Title has ${lines.length} lines, cannot merge within ${maxCharsPerLine} char limit. Truncating to 4 lines. Original: "${lines.join(' | ')}"`);
      lines = lines.slice(0, 4);
      break;
    }

    lines[bestMergeIndex] = lines[bestMergeIndex] + ' ' + lines[bestMergeIndex + 1];
    lines.splice(bestMergeIndex + 1, 1);
  }

  return lines.join('\n');
}

/**
 * Format title: sentence case + enforce 3-4 lines
 * @param {string} title - The title text
 * @param {number} maxCharsPerLine - Maximum characters per line (10 for twoColumn, 18 for threeColumn)
 */
function formatTitle(title, maxCharsPerLine = 10) {
  const sentenceCase = toSentenceCase(title);
  return enforceTitleLineCount(sentenceCase, maxCharsPerLine);
}

/**
 * Format section title: preserve acronyms but don't apply full sentence case
 * (Section titles are typically title case, not sentence case)
 */
function formatSectionTitle(title) {
  if (!title) return '';

  // Apply acronym corrections to each word
  return title.split(/(\s+)/).map(word => {
    if (/^\s*$/.test(word)) return word;
    const acronymResult = getAcronymForm(word);
    if (acronymResult.isAcronym) {
      return acronymResult.value;
    }
    return word;
  }).join('');
}

/**
 * Truncate text to a character limit at sentence boundary
 * Matches browser behavior in SlidesView.js
 * @param {string} text - Text to truncate
 * @param {number} maxChars - Maximum characters allowed
 * @returns {string} Truncated text
 */
function truncateToSentence(text, maxChars = 415) {
  if (!text) return '';
  text = text.trim().replace(/\n/g, ' '); // Normalize whitespace
  if (text.length <= maxChars) return text;

  // Find last sentence end before the limit
  const truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);

  if (lastSentenceEnd > maxChars * 0.6) {
    // Found a sentence end in the last 40% of allowed text
    return text.substring(0, lastSentenceEnd + 1);
  }
  // No good sentence break, cut at word boundary
  return truncated.replace(/\s+\S*$/, '') + '.';
}

/**
 * Normalize body text by converting all-caps words to proper case
 * Preserves known acronyms
 * @param {string} text - Body text to normalize
 * @returns {string} Normalized text
 */
function normalizeBodyText(text) {
  if (!text) return '';

  // Match all-caps words (3+ letters) that aren't known acronyms
  return text.replace(/\b([A-Z]{3,})\b/g, (match) => {
    const acronymResult = getAcronymForm(match);
    if (acronymResult.isAcronym) {
      return acronymResult.value; // Keep as-is
    }
    // Convert to proper case (first letter uppercase, rest lowercase)
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
}

/**
 * Format body paragraphs with proper spacing, normalization, and truncation
 * @param {string} p1 - First paragraph
 * @param {string} p2 - Second paragraph
 * @param {number} maxChars - Max chars per paragraph (default 415 for two-column)
 */
function formatBody(p1, p2, maxChars = 415) {
  const parts = [];
  // Pipeline: normalize caps → truncate
  if (p1) parts.push(truncateToSentence(normalizeBodyText(p1), maxChars));
  if (p2) parts.push(truncateToSentence(normalizeBodyText(p2), maxChars));
  // Single \n creates paragraph break; paraSpaceAfter handles the spacing
  return parts.join('\n');
}

/**
 * Get section/tagline label
 */
function getSectionLabel(slideData) {
  const label = slideData.tagline || slideData.section || slideData.sectionLabel;
  return label ? String(label).toUpperCase() : '';
}

// ============================================================================
// CORNER GRAPHIC - Uses actual SVG file from repo
// ============================================================================

/**
 * Add corner graphic image to slide
 * Uses the actual SVG file loaded as base64
 */
function addCornerGraphic(pptx, slide, layout, isDarkBackground = false) {
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

// ============================================================================
// SPEAKER NOTES FORMATTER - For PPTX notes field
// ============================================================================

/**
 * Format speaker notes for PowerPoint notes field
 * Priority ordering: Quick Ref > Talking Points > Q&A > CTA > Sources (truncate if needed)
 * Enhanced with sentence-boundary truncation for graceful overflow handling
 * Updated with sales enhancements for consulting executives
 * @param {object} notes - Speaker notes object for a slide
 * @param {number} maxLength - Maximum characters (PPTX practical limit ~3000)
 * @returns {string} Formatted notes text for PPTX
 */
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

// ============================================================================
// SLIDE RENDERERS
// ============================================================================

/**
 * Add Section Title Slide
 * Navy background, centered title, white text
 */
function addSectionTitleSlide(pptx, data, slideNumber) {
  const L = LAYOUTS.sectionTitle;
  const slide = pptx.addSlide();

  // Navy background
  slide.background = { color: COLORS.navy };

  // Swimlane label (white on dark, semi-bold - weight 600)
  if (data.swimlane) {
    const swimlaneText = formatSectionTitle(data.swimlane).toUpperCase();
    slide.addText(swimlaneText, {
      x: L.swimlaneLabel.x,
      y: L.swimlaneLabel.y,
      w: L.swimlaneLabel.w,
      h: L.swimlaneLabel.h,
      fontSize: 14,
      fontFace: 'Work Sans SemiBold',
      bold: false,
      color: COLORS.white,
      align: 'left',
      charSpacing: 1
    });
  }

  // Main section title (centered, large, thin font - weight 100)
  // Font: 72pt Work Sans Thin per browser CSS (font-weight: 100)
  const titleText = formatSectionTitle(data.sectionTitle || data.swimlane || '');
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 72,
    fontFace: 'Work Sans Thin',
    bold: false,
    color: COLORS.white,
    align: 'center',
    valign: 'middle',
    lineSpacingMultiple: 1.1
  });

  // Red decorative line under title
  slide.addShape(pptx.ShapeType.rect, {
    x: L.redLine.x,
    y: L.redLine.y,
    w: L.redLine.w,
    h: L.redLine.h,
    fill: { color: COLORS.red },
    line: { color: COLORS.red, width: 0 }
  });

  // No corner graphic on section title slides - only used on templates 1 and 2

  // Logo
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: L.logo.x,
      y: L.logo.y,
      w: L.logo.w,
      h: L.logo.h
    });
  }

  // Page number (muted white)
  slide.addText(String(slideNumber), {
    x: L.pageNumber.x,
    y: L.pageNumber.y,
    w: L.pageNumber.w,
    h: L.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color: COLORS.mutedWhite,
    align: 'left'
  });
}

/**
 * Add Two-Column Content Slide
 * White background, title left, body right
 * @param {object} speakerNotes - Optional speaker notes for this slide
 */
function addTwoColumnSlide(pptx, data, slideNumber, speakerNotes = null) {
  const L = LAYOUTS.twoColumn;
  const slide = pptx.addSlide();

  // White background
  slide.background = { color: COLORS.white };

  // Tagline (red, uppercase, semi-bold - weight 600)
  const tagline = getSectionLabel(data);
  if (tagline) {
    slide.addText(tagline, {
      x: L.tagline.x,
      y: L.tagline.y,
      w: L.tagline.w,
      h: L.tagline.h,
      fontSize: 12,
      fontFace: 'Work Sans SemiBold',
      bold: false,
      color: COLORS.red,
      align: 'left',
      charSpacing: 0.5
    });
  }

  // Title (navy, large, thin font, 4 lines)
  // twoColumn layout: max 10 characters per line
  // Font: 72pt Work Sans Thin (weight 100) per original PPT template
  const titleText = formatTitle(data.title, 10);
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 72,
    fontFace: 'Work Sans Thin',
    bold: false,
    color: COLORS.navy,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 0.85
  });

  // Body text (two paragraphs) - truncated to 415 chars each
  // Browser: font-size: clamp(7px, 1.15cqw, 14px), line-height: 1.35, margin-bottom: 0.8em
  // 14px = 10.5pt, 0.8em at 14px = 11.2px ≈ 8pt
  const bodyText = formatBody(data.paragraph1, data.paragraph2, 415);
  if (bodyText) {
    slide.addText(bodyText, {
      x: L.body.x,
      y: L.body.y,
      w: L.body.w,
      h: L.body.h,
      fontSize: 10.5,
      fontFace: 'Work Sans',
      bold: false,
      color: COLORS.navy,
      align: 'left',
      valign: 'top',
      lineSpacingMultiple: 1.35,
      paraSpaceAfter: 8,
      charSpacing: 0.3  // Approximate letter-spacing: 0.02em
    });
  }

  // Corner graphic (shape-based)
  addCornerGraphic(pptx, slide, L, false);

  // Logo
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: L.logo.x,
      y: L.logo.y,
      w: L.logo.w,
      h: L.logo.h
    });
  }

  // Page number (dark gray)
  slide.addText(String(slideNumber), {
    x: L.pageNumber.x,
    y: L.pageNumber.y,
    w: L.pageNumber.w,
    h: L.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color: COLORS.darkGray,
    align: 'left'
  });

  // Add speaker notes if provided
  if (speakerNotes) {
    const notesText = formatSpeakerNotesForPptx(speakerNotes);
    if (notesText) {
      slide.addNotes(notesText);
    }
  }
}

/**
 * Add Three-Column Content Slide
 * White background, narrow title left, three columns below
 * @param {object} speakerNotes - Optional speaker notes for this slide
 */
function addThreeColumnSlide(pptx, data, slideNumber, speakerNotes = null) {
  const L = LAYOUTS.threeColumn;
  const slide = pptx.addSlide();

  // White background
  slide.background = { color: COLORS.white };

  // Tagline (red, uppercase, semi-bold - weight 600)
  const tagline = getSectionLabel(data);
  if (tagline) {
    slide.addText(tagline, {
      x: L.tagline.x,
      y: L.tagline.y,
      w: L.tagline.w,
      h: L.tagline.h,
      fontSize: 12,
      fontFace: 'Work Sans SemiBold',
      bold: false,
      color: COLORS.red,
      align: 'left',
      charSpacing: 0.5
    });
  }

  // Title (narrower, light weight - 300)
  // threeColumn layout: max 18 characters per line
  // Font: Work Sans Light per browser CSS (font-weight: 300)
  const titleText = formatTitle(data.title, 18);
  slide.addText(titleText, {
    x: L.title.x,
    y: L.title.y,
    w: L.title.w,
    h: L.title.h,
    fontSize: 44,
    fontFace: 'Work Sans Light',
    bold: false,
    color: COLORS.navy,
    align: 'left',
    valign: 'top',
    lineSpacingMultiple: 0.85
  });

  // Three columns - calculate widths
  const totalWidth = L.columns.w;
  const gapWidth = L.columnGap;
  const columnWidth = (totalWidth - (2 * gapWidth)) / 3;

  // Normalize and truncate column text to 400 chars (matches browser SlidesView.js)
  // Browser: font-size: clamp(7px, 1.15cqw, 14px), line-height: 1.3
  // 14px = 10.5pt
  const columnTexts = [
    truncateToSentence(normalizeBodyText(data.paragraph1), 400),
    truncateToSentence(normalizeBodyText(data.paragraph2), 400),
    truncateToSentence(normalizeBodyText(data.paragraph3), 400)
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
        bold: false,
        color: COLORS.navy,
        align: 'left',
        valign: 'top',
        lineSpacingMultiple: 1.30
      });
    }
  });

  // Corner graphic
  addCornerGraphic(pptx, slide, L, false);

  // Logo
  if (ASSETS.logo) {
    slide.addImage({
      data: ASSETS.logo,
      x: L.logo.x,
      y: L.logo.y,
      w: L.logo.w,
      h: L.logo.h
    });
  }

  // Page number
  slide.addText(String(slideNumber), {
    x: L.pageNumber.x,
    y: L.pageNumber.y,
    w: L.pageNumber.w,
    h: L.pageNumber.h,
    fontSize: 10,
    fontFace: 'Work Sans',
    color: COLORS.darkGray,
    align: 'left'
  });

  // Add speaker notes if provided
  if (speakerNotes) {
    const notesText = formatSpeakerNotesForPptx(speakerNotes);
    if (notesText) {
      slide.addNotes(notesText);
    }
  }
}

// ============================================================================
// SECTION FLATTENING
// ============================================================================

/**
 * Flatten sections structure into linear array of slides
 * Inserts section title slide at start of each section
 */
function flattenSections(sections) {
  const flatSlides = [];

  for (const section of sections) {
    // Skip sections without valid swimlane
    if (!section.swimlane) {
      console.warn('[PPT Export v2] Skipping section with no swimlane');
      continue;
    }

    // Add section title slide
    flatSlides.push({
      layout: 'sectionTitle',
      swimlane: section.swimlane,
      sectionTitle: section.sectionTitle || section.swimlane
    });

    // Add all content slides for this section
    if (section.slides && Array.isArray(section.slides) && section.slides.length > 0) {
      flatSlides.push(...section.slides);
    } else {
      console.warn(`[PPT Export v2] Section "${section.swimlane}" has no content slides`);
    }
  }

  return flatSlides;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Generate PowerPoint presentation from slides data
 * @param {Object} slidesData - Slides data with sections array
 * @param {Object} options - Optional metadata overrides
 * @returns {Promise<Buffer>} PowerPoint file as Node buffer
 */
export async function generatePptx(slidesData, options = {}) {
  // Validate input
  if (!slidesData || typeof slidesData !== 'object') {
    throw new Error('Invalid slides data: expected object');
  }

  // Load assets on first call
  loadAssets();

  const pptx = new PptxGenJS();

  // Set metadata
  pptx.author = options.author || 'BIP';
  pptx.company = options.company || 'BIP';
  pptx.title = slidesData.title || 'Presentation';
  pptx.subject = options.subject || 'Generated Presentation';
  pptx.revision = '1';

  // Define custom 16:9 layout
  pptx.defineLayout({
    name: 'CUSTOM_16_9',
    width: SLIDE.WIDTH,
    height: SLIDE.HEIGHT
  });
  pptx.layout = 'CUSTOM_16_9';

  // Get slides array from sections
  let slidesArray = [];
  if (slidesData.sections && Array.isArray(slidesData.sections) && slidesData.sections.length > 0) {
    console.log(`[PPT Export v2] Processing ${slidesData.sections.length} sections`);
    slidesArray = flattenSections(slidesData.sections);
  } else {
    console.warn('[PPT Export v2] No sections found in slides data - generating empty presentation');
  }

  // Warn if no slides
  if (slidesArray.length === 0) {
    console.warn('[PPT Export v2] Warning: No slides to render');
  }

  // Get speaker notes if available
  const speakerNotesData = slidesData.speakerNotes?.slides || [];
  const hasSpeakerNotes = speakerNotesData.length > 0;
  if (hasSpeakerNotes) {
    console.log(`[PPT Export v2] Including speaker notes for ${speakerNotesData.length} slides`);
  }

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
    if (taglineMatches.length === 1) {
      console.warn(`[PPT Export] Using tagline-only match for "${tagline}"`);
      return taglineMatches[0];
    }

    return null;
  };

  // Track current section for speaker notes matching
  let currentSectionName = '';

  // Render each slide
  for (let i = 0; i < slidesArray.length; i++) {
    const slideData = slidesArray[i];
    const slideNumber = i + 1;
    const layout = slideData.layout || 'twoColumn';

    // Track section name for speaker notes matching
    if (layout === 'sectionTitle') {
      currentSectionName = slideData.swimlane || '';
    }

    // Find speaker notes for this slide
    const speakerNotes = findSpeakerNotes(slideData, currentSectionName);

    console.log(`[PPT Export v2] Rendering slide ${slideNumber}: ${layout}${speakerNotes ? ' (with notes)' : ''}`);

    if (layout === 'sectionTitle') {
      addSectionTitleSlide(pptx, slideData, slideNumber);
    } else if (layout === 'threeColumn') {
      addThreeColumnSlide(pptx, slideData, slideNumber, speakerNotes);
    } else {
      addTwoColumnSlide(pptx, slideData, slideNumber, speakerNotes);
    }
  }

  console.log(`[PPT Export v2] Generated ${slidesArray.length} slides${hasSpeakerNotes ? ' with speaker notes' : ''}`);

  // Export as buffer
  return await pptx.write({ outputType: 'nodebuffer' });
}

export default { generatePptx };
