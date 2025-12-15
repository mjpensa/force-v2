/**
 * Slide Schema - Two layouts supported:
 * - twoColumn: tagline + title (left), 2 paragraphs (right)
 * - threeColumn: tagline + title (left), 3 columns below
 */
export const slidesSchema = {
  description: "Presentation slides with layout options",
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Title of the presentation",
      nullable: false
    },
    slides: {
      type: "array",
      description: "Array of slides",
      items: {
        type: "object",
        properties: {
          layout: {
            type: "string",
            enum: ["twoColumn", "threeColumn"],
            description: "Slide layout: 'twoColumn' (2 paragraphs right) or 'threeColumn' (3 columns below)"
          },
          tagline: {
            type: "string",
            description: "2-word uppercase tagline, max 21 characters (e.g. 'EXECUTIVE SUMMARY')",
            nullable: false
          },
          title: {
            type: "string",
            description: "EXACTLY 4 lines separated by \\n. Format: 'Line1\\nLine2\\nLine3\\nLine4'. Each line max 10 chars. MUST have exactly 3 newline characters.",
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
          }
        },
        required: ["tagline", "title", "paragraph1", "paragraph2"]
      }
    }
  },
  required: ["title", "slides"]
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
    /\d{1,3}(?:,\d{3})+/g,                     // Large numbers: 1,000,000
    /Q[1-4]\s*20\d{2}/gi,                      // Quarters: Q3 2024
    /20\d{2}/g                                 // Years: 2024, 2025
  ];

  const matches = new Set();
  for (const pattern of patterns) {
    const found = content.match(pattern) || [];
    found.slice(0, 5).forEach(m => matches.add(m.trim()));
  }

  return Array.from(matches).slice(0, 15).join(', ');
}

/**
 * Generate prompt for slides with research content
 * AI automatically chooses the best layout (twoColumn or threeColumn) for each slide
 * @param {string} userPrompt - The user's request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @returns {string} Complete prompt for AI
 */
export function generateSlidesPrompt(userPrompt, researchFiles) {
  // Convert array to formatted string (consistent with other generators)
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  // Extract key statistics to force AI to use real data
  const keyStats = extractKeyStats(researchContent);

  return `You are creating presentation slides with STRICT formatting requirements.

TWO LAYOUT OPTIONS - Choose the best layout for each slide:

LAYOUT 1: "twoColumn" (default) - Use for focused topics, executive summaries, key findings
- Fields: tagline, title, paragraph1, paragraph2
- paragraph1 and paragraph2: EXACTLY 380-410 characters each
- Omit the "layout" field (defaults to twoColumn)

LAYOUT 2: "threeColumn" - Use for comparisons, multiple related points, detailed breakdowns
- Fields: layout, tagline, title, paragraph1, paragraph2, paragraph3
- MUST include: layout: "threeColumn"
- paragraph1, paragraph2, paragraph3: EXACTLY 370-390 characters each

WHEN TO USE EACH LAYOUT:
- twoColumn: Introduction, conclusion, single-topic deep dives, executive summaries
- threeColumn: Comparing options, listing multiple benefits/features, process steps, before/during/after

COMMON RULES FOR ALL SLIDES:

TAGLINE: 2-word uppercase label, MAX 21 characters. Example: "EXECUTIVE SUMMARY"

TITLE RULES (CRITICAL - MUST BE EXACTLY 4 LINES):
- Pattern: "Line1\\nLine2\\nLine3\\nLine4" - exactly 3 newlines, 4 lines
- Each line: 1-2 words, MAX 10 characters per line
- AVOID letters g, y, p, q, j on lines 1-3 (descenders overlap next line)
- Line 4 can use any letters
- Example: "Driving\\nModern\\nBusiness\\nForward"

PARAGRAPH REQUIREMENTS (CRITICAL):
- Each paragraph must be a complete thought ending with a period
- Count characters carefully before finalizing each paragraph
- twoColumn paragraphs: 380-410 characters each
- threeColumn paragraphs: 370-390 characters each

ANALYTICAL RIGOR (CRITICAL):
- Each paragraph MUST contain at least ONE specific data point from research
- Cite sources explicitly: "[filename] reveals..." or "According to [filename]..."
- Quantify all claims: use percentages, dollar amounts, timeframes
- NEVER use vague terms: "significant", "substantial", "considerable", "various"
- Follow the chain: Evidence → Insight → Implication

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

Generate JSON with "title" (string) and "slides" array. Mix layouts as appropriate:
- twoColumn slide: {tagline, title, paragraph1, paragraph2}
- threeColumn slide: {layout: "threeColumn", tagline, title, paragraph1, paragraph2, paragraph3}
`;
}
