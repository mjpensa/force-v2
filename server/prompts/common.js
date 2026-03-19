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
 * Extracts key statistics, contextual stat sentences, and authoritative sources from research content.
 * Used by both slides and document prompt generators for evidence injection.
 * @param {string} content - Combined research content
 * @returns {{ stats: string, contextualStats: string[], sources: string[] }}
 */
export function extractKeyStats(content) {
  if (!content) return { stats: '', sources: [], contextualStats: [] };
  const statPatterns = [
    /\d+\.?\d*\s*%/g,                          // Percentages: 23%, 4.5%
    /\$\d[\d,]*\.?\d*\s*[MBK]?(?:illion)?/gi,  // Currency: $4M, $2.5 billion
    /\d+x\b/gi,                                // Multipliers: 3x, 10x
    /\d{1,3}(?:,\d{3})+/g,                     // Large numbers with commas: 1,000,000
    /\b\d{4,}\b/g,                             // Plain large numbers: 50000, 100000
    /Q[1-4]\s*20\d{2}/gi,                      // Quarters: Q3 2024
    /\b20\d{2}\b/g,                            // Years: 2024, 2025 (word boundary)
    /\d+\s*bps\b/gi,                           // Basis points: 150 bps, 25bps
    /\b\d+:1\b/g,                              // Ratios: 3:1, 10:1
    /\d+\s*(?:months?|years?|days?|weeks?)\b/gi // Durations: 18 months, 3 years
  ];
  const sourcePatterns = [
    /according to ([^,.\n]+)/gi,
    /per ([^,.\n]+(?:report|study|analysis|survey|data)[^,.\n]*)/gi,
    /([A-Z][a-zA-Z]+ (?:Q[1-4] )?\d{4} (?:Annual |Quarterly )?Report)/g,
    /((?:Gartner|McKinsey|Forrester|Deloitte|BCG|Bain|Bloomberg|Reuters|ISDA|Federal Reserve)[^,.\n]{0,50})/gi,
    /\[([^\]]+(?:Report|Study|Analysis|Survey|Data)[^\]]*)\]/gi,
    /(?:published by|released by) ([^,.\n]+)/gi
  ];
  const sentences = content.split(/(?<=[.!?])\s+/);
  const contextualStats = [];
  const seenSentences = new Set();

  for (const sentence of sentences) {
    if (seenSentences.has(sentence) || sentence.length < 20 || sentence.length > 300) continue;

    for (const pattern of statPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(sentence)) {
        contextualStats.push(sentence.trim());
        seenSentences.add(sentence);
        break;
      }
    }
    if (contextualStats.length >= 15) break;
  }
  const rawMatches = new Set();
  for (const pattern of statPatterns) {
    pattern.lastIndex = 0;
    const found = content.match(pattern) || [];
    found.slice(0, 5).forEach(m => rawMatches.add(m.trim()));
  }
  const sources = new Set();
  for (const pattern of sourcePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null && sources.size < 15) {
      const source = match[1]?.trim();
      if (source && source.length > 5 && source.length < 100) {
        const lowerSource = source.toLowerCase();
        if (!lowerSource.includes('this') &&
            !lowerSource.includes('that') &&
            !lowerSource.includes('which') &&
            !lowerSource.startsWith('the ')) {
          sources.add(source);
        }
      }
    }
  }

  return {
    stats: Array.from(rawMatches).slice(0, 15).join(', '),
    sources: Array.from(sources).slice(0, 15),
    contextualStats: contextualStats.slice(0, 15)
  };
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
