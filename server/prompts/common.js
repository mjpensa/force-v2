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

/**
 * Narrative position enum values used across speaker notes schemas and prompts.
 * @type {string[]}
 */
export const NARRATIVE_POSITIONS = ["opening_hook", "context_setting", "evidence_building", "insight_reveal", "implication", "call_to_action"];

/**
 * Returns source extraction instructions for prompt injection.
 * @param {'full'|'compact'|'minimal'} variant
 *   - 'full': Categories + citation patterns + anti-patterns (slides)
 *   - 'compact': Categories + fallback (document)
 *   - 'minimal': Short enforcement rules (speaker notes)
 * @returns {string}
 */
export function getSourceExtractionRules(variant = 'full') {
  if (variant === 'minimal') {
    return `SOURCE CITATION RULES:
- Extract REAL source names from research (reports, filings, publications) — NEVER cite uploaded filenames
- Cite explicitly: "According to [Source]...", "[Report Name] reveals..."
- NEVER use vague attribution: "Sources indicate...", "Reports suggest..."
- If truly unnamed, use descriptive type: "Internal benchmarking analysis" or "Industry consortium survey"`;
  }

  const categories = `AUTHORITATIVE SOURCE CATEGORIES TO EXTRACT:
- Official reports: "Federal Reserve Economic Data Q3 2024", "JPMorgan 2024 Annual Report"
- Research firms: "Gartner Magic Quadrant 2024", "McKinsey Global Institute Study"
- Regulatory filings: "SEC Form 10-K", "CFTC Rule 17a-4 Guidance", "ISDA CDM Specification v3.0"
- Industry publications: "Risk.net Analysis", "Bloomberg Terminal Data"
- Internal sources: "Internal competitive analysis", "Q3 Strategy Review"`;

  if (variant === 'compact') {
    return `SOURCE EXTRACTION (Reference Material):
- Research documents contain references to actual authoritative sources (reports, filings, publications)
- You MUST extract and use these REAL source names, NOT the uploaded filenames
- Look for patterns like: "According to [Source]", "per [Report Name]", "[Organization] reports", citations, footnotes
- Examples of authoritative sources to extract:
  * Official reports: "JPMorgan 2024 Annual Report", "Federal Reserve Economic Data Q3 2024"
  * Research firms: "Gartner Magic Quadrant 2024", "McKinsey Global Institute Study"
  * Regulatory filings: "SEC Form 10-K", "CFTC Rule 17a-4 Guidance"
  * Industry publications: "Risk.net Analysis", "Bloomberg Terminal Data"
  * Academic/standards: "ISDA CDM Specification v3.0", "Basel III Framework"
- If a research document doesn't cite a specific source, use the document's apparent origin (e.g., "Internal Market Analysis" or "Competitive Intelligence Brief")
- NEVER use the uploaded filename (like "research.md" or "data.pdf") as the source`;
  }

  // 'full' variant — categories + citation patterns + anti-patterns (slides)
  return `SOURCE EXTRACTION (CRITICAL - DRIVES CREDIBILITY):
- Research documents contain references to actual authoritative sources (reports, filings, publications)
- You MUST extract and cite these REAL source names in paragraphs, NOT the uploaded filenames
- Cite sources explicitly: "According to [Actual Source Name]..." or "[Report Name] reveals..."

${categories}

CITATION PATTERNS (use these phrases):
- "According to [Source], [fact]..."
- "[Source] reveals [finding]..."
- "The [Report Name] shows [data]..."
- "Per [Organization]'s analysis, [insight]..."

SOURCE CITATION ANTI-PATTERNS (NEVER DO):
- NEVER cite uploaded filenames: "According to research.md..." or "data.pdf shows..."
- NEVER use vague attribution: "Sources indicate...", "Reports suggest...", "Studies show..."
- NEVER use meaningless brackets: "[1]", "[source]", "[citation needed]"
- NEVER omit source entirely: "Costs dropped 40%" without attribution

Look for patterns in research: "According to [Source]", "per [Report]", citations, footnotes, author attributions`;
}

/**
 * Returns a formatted temporal context block for prompt injection.
 * @param {object} dateContext - Result of getCurrentDateContext()
 * @param {'slides'|'document'} variant
 *   - 'slides': Uses quarterPlusTwo as planning horizon (4 lines)
 *   - 'document': Uses nextYear, includes month/year detail and deadline guidance
 * @returns {string}
 */
export function formatDateContext(dateContext, variant = 'slides') {
  if (variant === 'document') {
    return `CURRENT DATE CONTEXT (use for time-appropriate recommendations):
- Today's date: ${dateContext.fullDate} (${dateContext.month} ${dateContext.year})
- Current quarter: ${dateContext.currentQuarter}
- Next quarter: ${dateContext.nextQuarter}
- Next year: ${dateContext.nextYear}

When setting action deadlines in the executiveSummary:
- Use realistic future dates based on today's date
- Near-term actions: ${dateContext.nextQuarter} or ${dateContext.quarterPlusTwo}
- Medium-term milestones: ${dateContext.endOfYear} or Q1-Q2 ${dateContext.nextYear}
- NEVER use past dates or dates that have already occurred
- Ensure deadlines are achievable given the current date`;
  }

  // 'slides' variant
  return `TEMPORAL CONTEXT (for time-aware framing):
- Today's date: ${dateContext.fullDate}
- Current quarter: ${dateContext.currentQuarter}
- Next quarter: ${dateContext.nextQuarter}
- Planning horizon: ${dateContext.quarterPlusTwo}`;
}
