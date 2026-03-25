/**
 * Shared text processing utilities for acronym handling, sentence casing,
 * and text normalization. Used by both frontend (SlidesView) and server (PPTX export).
 * Single source of truth — replaces duplicate implementations in text.js and ppt-export-service-v2.js.
 */

// Merged acronym lists (union of all three prior sources: frontend text.js, PPTX service, prompts/common.js)
export const ACRONYMS_UPPER = [
  'CDM', 'DRR', 'API', 'APIS', 'ROI', 'KPI', 'KPIS', 'CEO', 'CTO', 'CFO',
  'COO', 'CIO', 'AI', 'ML', 'US', 'UK', 'EU', 'UN', 'CFTC', 'SEC',
  'FDA', 'EPA', 'UTI', 'UPI', 'ESG', 'DEI', 'IPO', 'ETF', 'ETL', 'GDP',
  'B2B', 'B2C', 'P2P', 'AWS', 'GCP', 'IT', 'HR', 'PR', 'CPMI', 'IOSCO',
  'OTC', 'FX', 'USD', 'EUR', 'GBP', 'CRM', 'ERP', 'ISDA', 'LEI', 'EMIR',
  'SFTR', 'NFA', 'FINRA', 'OCC', 'DTCC', 'SWIFT', 'ISO', 'XML', 'JSON',
  'REST', 'SDK', 'DLT', 'BSA', 'AML', 'FINOS', 'UI', 'UX', 'SQL', 'NFT',
  'DAO', 'LLM', 'KYC', 'FCA', 'GDPR', 'M&A', 'R&D', 'P&L'
];

export const ACRONYMS_MIXED = {
  'fpml': 'FpML', 'saas': 'SaaS', 'paas': 'PaaS', 'iaas': 'IaaS',
  'regtech': 'RegTech', 'fintech': 'FinTech', 'insurtech': 'InsurTech',
  'suptech': 'SupTech', 'proptech': 'PropTech', 'defi': 'DeFi',
  'tradfi': 'TradFi', 'devops': 'DevOps', 'mifid': 'MiFID', 'genai': 'GenAI',
  'u.s.': 'U.S.', 'u.k.': 'U.K.', 'e.u.': 'E.U.'
};

export const COMPANY_NAMES = {
  'jpmorgan': 'JPMorgan', 'jpm': 'JPM'
};

/**
 * Check if a word is a known acronym and return its correct form.
 * Handles trailing punctuation (strips before lookup, reattaches after).
 * @param {string} word
 * @returns {string|null} Correct form or null if not an acronym
 */
export function checkAcronym(word) {
  if (!word) return null;

  // Strip trailing punctuation for lookup
  const punctMatch = word.match(/([.:,;!?]+)$/);
  const punct = punctMatch ? punctMatch[1] : '';
  const clean = punct ? word.slice(0, -punct.length) : word;
  const lower = clean.toLowerCase();

  // Check mixed-case dictionary first
  if (ACRONYMS_MIXED[lower]) return ACRONYMS_MIXED[lower] + punct;

  // Check company names
  if (COMPANY_NAMES[lower]) return COMPANY_NAMES[lower] + punct;

  // Handle slash compounds (e.g., "API/SDK")
  if (clean.includes('/')) {
    const parts = clean.split('/');
    const corrected = parts.map(p => checkAcronym(p) || p).join('/');
    return corrected + punct;
  }

  // Check upper-case acronym list
  const upper = clean.toUpperCase();
  if (ACRONYMS_UPPER.includes(upper)) return upper + punct;

  // Dynamic fallback: 2-5 char all-caps words
  if (/^[A-Z][A-Z0-9]{1,4}$/.test(clean)) return clean + punct;

  return null;
}

/**
 * Convert text to sentence case while preserving acronyms.
 * Processes each line independently (preserves newlines for multi-line titles).
 * @param {string} text
 * @returns {string}
 */
export function toSentenceCase(text) {
  if (!text) return '';
  return text.split('\n').map(line => {
    const words = line.split(/\s+/);
    return words.map((word, index) => {
      const acronymForm = checkAcronym(word);
      if (acronymForm) return acronymForm;
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    }).join(' ');
  }).join('\n');
}

/**
 * Normalize body text by fixing acronym capitalization.
 * Finds 3+ letter all-caps words and corrects them.
 * @param {string} text
 * @returns {string}
 */
export function normalizeBodyText(text) {
  if (!text) return '';
  return text.replace(/\b([A-Z]{3,})\b/g, (match) => {
    return checkAcronym(match) || match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
}

/**
 * Strip markdown formatting and normalize text.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_{2,}/g, ' ')
    .replace(/([a-z])_([a-z])/gi, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncate text to a maximum character count, breaking at sentence boundaries.
 * @param {string} text
 * @param {number} [maxChars=400]
 * @returns {string}
 */
export function truncateToSentence(text, maxChars = 400) {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxChars) return trimmed;
  const truncated = trimmed.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);
  if (lastSentenceEnd > maxChars * 0.6) {
    return trimmed.substring(0, lastSentenceEnd + 1);
  }
  return truncated.replace(/\s+\S*$/, '') + '.';
}

// --- PPTX-specific helpers (used by ppt-export-service-v2.js) ---

/**
 * Enforce 3-4 line count for slide titles by merging short lines.
 * @param {string} title
 * @param {number} [maxLines=4]
 * @returns {string}
 */
export function enforceTitleLineCount(title, maxLines = 4) {
  if (!title) return '';
  let lines = title.split('\n').map(l => l.trim()).filter(l => l);
  while (lines.length > maxLines && lines.length > 1) {
    let shortestIdx = 0;
    let shortestLen = Infinity;
    for (let i = 0; i < lines.length - 1; i++) {
      const combinedLen = lines[i].length + lines[i + 1].length;
      if (combinedLen < shortestLen) {
        shortestLen = combinedLen;
        shortestIdx = i;
      }
    }
    lines[shortestIdx] = lines[shortestIdx] + ' ' + lines[shortestIdx + 1];
    lines.splice(shortestIdx + 1, 1);
  }
  return lines.join('\n');
}

/**
 * Format a slide title: sentence case + enforce line count.
 * @param {string} title
 * @param {number} [maxLines=4]
 * @returns {string}
 */
export function formatTitle(title, maxLines = 4) {
  return enforceTitleLineCount(toSentenceCase(title), maxLines);
}

/**
 * Format a section title: apply acronym corrections without case conversion.
 * @param {string} title
 * @returns {string}
 */
export function formatSectionTitle(title) {
  if (!title) return '';
  return title.replace(/\b([A-Za-z][A-Za-z.&]+)\b/g, (match) => {
    return checkAcronym(match) || match;
  });
}

/**
 * Format body text: normalize + truncate two paragraphs.
 * @param {string} p1
 * @param {string} p2
 * @param {number} [maxChars=800]
 * @returns {string}
 */
export function formatBody(p1, p2, maxChars = 800) {
  const parts = [p1, p2].filter(Boolean).map(p =>
    truncateToSentence(normalizeBodyText(p), Math.floor(maxChars / 2))
  );
  return parts.join('\n');
}
