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
      type: "string",
      description: "2-3 sentence overview: key finding + recommended action for time-pressed executives"
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

STRUCTURE:
- executiveSummary: 2-3 sentences - the 30-second version with key finding + recommended action
- 4-6 sections covering: situation analysis, implications, risks, recommendations
- Each section: insight-driven heading, key takeaway, supporting evidence, 2-4 focused paragraphs
- keyInsight: Single sentence with the most important point from that section
- supportingEvidence: 2-4 citations per section linking claims to research quotes

OUTPUT FORMAT:
{
  "title": "Insight-driven title that signals the core finding",
  "executiveSummary": "2-3 sentences: the 30-second version with key finding + recommended action",
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
 * Generate prompt with research content
 */
export function generateDocumentPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `${documentPrompt}

REQUEST: ${userPrompt}

RESEARCH:
${researchContent}

Generate the executive summary JSON now. Include executiveSummary and keyInsight for each section.`;
}
