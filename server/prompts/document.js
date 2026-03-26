import { getCurrentDateContext, assembleResearchContent, getAcronymRules, extractKeyStats, getSourceExtractionRules, formatDateContext } from './common.js';

export const documentSchema = {
  type: "object",
  properties: {
    reasoning: {
      type: "object",
      description: "Chain-of-thought reasoning that MUST be completed BEFORE generating any content. Forces analytical rigor.",
      properties: {
        coreInsight: {
          type: "string",
          description: "What is the single most important finding that changes how the reader should act? Not a summary - the insight that changes decisions."
        },
        tensionAnalysis: {
          type: "string",
          description: "What competing forces create urgency? Identify the central conflict (e.g., cost of action vs. cost of inaction, competitive pressure vs. resource constraints)."
        },
        stakesQuantified: {
          type: "string",
          description: "What specific dollar amount, percentage, or timeline is at risk? If not explicit in research, estimate based on available data."
        },
        keyDataPoints: {
          type: "array",
          items: { type: "string" },
          description: "The 3-5 most compelling statistics from the research that support the core insight."
        },
        counterargument: {
          type: "string",
          description: "What would a skeptical CFO or executive challenge about this analysis? Steel-man the strongest objection."
        },
        counterResponse: {
          type: "string",
          description: "How would you address the counterargument? What evidence or logic rebuts it?"
        },
        narrativeThread: {
          type: "string",
          description: "How do the research topics connect into a single compelling story? What's the arc from problem → insight → action?"
        }
      },
      required: ["coreInsight", "tensionAnalysis", "stakesQuantified", "keyDataPoints", "counterargument", "counterResponse", "narrativeThread"]
    },
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
        },
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
  required: ["reasoning", "title", "executiveSummary", "analysisOverview", "sections"]
};

const documentPrompt = `You are a senior strategy consultant writing an executive briefing for C-suite leadership.

${getSourceExtractionRules('compact')}

ACRONYMS (CRITICAL - USE EXACT STANDARD CAPITALIZATION IN ALL TEXT):

${getAcronymRules()}

CHAIN-OF-THOUGHT REASONING PROCESS (CRITICAL - Complete FIRST):

You MUST populate the "reasoning" object BEFORE writing any other content. This forces analytical rigor and ensures coherent output.

STEP 1 - CORE INSIGHT: Read ALL research files completely. Ask yourself:
"What single finding would make an executive stop and pay attention?"
Not a summary - identify the insight that CHANGES DECISIONS. Look for surprises, competitive threats, or hidden opportunities.

STEP 2 - TENSION ANALYSIS: Every compelling brief has tension. Identify the central conflict:
- Cost of action vs. cost of inaction
- Short-term pain vs. long-term gain
- Competitive pressure vs. resource constraints
- Regulatory compliance vs. business priorities
- Speed vs. quality tradeoffs
Ask: "What forces are pulling in opposite directions?"

STEP 3 - STAKES QUANTIFIED: Find or calculate the specific number at risk.
- If research says "significant cost savings" → dig deeper for the actual dollar figure
- If not explicit, ESTIMATE based on available data (e.g., "Based on the 50% cost reduction at JPMorgan and our $4.6M annual reconciliation spend, the opportunity is approximately $2.3M")
- Acceptable formats: dollar amounts, percentages, timeframes, risk levels

STEP 4 - KEY DATA POINTS: Extract the 3-5 most compelling statistics that support your core insight.
- Prioritize numbers that quantify impact
- Include source attribution for each
- Focus on data that drives decisions, not background facts

STEP 5 - COUNTERARGUMENT: Steel-man the opposition. Ask:
"What's the strongest objection a skeptical executive would raise?"
- Not a weak strawman ("implementation might be hard")
- A real challenge ("the $2.3M savings assumes 100% adoption—historical rollouts achieve 60%")

STEP 6 - COUNTER-RESPONSE: Address the counterargument directly:
"How would I respond to that objection with evidence?"
- Use data from the research to rebut
- Acknowledge valid concerns while showing they're manageable

STEP 7 - NARRATIVE THREAD: Map out how the topics connect:
"What's the story arc from problem → insight → action?"
- How does each section build on the previous?
- What's the logical flow that leads to your recommended action?

ONLY AFTER completing all 7 reasoning steps, generate the title, executiveSummary, and sections. Your reasoning should directly inform the content.

STRUCTURE & OUTPUT FORMAT (Mechanics):
- executiveSummary: Object with situation (fact), insight ($ impact), action (directive), source
- analysisOverview: Object with narrative, keyThemes, criticalFindings, strategicContext
- sections: One section per swimlane topic with detailed analysis
- Each section: insight-driven heading, key takeaway, supporting evidence, 2-4 focused paragraphs
- keyInsight: Single sentence with the most important point from that section
- supportingEvidence: 2-4 citations per section linking claims to research quotes

OUTPUT JSON:
{
  "reasoning": {
    "coreInsight": "The single most important finding that changes decisions",
    "tensionAnalysis": "The central conflict creating urgency (force A vs. force B)",
    "stakesQuantified": "Specific dollar amount, percentage, or timeline at risk",
    "keyDataPoints": ["Statistic 1 with source", "Statistic 2 with source", "Statistic 3 with source"],
    "counterargument": "The strongest objection a skeptical executive would raise",
    "counterResponse": "How the counterargument is addressed with evidence",
    "narrativeThread": "How the topics connect: problem → insight → action arc"
  },
  "title": "Insight-driven title that signals the core finding",
  "executiveSummary": {
    "situation": "Specific fact about what has happened or is happening (with numbers)",
    "insight": "Quantified impact to THIS organization in dollars or percentage",
    "action": "[Role] [verb] [object] by [date] - max 12 words",
    "source": "Actual Authoritative Source Name (e.g., 'Goldman Sachs 2024 Annual Report')"
  },
  "analysisOverview": {
    "narrative": "2-3 compelling paragraphs setting strategic context...",
    "keyThemes": [{"theme": "Theme Name as Insight", "description": "Why this matters...", "affectedTopics": ["Topic1", "Topic2"]}],
    "criticalFindings": ["Finding 1 with specifics", "Finding 2 with data"],
    "strategicContext": "1-2 paragraphs on interconnections and big picture..."
  },
  "sections": [
    {
      "heading": "Insight-led heading (not topic label)",
      "keyInsight": "Single most important takeaway from this section",
      "supportingEvidence": [{"claim": "Assertion", "quote": "Direct quote", "source": "Source Name"}],
      "paragraphs": ["paragraph 1", "paragraph 2"]
    }
  ]
}

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

WHY IT'S GOOD: Situation states a specific fact. Insight quantifies THIS firm's disadvantage in dollars. Action is 6 words with clear owner/deadline. Source is the ACTUAL authoritative source.

TRANSITIONS & FLOW:
- Connect sections with forward references: "This cost pressure intensifies when we examine..."
- Use bridge sentences that link evidence to next topic
- Avoid abrupt topic shifts - each paragraph should flow from the previous
- Patterns: "Building on this...", "This dynamic compounds in...", "The implications extend to..."

NARRATIVE ENERGY (Quality Driver):
- Open with tension, paradox, or high-stakes framing - NEVER "This report analyzes..." or "This document provides..."
- First sentence must create urgency or intrigue
- Vary sentence rhythm: follow complex sentences with short punchy ones
- Use contrast and juxtaposition: "While X suggests..., Y reveals..."
- Deploy the "So what?" escalation - each paragraph should raise stakes
- End sections with forward momentum pointing to implications, not backward summary
- Use active constructions: "Revenue collapsed 40%" not "There was a 40% decline in revenue"
- Lead with insights, not topic labels (BAD: "Overview" → GOOD: "Market Window Closes Q3")

OPENING STRATEGIES (choose based on research strength):
1. THE PARADOX: "Banks spend $4.2B annually on reconciliation while the solution costs 10% of that."
2. THE MOMENT: "On March 15, 2024, JPMorgan's CDM went live. The competitive landscape shifted."
3. THE NUMBER: "60%. That's how much reconciliation time JPMorgan eliminated in one quarter."
4. THE QUESTION: "What happens when your largest competitor cuts costs 40% overnight?"
5. THE STAKES: "$2.3M per quarter. That's the price of waiting."
6. THE CONTRAST: "JPMorgan automated. Wells Fargo modernized. Bank of America deliberated."
7. THE TIMELINE: "Q1 2026: DRR compliance deadline. Q4 2024: Competitors already compliant."

INSIGHT TRANSFORMATION PATTERNS (choose based on your research data):
Transform raw data into strategic insights using these patterns:
- DATA → COMPARISON: "X did Y" → "This puts [org] Z% behind/ahead of competitors"
- DATA → TRAJECTORY: "Current rate of X" → "At this pace, [outcome] by [date]"
- DATA → COST: "Competitors achieved X" → "Each [time unit] of delay costs $Y"
- DATA → WINDOW: "Market moving to X" → "Decision window closes [date]"
- DATA → COMPOUND: "X is growing at Y%" → "This compounds to Z over [period]"

Example transformations:
- RAW: "JPMorgan reduced reconciliation time 60%"
- COMPARISON: "This puts Bank of America 60% behind in operational efficiency"
- COST: "Each quarter without CDM costs $2.3M in excess reconciliation"
- WINDOW: "The automation advantage window closes when DRR mandates standardization in Q1 2026"

NARRATIVE ARC (apply across document sections):
Structure your sections to build momentum:
- Section 1: ESTABLISH TENSION - What's changing in the market? What forces are colliding?
- Middle Sections: DEEPEN STAKES - Compound the implications, show interconnections
- Final Section: CONVERGE TO ACTION - The path forward, with clear urgency

ANALYTICAL RIGOR (Highest Priority - Apply to ALL Content):

CHAIN OF REASONING (Required for every major claim):
For each significant assertion, follow this chain:
1. EVIDENCE: "Research shows [specific data point from source]"
2. INSIGHT: "This means [interpretation of what the data reveals]"
3. IMPLICATION: "Therefore [consequence for the organization]"

Example chain:
- EVIDENCE: "JPMorgan cut reconciliation time 60% after CDM deployment (Q4 2024 Investor Presentation)"
- INSIGHT: "First-mover advantages in derivatives automation are now quantifiable"
- IMPLICATION: "Each quarter of delay widens the cost gap by approximately $2.3M"

RIGOR REQUIREMENTS:
- Each section must contain at least 2 specific data points extracted from research
- Quantify impact: use percentages, dollar amounts, timeframes - never "significant" or "substantial"
- Distinguish between correlation and causation
- Every claim must trace directly to provided research

`;

function extractCausalRelationships(content) {
  if (!content) return { comparisons: [], windows: [] };

  const comparisonPatterns = [
    /([^.]{10,80})\s+(?:outpacing|outperforming|ahead of|leading)\s+([^.]{10,80})/gi,
    /([^.]{10,80})\s+(?:lagging|behind|trailing|falling short of)\s+([^.]{10,80})/gi,
    /([^.]{10,80})\s+(?:compared to|versus|relative to|against)\s+([^.]{10,80})/gi
  ];
  const windowPatterns = [
    /(?:deadline|due date|target date)[^.]{0,20}(Q[1-4]\s*20\d{2}|[A-Z][a-z]+\s+\d{4})/gi,
    /(?:by|before|until)\s+(Q[1-4]\s*20\d{2})[^.]{0,50}/gi,
    /(?:window|opportunity)\s+(?:closes|ends|expires)[^.]{0,50}/gi,
    /(Q[1-4]\s*20\d{2})[^.]{0,30}(?:deadline|compliance|requirement|mandate)/gi
  ];

  const comparisons = [], windows = [], seen = new Set();

  for (const p of comparisonPatterns) {
    p.lastIndex = 0; let m;
    while ((m = p.exec(content)) !== null && comparisons.length < 8) {
      const k = `comp:${m[0].substring(0, 40)}`;
      if (!seen.has(k)) { seen.add(k); comparisons.push(m[0].trim().substring(0, 200)); }
    }
  }
  for (const p of windowPatterns) {
    p.lastIndex = 0; let m;
    while ((m = p.exec(content)) !== null && windows.length < 8) {
      const k = `win:${m[0].substring(0, 40)}`;
      if (!seen.has(k)) { seen.add(k); windows.push(m[0].trim().substring(0, 150)); }
    }
  }
  return { comparisons, windows };
}

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

export function generateDocumentPrompt(userPrompt, researchFiles, swimlanes = [], precomputed = null) {
  const researchContent = precomputed?.researchContent || assembleResearchContent(researchFiles);

  // Enhanced research pre-processing
  const { stats, contextualStats, sources } = precomputed?.keyStats || extractKeyStats(researchContent);
  const { comparisons, windows } = extractCausalRelationships(researchContent);
  const swimlaneInstructions = generateSwimlaneSectionInstructions(swimlanes);
  const dateContext = precomputed?.dateContext || getCurrentDateContext();
  const contextualStatsFormatted = contextualStats.length > 0
    ? contextualStats.map((s, i) => `${i + 1}. "${s}"`).join('\n')
    : 'No contextual statistics found - extract key data points from the research text';
  const sourcesFormatted = sources.length > 0
    ? sources.join(', ')
    : 'Extract authoritative sources mentioned within the research content';
  const comparisonsFormatted = comparisons.length > 0
    ? comparisons.map((c, i) => `${i + 1}. "${c}"`).join('\n')
    : 'No direct comparisons found - look for competitive positioning in the research';
  const windowsFormatted = windows.length > 0
    ? windows.map((w, i) => `${i + 1}. "${w}"`).join('\n')
    : 'No explicit deadlines found - identify time-sensitive factors in the research';

  return `${documentPrompt}
${swimlaneInstructions}

${formatDateContext(dateContext, 'document')}

KEY DATA POINTS WITH CONTEXT (use these for evidence chains):
${contextualStatsFormatted}

RAW STATISTICS FOUND: ${stats || 'Extract numbers from research'}

AUTHORITATIVE SOURCES MENTIONED IN RESEARCH (use for source field, NOT filenames):
${sourcesFormatted}

COMPETITIVE COMPARISONS FOUND (use for DATA → COMPARISON transformation):
${comparisonsFormatted}

DEADLINES & WINDOWS FOUND (use for DATA → WINDOW transformation):
${windowsFormatted}

REQUEST: ${userPrompt}

RESEARCH:
${researchContent}

GENERATION SEQUENCE (Follow this order strictly):

1. FIRST - Complete the "reasoning" object by working through all 7 steps:
   - coreInsight: What single finding changes decisions?
   - tensionAnalysis: What forces are in conflict?
   - stakesQuantified: What specific amount is at risk?
   - keyDataPoints: What are the 3-5 most compelling statistics?
   - counterargument: What would a skeptic challenge?
   - counterResponse: How do you rebut with evidence?
   - narrativeThread: What's the story arc?

2. THEN - Use your reasoning to generate the title (reflecting your coreInsight)

3. THEN - Generate executiveSummary (situation from keyDataPoints, insight from stakesQuantified, action from narrativeThread)

4. THEN - Generate analysisOverview (themes from narrativeThread, findings from keyDataPoints)

5. FINALLY - Generate sections (each building on the narrativeThread)

QUALITY CHECK before finalizing:
- Does executiveSummary.insight match reasoning.stakesQuantified?
- Does the narrative flow match reasoning.narrativeThread?

Generate the document JSON now. The "reasoning" object MUST be completed FIRST. The executiveSummary MUST reference specific data from the research and use authoritative sources (not filenames).${swimlanes.length > 0 ? ` You MUST create exactly ${swimlanes.length} sections, one for each swimlane topic listed above.` : ''}`;
}
