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
        stakes: {
          type: "string",
          description: "What's at risk? Quantified impact statement (e.g., '$4M revenue at risk', '23% margin erosion'). Start with power verb."
        },
        keyFinding: {
          type: "string",
          description: "Core insight with specific data point from research. Must cite source: '[filename] reveals/shows...'"
        },
        recommendation: {
          type: "string",
          description: "Specific action + owner + timeline (e.g., 'CFO approve $2M pilot by Q2', 'Engineering hire 5 devs by March')"
        }
      },
      required: ["stakes", "keyFinding", "recommendation"],
      description: "Structured executive summary with stakes, key finding, and actionable recommendation"
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

EXECUTIVE SUMMARY FORMULA (mandatory):
Sentence 1: Stakes + Tension - What's at risk if we do nothing? Include quantified impact.
Sentence 2: Key finding with specific data point extracted from research (cite source)
Sentence 3: Recommended action with specific owner/timeline

EXECUTIVE SUMMARY EXAMPLES:

BAD (generic, no data, passive):
"This analysis examines market trends and provides recommendations for improving operational efficiency."

GOOD (stakes, data, action):
"A 23% cost advantage window closes in Q3 as competitors scale production—[competitor-analysis.pdf] shows first-mover margins erode 40% within 18 months. Authorize the $2M Vietnam pilot by March to lock in $12M annual savings before price parity."

BAD (weasel words, no urgency):
"There has been significant growth in the market, and various opportunities exist for substantial improvement."

GOOD (specific, urgent, actionable):
"Customer churn spiked to 18% in Q4—[support-data.xlsx] reveals 73% cite response time. Hire 12 support engineers by February or forfeit $4.2M ARR to competitors already offering 4-hour SLAs."

POWER VERBS FOR OPENING (use one):
Threatens, Reveals, Demands, Enables, Erodes, Accelerates, Undermines, Unlocks, Exposes, Validates

STRUCTURE:
- executiveSummary: Object with stakes (quantified risk), keyFinding (data + source), recommendation (action + owner + timeline)
- 4-6 sections covering: situation analysis, implications, risks, recommendations
- Each section: insight-driven heading, key takeaway, supporting evidence, 2-4 focused paragraphs
- keyInsight: Single sentence with the most important point from that section
- supportingEvidence: 2-4 citations per section linking claims to research quotes

OUTPUT FORMAT:
{
  "title": "Insight-driven title that signals the core finding",
  "executiveSummary": {
    "stakes": "Quantified risk/opportunity starting with power verb (e.g., 'Erodes $4M margin by Q3')",
    "keyFinding": "Key insight with data point and [source.ext] citation",
    "recommendation": "Specific action + owner + timeline (e.g., 'Board approve $2M by March')"
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
