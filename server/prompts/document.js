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
          description: "The actual authoritative source cited in the research (e.g., 'JPMorgan Q4 2024 Annual Report', 'Federal Reserve Economic Data', 'Gartner Market Analysis 2024'). Extract the real source name from within the research content, NOT the filename."
        }
      },
      required: ["situation", "insight", "action", "source"],
      description: "Structured executive summary: Situation (what is) → Insight (so what) → Action (now what)"
    },
    analysisOverview: {
      type: "object",
      description: "Comprehensive overview synthesizing key themes across all research topics",
      properties: {
        narrative: {
          type: "string",
          description: "2-3 paragraph narrative overview that sets the strategic context, explains why this analysis matters, and previews the key themes. Should be compelling and insight-driven, not a dry summary."
        },
        keyThemes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              theme: {
                type: "string",
                description: "Name of the cross-cutting theme (e.g., 'Regulatory Pressure Accelerating', 'Technology Debt Compounding')"
              },
              description: {
                type: "string",
                description: "2-3 sentence explanation of this theme and its significance"
              },
              affectedTopics: {
                type: "array",
                items: { type: "string" },
                description: "List of swimlane topics this theme impacts"
              }
            },
            required: ["theme", "description", "affectedTopics"]
          },
          description: "3-5 cross-cutting themes that emerge from the research across multiple topics"
        },
        criticalFindings: {
          type: "array",
          items: { type: "string" },
          description: "4-6 bullet points highlighting the most critical findings from the research"
        },
        strategicContext: {
          type: "string",
          description: "1-2 paragraphs explaining the broader strategic context and how the different topics interconnect"
        }
      },
      required: ["narrative", "keyThemes", "criticalFindings", "strategicContext"]
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
          swimlaneTopic: {
            type: "string",
            description: "The swimlane/topic from the roadmap that this section covers (e.g., 'IT/Technology', 'Regulatory Compliance')"
          },
          keyInsight: {
            type: "string",
            description: "Single most important takeaway from this section"
          },
          researchSummary: {
            type: "string",
            description: "2-3 sentence summary of research findings specific to this topic"
          },
          implications: {
            type: "string",
            description: "Strategic implications - what this means for the organization's decision-making"
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
                  description: "The actual authoritative source cited in the research (e.g., 'McKinsey Global Institute Report 2024', 'SEC Filing 10-K', 'Bloomberg Terminal Data'). Extract the real source name from within the research content, NOT the filename."
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
        required: ["heading", "keyInsight", "paragraphs"]
      },
      description: "One section per swimlane topic, covering research findings and strategic implications"
    }
  },
  required: ["title", "executiveSummary", "analysisOverview", "sections"]
};

/**
 * Enhanced prompt with analytical rigor and narrative energy
 */
export const documentPrompt = `You are a senior strategy consultant writing an executive briefing for C-suite leadership.

ANALYTICAL RIGOR:
- Follow the Evidence → Insight → Implication chain for every major claim
- Each section must contain at least 2 specific data points extracted from research
- Quantify impact: use percentages, dollar amounts, timeframes - never "significant" or "substantial"
- Address the strongest counterargument or risk in your recommendations
- Distinguish between correlation and causation
- Every claim must trace directly to provided research

SOURCE EXTRACTION (CRITICAL):
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
- NEVER use the uploaded filename (like "research.md" or "data.pdf") as the source

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
source: "JPMorgan Chase Q4 2024 Investor Presentation"

WHY IT'S GOOD: Situation states a specific fact. Insight quantifies THIS firm's disadvantage in dollars. Action is 6 words with clear owner/deadline. Source is the ACTUAL authoritative source extracted from the research, not the filename.

ANALYSIS OVERVIEW - COMPREHENSIVE STRATEGIC SYNTHESIS:

The analysisOverview provides a detailed, insightful synthesis of the entire analysis. This is NOT a summary - it's a strategic narrative that:
- Sets the broader context for why this analysis matters NOW
- Identifies cross-cutting themes that span multiple topics
- Highlights critical findings that demand attention
- Explains how different topics interconnect and influence each other

ANALYSIS OVERVIEW REQUIREMENTS:

1. NARRATIVE (2-3 paragraphs):
   - Open with a compelling hook that frames the strategic stakes
   - Explain the convergence of forces driving this analysis
   - Preview the key themes and their significance
   - Use vivid, specific language - NOT generic business speak
   - Example opening: "Three forces are colliding in Q1 2025: regulatory deadlines that cannot slip, competitor moves that are reshaping cost structures, and technology debt that compounds quarterly."

2. KEY THEMES (3-5 themes):
   - Identify patterns that cut ACROSS multiple swimlane topics
   - Each theme should be named with an insight, not a label (e.g., "Cost Gap Accelerating" not "Costs")
   - Explain why each theme matters strategically
   - List which swimlane topics each theme affects
   - Example: {"theme": "Regulatory Pressure Creates Technology Forcing Function", "description": "DRR compliance deadlines in Q1 2026 are forcing technology modernization decisions that would otherwise be deferred. Organizations that treat compliance as a technology opportunity will achieve 2-3x ROI vs. minimum viable compliance.", "affectedTopics": ["IT/Technology", "Legal/Compliance", "Finance"]}

3. CRITICAL FINDINGS (4-6 bullet points):
   - The most important discoveries from the research
   - Each should be specific, quantified where possible
   - Focus on findings that drive decisions, not background facts
   - Example: "Competitors who adopted CDM in 2024 are reporting 40-60% reduction in reconciliation costs, creating a widening cost advantage."

4. STRATEGIC CONTEXT (1-2 paragraphs):
   - Explain how the different swimlane topics connect to each other
   - Identify dependencies, sequencing requirements, or trade-offs
   - Provide the "big picture" that helps readers understand the full landscape
   - Address what happens if action is delayed vs. taken promptly

STRUCTURE:
- executiveSummary: Object with situation (fact), insight ($ impact), action (directive), source (filename)
- analysisOverview: Object with narrative, keyThemes, criticalFindings, strategicContext
- sections: One section per swimlane topic with detailed analysis
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
    "source": "Actual Authoritative Source Name (e.g., 'Goldman Sachs 2024 Annual Report')"
  },
  "analysisOverview": {
    "narrative": "2-3 compelling paragraphs setting strategic context...",
    "keyThemes": [
      {"theme": "Theme Name as Insight", "description": "Why this matters...", "affectedTopics": ["Topic1", "Topic2"]}
    ],
    "criticalFindings": ["Finding 1 with specifics", "Finding 2 with data"],
    "strategicContext": "1-2 paragraphs on interconnections and big picture..."
  },
  "sections": [
    {
      "heading": "Insight-led heading (not topic label)",
      "keyInsight": "Single most important takeaway from this section",
      "supportingEvidence": [
        {"claim": "Specific assertion made", "quote": "Direct quote from research", "source": "Actual Source Name (e.g., 'Gartner IT Spending Forecast 2024')"}
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
 * Generate swimlane-aligned section instructions
 * @param {Array<{name: string, entity: string, taskCount: number}>} swimlanes - Swimlane topics from roadmap
 * @returns {string} - Prompt section for swimlane alignment
 */
function generateSwimlaneSectionInstructions(swimlanes) {
  if (!swimlanes || swimlanes.length === 0) {
    return '';
  }

  const swimlaneList = swimlanes
    .map((s, i) => `${i + 1}. "${s.name}" (${s.taskCount} activities identified in roadmap)`)
    .join('\n');

  return `

SWIMLANE-ALIGNED SECTIONS (CRITICAL REQUIREMENT):
You MUST create exactly ONE section for EACH of the following swimlane topics. These represent the key strategic themes identified in the roadmap analysis:

${swimlaneList}

SECTION REQUIREMENTS FOR EACH SWIMLANE TOPIC:
For each swimlane topic above, create a dedicated section that:

1. HEADING: Create an insight-driven heading that captures the key finding for this topic
   - Do NOT just use the swimlane name as the heading
   - Example: Instead of "IT/Technology", use "Legacy Systems Block 40% Cost Reduction"

2. SWIMLANE TOPIC: Set the "swimlaneTopic" field to the exact swimlane name from the list above

3. KEY INSIGHT: Single sentence capturing the most important finding for this topic

4. RESEARCH SUMMARY: 2-3 sentences summarizing what the research reveals about this topic
   - Focus on facts, data points, and evidence from the research files
   - Reference specific sources

5. IMPLICATIONS: Strategic implications - what this means for decision-making
   - Connect the research findings to organizational impact
   - Highlight risks, opportunities, or required actions

6. SUPPORTING EVIDENCE: 2-4 citations linking claims to direct quotes from research

7. PARAGRAPHS: 3-5 paragraphs providing robust, compelling content that:
   - Synthesizes research findings for this topic
   - Does NOT list individual tasks or timeline details (the Gantt chart covers that)
   - Focuses on the "why it matters" and strategic significance
   - Uses narrative energy: varied sentence rhythm, active voice, tension/stakes
   - Includes quantified data points where available

SECTION ORDER: Arrange sections in a logical narrative flow that builds toward recommendations.

ANTI-PATTERNS FOR SWIMLANE SECTIONS:
- Do NOT create generic sections like "Overview" or "Summary"
- Do NOT list out tasks, milestones, or timeline items (that's the Gantt chart's job)
- Do NOT create sections for topics not in the swimlane list
- Do NOT merge multiple swimlane topics into one section
- Do NOT skip any swimlane topic - each one MUST have its own section
`;
}

/**
 * Get current date context for time-aware recommendations
 * @returns {object} Object with formatted date strings and fiscal quarter info
 */
function getCurrentDateContext() {
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
 * Generate prompt with research content and optional swimlane alignment
 * @param {string} userPrompt - User's analysis request
 * @param {Array} researchFiles - Research files to analyze
 * @param {Array} swimlanes - Optional swimlane topics from roadmap for section alignment
 */
export function generateDocumentPrompt(userPrompt, researchFiles, swimlanes = []) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  const keyStats = extractKeyStats(researchContent);
  const swimlaneInstructions = generateSwimlaneSectionInstructions(swimlanes);
  const dateContext = getCurrentDateContext();

  return `${documentPrompt}
${swimlaneInstructions}

CURRENT DATE CONTEXT (use for time-appropriate recommendations):
- Today's date: ${dateContext.fullDate} (${dateContext.month} ${dateContext.year})
- Current quarter: ${dateContext.currentQuarter}
- Next quarter: ${dateContext.nextQuarter}
- Next year: ${dateContext.nextYear}

When setting action deadlines in the executiveSummary:
- Use realistic future dates based on today's date
- Near-term actions: ${dateContext.nextQuarter} or ${dateContext.quarterPlusTwo}
- Medium-term milestones: ${dateContext.endOfYear} or Q1-Q2 ${dateContext.nextYear}
- NEVER use past dates or dates that have already occurred
- Ensure deadlines are achievable given the current date

KEY DATA POINTS EXTRACTED FROM RESEARCH (use at least one in executiveSummary.situation or executiveSummary.insight):
${keyStats || 'No specific statistics found - extract key numbers from the research text'}

REQUEST: ${userPrompt}

RESEARCH:
${researchContent}

Generate the document JSON now. The executiveSummary MUST reference specific data from the research.${swimlanes.length > 0 ? ` You MUST create exactly ${swimlanes.length} sections, one for each swimlane topic listed above.` : ''}`;
}
