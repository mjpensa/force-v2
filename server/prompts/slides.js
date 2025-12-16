/**
 * Slide Schema - Organized by sections (aligned with Gantt chart swimlanes)
 * Each section contains:
 * - A section title slide
 * - Multiple content slides (twoColumn or threeColumn layouts)
 */

// Schema for individual content slides
const contentSlideSchema = {
  type: "object",
  properties: {
    layout: {
      type: "string",
      enum: ["twoColumn", "threeColumn"],
      description: "Slide layout: 'twoColumn' (2 paragraphs right) or 'threeColumn' (3 columns below)"
    },
    tagline: {
      type: "string",
      description: "2-word uppercase tagline, max 21 characters (e.g. 'MARGIN EROSION')",
      nullable: false
    },
    title: {
      type: "string",
      description: "STRICT: EXACTLY 3 or 4 lines total (count the \\n separators - must be 2 or 3). FORBIDDEN: 5+ lines will break layout. Combine short words to reduce line count. twoColumn: max 10 chars/line. threeColumn: max 18 chars/line.",
      nullable: false
    },
    paragraph1: {
      type: "string",
      description: "First paragraph. 380-410 chars for twoColumn, 370-390 chars for threeColumn.",
      nullable: false
    },
    paragraph2: {
      type: "string",
      description: "Second paragraph. 380-410 chars for twoColumn, 370-390 chars for threeColumn.",
      nullable: false
    },
    paragraph3: {
      type: "string",
      description: "Third paragraph (threeColumn only). 370-390 characters.",
      nullable: true
    },
    subTopic: {
      type: "string",
      description: "A 2-5 word sub-topic identifier for this slide within the section (e.g., 'Cost Analysis', 'Implementation Timeline', 'Risk Assessment'). Used for TOC navigation. Must be distinct within each section - NO DUPLICATES.",
      nullable: false
    }
  },
  required: ["layout", "tagline", "title", "paragraph1", "paragraph2", "subTopic"]
};

// Main schema with sections structure
export const slidesSchema = {
  description: "Presentation slides organized by sections (aligned with Gantt chart swimlanes)",
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Title of the presentation",
      nullable: false
    },
    sections: {
      type: "array",
      description: "Array of sections, each aligned with a Gantt chart swimlane topic",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          swimlane: {
            type: "string",
            description: "The swimlane/topic name from the Gantt chart",
            nullable: false
          },
          sectionTitle: {
            type: "string",
            description: "A compelling 2-4 word section title for the title slide, max 30 characters (can differ from swimlane name)",
            nullable: false
          },
          slides: {
            type: "array",
            description: "Content slides for this section (minimum 1 slide per section)",
            items: contentSlideSchema,
            minItems: 1
          }
        },
        required: ["swimlane", "sectionTitle", "slides"]
      }
    }
  },
  required: ["title", "sections"]
};

/**
 * Extract key statistics from research content for prompt enhancement
 * Forces AI to use real data points from research
 * @param {string} content - Combined research content
 * @returns {string} - Comma-separated list of key data points
 */
function extractKeyStats(content) {
  if (!content) return '';

  const patterns = [
    /\d+\.?\d*\s*%/g,                          // Percentages: 23%, 4.5%
    /\$\d[\d,]*\.?\d*\s*[MBK]?(?:illion)?/gi,  // Currency: $4M, $2.5 billion
    /\d+x\b/gi,                                // Multipliers: 3x, 10x
    /\d{1,3}(?:,\d{3})+/g,                     // Large numbers with commas: 1,000,000
    /\b\d{4,}\b/g,                             // Plain large numbers: 50000, 100000
    /Q[1-4]\s*20\d{2}/gi,                      // Quarters: Q3 2024
    /\b20\d{2}\b/g,                            // Years: 2024, 2025 (word boundary)
    /\d+\s*bps\b/gi,                           // Basis points: 150 bps, 25bps
    /\b\d+:1\b/g,                               // Ratios: 3:1, 10:1 (X:1 format only, avoids times)
    /\d+\s*(?:months?|years?|days?|weeks?)\b/gi // Durations: 18 months, 3 years
  ];

  const matches = new Set();
  for (const pattern of patterns) {
    const found = content.match(pattern) || [];
    found.slice(0, 5).forEach(m => matches.add(m.trim()));
  }

  return Array.from(matches).slice(0, 15).join(', ');
}

/**
 * Generate prompt for slides with research content, organized by swimlane sections
 * AI creates multiple slides per swimlane topic, summarizing research for each
 * @param {string} userPrompt - The user's request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @param {Array<{name: string, entity: string, taskCount: number}>} swimlanes - Swimlane topics from Gantt chart
 * @returns {string} Complete prompt for AI
 */
export function generateSlidesPrompt(userPrompt, researchFiles, swimlanes = []) {
  // Validate inputs
  if (!userPrompt || userPrompt.trim() === '') {
    throw new Error('userPrompt is required for slide generation');
  }
  if (!researchFiles || researchFiles.length === 0) {
    throw new Error('At least one research file is required for slide generation');
  }

  // Validate and filter research files
  const validFiles = researchFiles.filter(file => {
    if (!file || typeof file.filename !== 'string' || typeof file.content !== 'string') {
      return false; // Skip malformed file objects
    }
    return file.content.trim().length > 0; // Skip empty content
  });

  if (validFiles.length === 0) {
    throw new Error('At least one research file with content is required for slide generation');
  }

  // Validate swimlane objects if provided
  if (swimlanes && swimlanes.length > 0) {
    const invalidSwimlane = swimlanes.find(s => !s || typeof s.name !== 'string' || typeof s.taskCount !== 'number');
    if (invalidSwimlane) {
      throw new Error('Swimlane objects must have "name" (string) and "taskCount" (number) properties');
    }
  }

  // Convert array to formatted string (consistent with other generators)
  const researchContent = validFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  // Extract key statistics to force AI to use real data
  const keyStats = extractKeyStats(researchContent);

  // Format swimlanes for the prompt
  const swimlaneList = swimlanes.length > 0
    ? swimlanes.map((s, i) => `${i + 1}. "${s.name}" (${s.taskCount} related tasks in roadmap)`).join('\n')
    : null;

  // Build section-specific instructions if swimlanes are provided
  const sectionInstructions = swimlanes.length > 0
    ? `
SECTION STRUCTURE (CRITICAL - FOLLOW EXACTLY):
You MUST create one section for each swimlane topic listed below, IN THE SAME ORDER.
Each section represents a key topic from the project roadmap.

SWIMLANE TOPICS (create sections in this exact order):
${swimlaneList}

FOR EACH SECTION:
1. "swimlane": Use the EXACT swimlane name from the list above
2. "sectionTitle": Create a compelling 2-4 word title (max 30 characters) for the section title slide (can be more engaging than the swimlane name)
3. "slides": Generate content slides summarizing research findings for this topic

SLIDES PER SECTION (EXPANDED COVERAGE - CRITICAL):
- Generate 5-10 slides per section for comprehensive topic coverage
- Each slide MUST focus on a DISTINCT sub-topic within the section
- Sub-topics should form a logical narrative progression:
  * Opening: Context/Background (1-2 slides)
  * Core Analysis: Key findings, data, comparisons (3-5 slides)
  * Implications: Recommendations, next steps, risks (2-3 slides)
- Minimum 5 slides per section with substantial research content
- Maximum 10 slides to maintain focus and avoid repetition

SUB-TOPIC FIELD (REQUIRED FOR EVERY SLIDE):
- The "subTopic" field identifies the specific focus of each slide
- Sub-topics must be distinct within a section - NO DUPLICATES
- Format: 2-5 words, title case (e.g., "Cost Benefit Analysis", "Q3 Timeline", "Vendor Comparison")
- Sub-topics enable slide-level TOC navigation
- Example sub-topics for a "Digital Transformation" section:
  1. "Current State Assessment"
  2. "Technology Gap Analysis"
  3. "Implementation Roadmap"
  4. "Cost Projections"
  5. "Risk Mitigation Strategy"
  6. "Success Metrics"
  7. "Vendor Evaluation"

CONTENT FOCUS:
- Summarize key findings, insights, and implications from research for each topic
- Do NOT copy task-level details from the Gantt chart
- Focus on strategic insights, data points, and recommendations
- Each slide should stand alone with valuable information
`
    : `
SLIDE GENERATION:
Generate a logical sequence of slides covering the key topics from the research.
Aim for 15-30 slides total, organized by theme (5-10 slides per section).

Create sections based on major themes you identify in the research.
Each section should have:
- "swimlane": A topic name you identify from the research
- "sectionTitle": A compelling 2-4 word title (max 30 characters) for that topic
- "slides": 5-10 content slides per section, each with a distinct sub-topic

SUB-TOPIC FIELD (REQUIRED FOR EVERY SLIDE):
- The "subTopic" field identifies the specific focus of each slide
- Sub-topics must be distinct within a section - NO DUPLICATES
- Format: 2-5 words, title case (e.g., "Cost Benefit Analysis", "Risk Assessment")
`;

  return `You are creating presentation slides organized into SECTIONS, with STRICT formatting requirements.

${sectionInstructions}

TWO LAYOUT OPTIONS - You MUST explicitly specify layout for EVERY content slide:

LAYOUT 1: "twoColumn" - Use for focused topics, executive summaries, key findings
- MUST include: layout: "twoColumn"
- Fields: layout, tagline, title, paragraph1, paragraph2
- paragraph1 and paragraph2: EXACTLY 380-410 characters each

LAYOUT 2: "threeColumn" - Use for comparisons, multiple related points, detailed breakdowns
- MUST include: layout: "threeColumn"
- Fields: layout, tagline, title, paragraph1, paragraph2, paragraph3
- paragraph1, paragraph2, paragraph3: EXACTLY 370-390 characters each

LAYOUT SELECTION RULES (CRITICAL - MUST VARY LAYOUTS):
- You MUST use BOTH layouts throughout the presentation for visual variety
- Aim for approximately 40-50% threeColumn slides
- NEVER create a presentation with only one layout type
- twoColumn: Opening slides, conclusions, single-topic deep dives, executive summaries
- threeColumn: Comparisons, multiple benefits/features, process steps, detailed breakdowns, data-heavy topics

COMMON RULES FOR ALL CONTENT SLIDES:

ACRONYMS (CRITICAL - USE EXACT STANDARD CAPITALIZATION IN ALL FIELDS):
Applies to: title, sectionTitle, tagline, paragraph1, paragraph2, paragraph3

ALL CAPS acronyms:
- Tech: API, SDK, UI, UX, AI, ML, REST, SQL, JSON, XML, ETL, AWS, GCP, DLT, NFT, DAO, LLM
- Finance: CDM, CRM, DRR, ROI, KPI, ESG, AML, KYC, OTC, ISDA, EMIR, MiFID, CFTC, SEC, FCA, GDPR
- General: B2B, P2P, M&A, IPO

MIXED CASE acronyms (preserve exact capitalization):
- FpML, SaaS, PaaS, IaaS, RegTech, FinTech, InsurTech, SupTech, PropTech, DeFi, TradFi, DevOps, GenAI

CAPITALIZATION RULES:
- NEVER alter acronym capitalization: "fpml" or "Fpml" is WRONG, "FpML" is CORRECT
- "saas" or "SAAS" is WRONG, "SaaS" is CORRECT
- "cdm" or "Cdm" is WRONG, "CDM" is CORRECT
- NEVER split acronyms across lines in titles

TAGLINE EXCEPTION: In taglines, mixed-case acronyms keep their standard form even though surrounding text is uppercase
- WRONG: "SAAS MIGRATION" - SAAS is incorrect
- CORRECT: "SaaS MIGRATION" - SaaS keeps standard capitalization
- CORRECT: "CDM ADOPTION" - CDM is already all caps

FALLBACK RULE: For acronyms not listed above, preserve capitalization exactly as found in research documents

TAGLINE: 2-word uppercase label, MAX 21 characters. Example: "MARGIN EROSION"

TITLE RULES (CRITICAL - HARD LIMIT: 3 OR 4 LINES ONLY):
!!! STOP AND COUNT: Every title MUST have EXACTLY 2 or 3 \\n separators. NO EXCEPTIONS !!!
- MANDATORY: Count \\n separators BEFORE writing each title. 2 = 3 lines, 3 = 4 lines. NEVER 4+ separators.
- 5+ LINES = REJECTED. 6+ LINES = REJECTED. 7+ LINES = REJECTED. The slide WILL break.
- If your concept has 5+ words, you MUST combine words onto shared lines
- REWRITE titles that are too long - use shorter synonyms, remove unnecessary words
- twoColumn layout: Each line MAX 10 characters - this means 1-2 SHORT words per line only!
- threeColumn layout: Each line MAX 18 characters

TITLE FAILURE EXAMPLES (NEVER DO THIS):
- BAD 7-line: "BSA/AML\\norder\\ndelays\\nstrategic\\ntech\\nadoption\\nroadmap" = 6 separators = BROKEN
  FIXED 4-line: "BSA/AML order\\ndelays tech\\nadoption\\nroadmap" = 3 separators = OK
- BAD 5-line: "Multi-\\njurisdiction\\nDRR rollout\\naccelerates\\nadoption" = 4 separators = BROKEN
  FIXED 4-line: "Global DRR\\nrollout\\naccelerates\\nadoption" = 3 separators = OK
- BAD 5-line: "Unknown\\nstatus\\nwidening\\ntechnology\\ngap" = 4 separators = BROKEN
  FIXED 3-line: "Unknown status\\nwidens tech\\ngap" = 2 separators = OK

TITLE SUCCESS PATTERN:
- 3-line: "Word1\\nWord2\\nWord3" (exactly 2 \\n)
- 4-line: "Line1\\nLine2\\nLine3\\nLine4" (exactly 3 \\n)
- GOOD: "Data\\nFuels\\nDecisions", "Market\\nShare\\nErosion", "CDM cuts\\ncosts by\\n60%"

OTHER TITLE RULES:
- NEVER split a word across lines
- NEVER put short connector words alone (to, a, in, of, for, the, and, or) - combine with adjacent words
- AVOID letters g, y, p, q, j on lines 1-2 for 3-line titles (descenders overlap)
- Last line can use any letters

PARAGRAPH REQUIREMENTS (CRITICAL):
- Each paragraph must be a complete thought ending with a period
- Count characters carefully before finalizing each paragraph
- twoColumn paragraphs: 380-410 characters each
- threeColumn paragraphs: 370-390 characters each

ANALYTICAL RIGOR (CRITICAL):
- Each paragraph MUST contain at least ONE specific data point from research
- Quantify all claims: use percentages, dollar amounts, timeframes
- NEVER use vague terms: "significant", "substantial", "considerable", "various"
- Follow the chain: Evidence → Insight → Implication

SOURCE EXTRACTION (CRITICAL):
- Research documents contain references to actual authoritative sources (reports, filings, publications)
- You MUST extract and cite these REAL source names in paragraphs, NOT the uploaded filenames
- Cite sources explicitly: "According to the [Actual Source Name]..." or "The [Report Name] reveals..."
- Look for patterns in research: "According to [Source]", "per [Report]", citations, footnotes
- Examples of proper citations:
  * "The Federal Reserve Q3 2024 Report reveals margin compression of 23%..."
  * "According to Gartner's Magic Quadrant 2024, cloud adoption reached..."
  * "JPMorgan's Annual Investor Presentation shows CDM reduced costs by 60%..."
- If research doesn't cite a specific source, reference the apparent origin (e.g., "Internal competitive analysis indicates...")
- NEVER cite uploaded filenames like "research.md" or "data.pdf" in paragraph text

NARRATIVE ENERGY (CRITICAL):
- Lead each paragraph with tension, insight, or stakes - not topic introduction
- Use power verbs: Reveals, Threatens, Enables, Erodes, Accelerates, Undermines, Exposes
- Vary sentence rhythm: follow complex sentences with short punchy ones
- Use contrast: "While X suggests..., Y reveals..."
- End paragraphs with forward momentum pointing to implications, not summary
- Use active voice: "Revenue collapsed 40%" not "There was a 40% decline"

ANTI-PATTERNS TO REJECT:
- Opening with: "This slide discusses...", "The following points...", "In this section..."
- Generic statements without data: "Growth has been strong", "Performance improved"
- Weasel words: significant, substantial, considerable, various, many, some, often
- Passive voice hiding the actor: "It was determined that..." → "Analysis reveals..."
- Topic-label taglines: "OVERVIEW", "INTRODUCTION", "SUMMARY", "ANALYSIS"
- Backward-looking conclusions: "In summary, we discussed..." → forward implications

TAGLINE QUALITY:
- Taglines must signal INSIGHT, not topic
- BAD: "EXECUTIVE SUMMARY", "KEY POINTS", "OVERVIEW"
- GOOD: "MARGIN EROSION", "Q3 DEADLINE", "73% CHURN RISK", "COST WINDOW CLOSING"

KEY DATA POINTS FROM RESEARCH (use at least one per slide):
${keyStats || 'Extract specific numbers, percentages, and dates from the research text'}

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

OUTPUT FORMAT (CRITICAL):
- Output ONLY valid JSON - no markdown code fences, no explanatory text before or after
- The response must start with { and end with }

JSON STRUCTURE:
- "title": Presentation title (string)
- "sections": Array of section objects, each with:
  - "swimlane": Topic name (string)
  - "sectionTitle": Compelling section title, max 30 characters (string)
  - "slides": Array of content slides (minimum 1 per section)

Content slide format (layout and subTopic are REQUIRED for all slides):
- twoColumn: {layout: "twoColumn", tagline, title, paragraph1, paragraph2, subTopic}
- threeColumn: {layout: "threeColumn", tagline, title, paragraph1, paragraph2, paragraph3, subTopic}

REMEMBER: Use BOTH layouts - aim for ~40-50% threeColumn slides for visual variety.

FINAL VALIDATION (DO THIS BEFORE OUTPUTTING - MANDATORY):
1. For EVERY title field in your output, COUNT the \\n characters
2. If count > 3, that title has 5+ lines and WILL BREAK the slide - REWRITE IT NOW
3. Rewrite strategy: combine short words, use synonyms, drop unnecessary words
4. VERIFY: Every title must have exactly 2 or 3 \\n separators (3 or 4 lines)
5. Double-check twoColumn titles: each line must be ≤10 characters
`;
}
