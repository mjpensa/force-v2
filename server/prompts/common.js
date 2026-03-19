/**
 * Shared utilities for prompt generation modules.
 * Extracted from document.js and slides.js to eliminate duplication.
 */

/**
 * Returns temporal context for time-aware prompt generation.
 * Used by document and slides generators for deadline framing.
 * @returns {{ fullDate: string, month: string, year: number, currentQuarter: string, nextQuarter: string, quarterPlusTwo: string, endOfYear: string, nextYear: number }}
 */
export function getCurrentDateContext() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-indexed
  const quarter = Math.ceil(month / 3);
  const nextQuarter = quarter === 4 ? 1 : quarter + 1;
  const nextQuarterYear = quarter === 4 ? year + 1 : year;

  return {
    fullDate: now.toISOString().split('T')[0], // YYYY-MM-DD
    month: now.toLocaleString('en-US', { month: 'long' }),
    year,
    currentQuarter: `Q${quarter} ${year}`,
    nextQuarter: `Q${nextQuarter} ${nextQuarterYear}`,
    quarterPlusTwo: `Q${((quarter + 1) % 4) + 1} ${quarter >= 3 ? year + 1 : year}`,
    endOfYear: `Q4 ${year}`,
    nextYear: year + 1
  };
}

/**
 * Assembles research files into a formatted string for prompt injection.
 * Each file is wrapped with === filename === delimiters.
 * @param {Array<{filename: string, content: string}>} researchFiles
 * @returns {string}
 */
export function assembleResearchContent(researchFiles) {
  return researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');
}

/**
 * Returns acronym capitalization rules for prompt injection.
 * @param {boolean} [short=false] - If true, returns compact version (outline prompts). If false, returns full version with tagline rules.
 * @returns {string}
 */
export function getAcronymRules(short = false) {
  const base = `ALL CAPS acronyms:
- Tech: API, SDK, UI, UX, AI, ML, REST, SQL, JSON, XML, ETL, AWS, GCP, DLT, NFT, DAO, LLM
- Finance: CDM, CRM, DRR, ROI, KPI, ESG, AML, KYC, OTC, ISDA, EMIR, MiFID, CFTC, SEC, FCA, GDPR
- General: B2B, P2P, M&A, IPO

MIXED CASE acronyms (preserve exact capitalization):
- FpML, SaaS, PaaS, IaaS, RegTech, FinTech, InsurTech, SupTech, PropTech, DeFi, TradFi, DevOps, GenAI

CAPITALIZATION RULES:
- NEVER alter acronym capitalization: "fpml" or "Fpml" is WRONG, "FpML" is CORRECT
- "saas" or "SAAS" is WRONG, "SaaS" is CORRECT
- "cdm" or "Cdm" is WRONG, "CDM" is CORRECT`;

  if (short) {
    return base;
  }

  return `${base}
- NEVER split acronyms across lines in titles

TAGLINE EXCEPTION: In taglines, mixed-case acronyms keep their standard form even though surrounding text is uppercase
- WRONG: "SAAS MIGRATION" - SAAS is incorrect
- CORRECT: "SaaS MIGRATION" - SaaS keeps standard capitalization
- CORRECT: "CDM ADOPTION" - CDM is already all caps

FALLBACK RULE: For acronyms not listed above, preserve capitalization exactly as found in research documents`;
}

/**
 * Validates prompt inputs common to slide generation functions.
 * Throws descriptive errors on invalid input.
 * @param {string} userPrompt
 * @param {Array<{filename: string, content: string}>} researchFiles
 * @param {string} [context='generation'] - Context string for error messages (e.g. 'slide generation', 'outline generation')
 * @returns {Array<{filename: string, content: string}>} Filtered array of valid files
 */
export function validatePromptInputs(userPrompt, researchFiles, context = 'generation') {
  if (!userPrompt || userPrompt.trim() === '') {
    throw new Error(`userPrompt is required for ${context}`);
  }
  if (!researchFiles || researchFiles.length === 0) {
    throw new Error(`At least one research file is required for ${context}`);
  }
  const validFiles = researchFiles.filter(file => {
    if (!file || typeof file.filename !== 'string' || typeof file.content !== 'string') {
      return false;
    }
    return file.content.trim().length > 0;
  });

  if (validFiles.length === 0) {
    throw new Error(`At least one research file with content is required for ${context}`);
  }

  return validFiles;
}
