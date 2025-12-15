/**
 * Document Generation Prompt - Enhanced for Analytical Rigor & Narrative Energy
 *
 * Features:
 * - Extended schema with executiveSummary, keyInsight, evidence blocks, recommendations
 * - Analytical framework requiring evidence-based claims
 * - Narrative principles for compelling writing
 * - Few-shot example demonstrating expected quality
 */

/**
 * Enhanced Document Schema
 * Supports rich content blocks including evidence citations and prioritized recommendations
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
      description: "2-3 sentence overview for time-pressed executives - the 30-second version"
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
          content: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["paragraph", "list", "table", "quote", "evidence"],
                  description: "Content block type"
                },
                text: {
                  type: "string",
                  description: "Text content for paragraph, quote, or evidence blocks"
                },
                items: {
                  type: "array",
                  items: { type: "string" },
                  description: "List items for list blocks"
                },
                ordered: {
                  type: "boolean",
                  description: "Whether list is ordered (numbered) or unordered (bullets)"
                },
                headers: {
                  type: "array",
                  items: { type: "string" },
                  description: "Table column headers"
                },
                rows: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "string" }
                  },
                  description: "Table data rows"
                },
                claim: {
                  type: "string",
                  description: "The claim being supported (for evidence blocks)"
                },
                source: {
                  type: "string",
                  description: "Source filename or reference (for evidence/quote blocks)"
                },
                attribution: {
                  type: "string",
                  description: "Attribution for quotes"
                }
              },
              required: ["type"]
            },
            description: "Rich content blocks (paragraph, list, table, quote, evidence)"
          },
          paragraphs: {
            type: "array",
            items: { type: "string" },
            description: "Legacy support - prefer using content array instead"
          }
        },
        required: ["heading"]
      },
      description: "Document sections with insights and rich content"
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "Specific recommended action"
          },
          priority: {
            type: "string",
            enum: ["critical", "high", "medium"],
            description: "Action priority level"
          },
          rationale: {
            type: "string",
            description: "Why this action matters - connect to evidence"
          },
          timeframe: {
            type: "string",
            description: "When to act: immediate, short-term, or long-term"
          }
        },
        required: ["action", "priority", "rationale"]
      },
      description: "Prioritized action items with rationale"
    }
  },
  required: ["title", "sections"]
};

/**
 * Enhanced System Prompt with Analytical Framework and Narrative Principles
 */
export const documentPrompt = `You are a senior strategy consultant writing an executive briefing for C-suite leadership. Your analysis must be rigorous, evidence-based, and compellingly written.

## ANALYTICAL FRAMEWORK

EVIDENCE REQUIREMENTS:
- Every major claim must cite specific evidence from the research
- Distinguish between facts (directly stated), inferences (logically derived), and recommendations (your expert judgment)
- Quantify impact where data permits (percentages, dollar amounts, timeframes)
- Acknowledge limitations and uncertainties explicitly

ANALYTICAL DEPTH:
- Identify patterns across multiple sources, not just summaries of individual documents
- Surface tensions, tradeoffs, and counterarguments
- Connect findings to strategic implications
- Prioritize insights by business impact, not by order in source documents

## NARRATIVE PRINCIPLES

STRUCTURE:
- Open each section with a compelling insight, not a topic label
  BAD: "Market Overview" → GOOD: "The Window for Market Entry Closes in Q3"
- Build momentum—each section should advance toward action
- End with clear, prioritized recommendations

VOICE:
- Use active voice and concrete language
  BAD: "There was a decline in performance" → GOOD: "Revenue dropped 12% quarter-over-quarter"
- Be direct—executives value clarity over hedging
- Vary sentence rhythm—mix short punchy statements with detailed analysis

ENGAGEMENT:
- Lead with what matters most (inverted pyramid)
- Use specific examples and numbers, not vague generalities
- Create tension by surfacing problems before solutions

## REQUIRED SECTIONS

1. **Executive Overview**: The 30-second version—what must they know?
2. **Situation Analysis**: What the research reveals (with evidence)
3. **Strategic Implications**: What this means for the organization
4. **Recommended Actions**: Specific, prioritized next steps with rationale
5. **Risks & Considerations**: What could go wrong, what's uncertain

## OUTPUT FORMAT

JSON with:
- title: Compelling title that signals the core insight
- executiveSummary: 2-3 sentences for the time-pressed reader
- sections[]: Each with heading, keyInsight, and content array
- recommendations[]: Prioritized actions with rationale

CONTENT BLOCKS - Use these types in the content array:
- paragraph: { type: "paragraph", text: "..." }
- list: { type: "list", items: ["..."], ordered: true/false }
- table: { type: "table", headers: ["..."], rows: [["..."]] }
- quote: { type: "quote", text: "...", source: "filename", attribution: "speaker" }
- evidence: { type: "evidence", claim: "the assertion", text: "supporting quote", source: "filename" }`;

/**
 * Few-shot example demonstrating expected analytical rigor and narrative energy
 */
const EXAMPLE_SECTION = `
## EXAMPLE OF EXCELLENT ANALYTICAL WRITING

This demonstrates the analytical rigor and narrative energy expected:

---
**Heading:** "Market Entry Timing Is Now or Never"

**Key Insight:** The window for competitive entry closes in Q3 2025, with delayed entry reducing projected market share from 23% to 8%.

**Content:**
Three converging factors create urgency for immediate action:

First, the incumbent's 18-month product refresh cycle leaves a 6-month vulnerability window starting April. Internal documents from TechCorp's investor call (Q3 earnings transcript, p.12) confirm they've delayed their next-gen platform to September, creating a rare opening.

Second, our patent on adaptive routing expires in 14 months. Post-expiration, differentiation depends solely on execution speed—an advantage that erodes daily. The patent office filing (USPTO #10,234,567) shows three competitors already have continuation applications pending.

Third, pending EU regulation (Digital Services Act, effective January 2026) will increase compliance costs by an estimated €2.4M for late entrants. Early movers who establish market presence before the deadline face significantly lower barriers.

| Entry Timing | 5-Year Market Share | Compliance Cost |
|--------------|--------------------:|----------------:|
| Q2 2025      | 23%                 | €800K           |
| Q4 2025      | 14%                 | €1.6M           |
| Q2 2026      | 8%                  | €2.4M           |

*Source: Market analysis, Appendix B sensitivity model*

The research indicates that 67% of target customers make vendor decisions in Q2 (Industry Survey 2024, p.34), making April-June the critical sales window.
---

Match this level of:
- Specific evidence with citations
- Quantified claims with data
- Clear cause-effect reasoning
- Varied content types (prose, tables, evidence blocks)
- Forward-driving narrative momentum
`;

/**
 * Generate prompt with research content and few-shot example
 */
export function generateDocumentPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `${documentPrompt}

${EXAMPLE_SECTION}

---

REQUEST: ${userPrompt}

RESEARCH DOCUMENTS:
${researchContent}

---

Now write the executive summary JSON. Match the analytical rigor and narrative energy of the example above. Use evidence blocks to cite specific sources. Include prioritized recommendations.`;
}
