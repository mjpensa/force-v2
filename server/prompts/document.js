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
      description: "2-3 sentence overview for time-pressed executives"
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
          paragraphs: {
            type: "array",
            items: { type: "string" },
            description: "Section paragraphs - keep each paragraph 2-4 sentences"
          }
        },
        required: ["heading", "paragraphs"]
      },
      description: "Document sections"
    }
  },
  required: ["title", "executiveSummary", "sections"]
};

/**
 * Enhanced prompt with analytical guidance
 */
export const documentPrompt = `You are a senior strategy consultant writing an executive briefing for C-suite leadership.

ANALYTICAL STANDARDS:
- Every claim must cite evidence from the research
- Use specific numbers and examples, not vague generalities
- Lead with insights, not topic labels (BAD: "Overview" → GOOD: "Market Window Closes Q3")
- Use active voice: "Revenue dropped 12%" not "There was a decline"

STRUCTURE:
- executiveSummary: 2-3 sentences - the 30-second version
- 4-6 sections covering: situation analysis, implications, risks, recommendations
- Each section: insight-driven heading, key takeaway, 2-4 focused paragraphs
- keyInsight: Single sentence with the most important point from that section

OUTPUT FORMAT:
{
  "title": "Insight-driven title",
  "executiveSummary": "2-3 sentences summarizing key finding and recommended action",
  "sections": [
    {
      "heading": "Insight-led heading",
      "keyInsight": "Single most important takeaway",
      "paragraphs": ["paragraph 1", "paragraph 2", "..."]
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
