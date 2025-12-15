/**
 * Document Generation Prompt - Enhanced but Stable
 *
 * Balanced approach: Adds executiveSummary and keyInsight without
 * the complex nested content blocks that caused repetition issues.
 */

/**
 * Document Schema - Enhanced with executive summary and key insights
 * Keeps simple paragraphs array (no complex content block types)
 */
export const documentSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Compelling document title that signals the core insight"
    },
    executiveSummary: {
      type: "object",
      properties: {
        situation: {
          type: "string",
          description: "Current competitive reality - what HAS happened or IS happening. Specific facts with numbers. (e.g., 'JPMorgan deployed CDM in Q4 2024, cutting reconciliation costs 50%')"
        },
        insight: {
          type: "string",
          description: "The 'so what' - quantified impact to THIS organization. Dollar amount or percentage at risk. (e.g., 'Each quarter of delay costs $2.3M in manual reconciliation and exposes the firm to DRR non-compliance penalties')"
        },
        action: {
          type: "string",
          description: "Single clear directive: [Role] [verb] [object] by [date]. Max 12 words. (e.g., 'CTO greenlight CDM pilot by Q2 2025')"
        },
        source: {
          type: "string",
          description: "Primary source filename for the key data point (e.g., 'jpm-analysis.md')"
        }
      },
      required: ["situation", "insight", "action", "source"],
      description: "Structured executive summary: Situation (what is) → Insight (so what) → Action (now what)"
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: {
            type: "string",
            description: "Section heading - lead with insight, not topic label"
          },
          keyInsight: {
            type: "string",
            description: "Single most important takeaway from this section"
          },
          supportingEvidence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                claim: {
                  type: "string",
                  description: "The specific assertion being made"
                },
                quote: {
                  type: "string",
                  description: "Direct quote from research supporting the claim"
                },
                source: {
                  type: "string",
                  description: "Source filename (e.g., 'market-analysis.pdf')"
                }
              },
              required: ["claim", "quote", "source"]
            },
            description: "2-4 evidence citations per section linking claims to research"
          },
          paragraphs: {
            type: "array",
            items: { type: "string" },
            description: "Section paragraphs - keep each paragraph 2-4 sentences, evidence-backed"
          }
        },
        required: ["heading", "paragraphs"]
      },
      description: "4-6 document sections"
    }
  },
  required: ["title", "executiveSummary", "sections"]
};

/**
 * Enhanced prompt with analytical rigor and narrative energy
 */
export const documentPrompt = `You are a senior strategy consultant writing an executive briefing for C-suite leadership.

ANALYTICAL RIGOR:
- Follow the Evidence → Insight → Implication chain for every major claim
- Each section must contain at least 2 specific data points extracted from research
- Explicitly cite sources: "According to [filename]..." or "[filename] reveals..."
- Quantify impact: use percentages, dollar amounts, timeframes - never "significant" or "substantial"
- Address the strongest counterargument or risk in your recommendations
- Distinguish between correlation and causation
- Every claim must trace directly to provided research

NARRATIVE ENERGY:
- Open with tension, paradox, or high-stakes framing - NEVER "This report analyzes..." or "This document provides..."
- First sentence must create urgency or intrigue
- Vary sentence rhythm: follow complex sentences with short punchy ones
- Use contrast and juxtaposition: "While X suggests..., Y reveals..."
- Deploy the "So what?" escalation - each paragraph should raise stakes
- End sections with forward momentum pointing to implications, not backward summary
- Use active constructions: "Revenue collapsed 40%" not "There was a 40% decline in revenue"
- Lead with insights, not topic labels (BAD: "Overview" → GOOD: "Market Window Closes Q3")

ANTI-PATTERNS TO AVOID:
- Generic openings ("In today's business environment...", "This report provides...")
- Weasel words ("significant", "substantial", "considerable", "various")
- Passive voice burying the actor
- Topic-label headings ("Overview", "Background", "Analysis")
- Concluding paragraphs that merely restate what was said

EXECUTIVE SUMMARY - SITUATION → INSIGHT → ACTION FLOW:

The executive summary must follow a strict causal chain:
1. SITUATION: What HAS happened or IS happening (competitor action, market shift, regulatory change)
   - State facts, not risks. Use past/present tense.
   - Include specific numbers from research.
   - Example: "JPMorgan deployed ISDA CDM in Q4 2024, achieving 50% reduction in reconciliation costs."

2. INSIGHT: The 'so what' for THIS organization (quantified impact)
   - Translate the situation into dollars/percentage at stake for the reader's firm.
   - Be specific: "$X at risk" or "Y% cost disadvantage" - not vague "operational inefficiency"
   - Example: "Each quarter of delay widens the cost gap by $2.3M and risks DRR non-compliance penalties starting Q1 2026."

3. ACTION: Single clear directive (max 12 words)
   - Format: [Role] [verb] [object] by [date]
   - One action only. No compound sentences. No rationale.
   - Example: "CTO greenlight CDM pilot by Q2 2025."

EXECUTIVE SUMMARY ANTI-PATTERNS (NEVER do these):
- NEVER say what is "unknown", "unclear", or "uncertain" - only state what IS known
- NEVER use "undermines", "exposes to risk", or other vague threat language without specific $ amounts
- NEVER use bureaucratic phrasing ("must publicly commit to", "should prioritize")
- NEVER combine multiple actions or add rationale to the action field
- NEVER include inline citations like [filename.md] in prose - use the separate source field
- NEVER use passive voice ("implementation status remains unknown")
- NEVER start with "This analysis..." or "This report..."

EXECUTIVE SUMMARY EXAMPLES:

BAD:
situation: "Undermines operational efficiency and exposes the firm to mounting regulatory risk"
insight: "Competitors are already locking in cost reductions by adopting industry-standard data models"
action: "Chief Technology Officer (CTO) must publicly commit to a CDM/DRR production timeline by Q2 2026, prioritizing derivatives reporting over general digital transformation projects to mitigate competitive and compliance risk."

WHY IT'S BAD: Situation is vague (no specific event). Insight talks about competitors, not THIS firm's $ impact. Action is 35 words with bureaucratic language and embedded rationale.

GOOD:
situation: "JPMorgan deployed ISDA CDM for derivatives reporting in Q4 2024, cutting reconciliation time 60% and positioning for automated DRR compliance."
insight: "Bank of America's manual processes now cost $2.3M more per quarter than JPMorgan's, with the gap widening 15% annually."
action: "CTO approve CDM pilot by Q2 2025."
source: "jpm-competitive-analysis.md"

WHY IT'S GOOD: Situation states a specific fact. Insight quantifies THIS firm's disadvantage in dollars. Action is 6 words with clear owner/deadline.

STRUCTURE:
- executiveSummary: Object with situation (fact), insight ($ impact), action (directive), source (filename)
- 4-6 sections covering: situation analysis, implications, risks, recommendations
- Each section: insight-driven heading, key takeaway, supporting evidence, 2-4 focused paragraphs
- keyInsight: Single sentence with the most important point from that section
- supportingEvidence: 2-4 citations per section linking claims to research quotes

OUTPUT FORMAT:
{
  "title": "Insight-driven title that signals the core finding",
  "executiveSummary": {
    "situation": "Specific fact about what has happened or is happening (with numbers)",
    "insight": "Quantified impact to THIS organization in dollars or percentage",
    "action": "[Role] [verb] [object] by [date] - max 12 words",
    "source": "primary-source-filename.ext"
  },
  "sections": [
    {
      "heading": "Insight-led heading (not topic label)",
      "keyInsight": "Single most important takeaway from this section",
      "supportingEvidence": [
        {"claim": "Specific assertion made", "quote": "Direct quote from research", "source": "filename.ext"}
      ],
      "paragraphs": ["paragraph 1", "paragraph 2"]
    }
  ]
}`;

/**
 * Extract key statistics from research content for prompt enhancement
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

  // Return top 15 unique stats
  return Array.from(matches).slice(0, 15).join(', ');
}

/**
 * Generate prompt with research content
 */
export function generateDocumentPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  const keyStats = extractKeyStats(researchContent);

  return `${documentPrompt}

KEY DATA POINTS EXTRACTED FROM RESEARCH (use at least one in executiveSummary.stakes or executiveSummary.keyFinding):
${keyStats || 'No specific statistics found - extract key numbers from the research text'}

REQUEST: ${userPrompt}

RESEARCH:
${researchContent}

Generate the document JSON now. The executiveSummary MUST reference specific data from the research.`;
}
