import { getCurrentDateContext, assembleResearchContent, getAcronymRules } from './common.js';

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
        tensionPoint: {
          type: "string",
          description: "The core tension or conflict driving urgency (e.g., 'Competitors gaining ground while internal systems lag'). Identifies what forces are in opposition."
        },
        evidenceChain: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dataPoint: {
                type: "string",
                description: "Specific statistic or fact extracted from research"
              },
              source: {
                type: "string",
                description: "Authoritative source name for this data point"
              },
              implication: {
                type: "string",
                description: "What this data point means for the organization"
              }
            },
            required: ["dataPoint", "source", "implication"]
          },
          description: "2-3 key evidence chains supporting the executive summary claims, tracing data → source → implication"
        }
      },
      required: ["situation", "insight", "action", "source"],
      description: "Structured executive summary: Situation (what is) → Insight (so what) → Action (now what), with optional tensionPoint and evidenceChain for analytical depth"
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
          counterargument: {
            type: "string",
            description: "Strongest objection or risk to the section's recommendation - addressing this shows analytical balance and rigor"
          },
          synthesisNote: {
            type: "string",
            description: "REQUIRED connection statement showing how this section relates to others. Format: '[CONNECTION_TYPE]: [explanation]' where CONNECTION_TYPE is one of: BUILDS_ON (extends previous section's point), DEEPENS (adds nuance to earlier claim), CHALLENGES (presents counterpoint), PIVOTS (shifts focus with clear bridge), RESOLVES (synthesizes prior tensions). Example: 'DEEPENS: The cost implications outlined above become acute when we examine implementation timelines.'"
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
        required: ["heading", "keyInsight", "paragraphs", "synthesisNote"]
      },
      description: "One section per swimlane topic, covering research findings and strategic implications"
    }
  },
  required: ["reasoning", "title", "executiveSummary", "analysisOverview", "sections"]
};

export const documentPrompt = `You are a senior strategy consultant writing an executive briefing for C-suite leadership.

SOURCE EXTRACTION (Reference Material):
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
- executiveSummary: Object with situation (fact), insight ($ impact), action (directive), source, tensionPoint, evidenceChain
- analysisOverview: Object with narrative, keyThemes, criticalFindings, strategicContext
- sections: One section per swimlane topic with detailed analysis
- Each section: insight-driven heading, key takeaway, supporting evidence, counterargument, synthesisNote, 2-4 focused paragraphs
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
    "source": "Actual Authoritative Source Name (e.g., 'Goldman Sachs 2024 Annual Report')",
    "tensionPoint": "The core conflict driving urgency (optional but encouraged)",
    "evidenceChain": [{"dataPoint": "stat", "source": "source name", "implication": "what it means"}]
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
      "counterargument": "Strongest objection or risk to this recommendation",
      "synthesisNote": "How this section connects to other sections",
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

4. TENSION POINT (optional but encouraged):
   - Identify the core conflict driving urgency
   - What forces are in opposition? What's at stake if nothing changes?
   - Example: "Competitors accelerating while legacy systems constrain response"

5. EVIDENCE CHAIN (2-3 entries):
   - For each key claim, explicitly trace: data point → source → implication
   - This demonstrates analytical rigor and source fidelity

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
tensionPoint: "First-mover competitors locking in cost advantages while legacy systems block rapid response"
evidenceChain: [
  {"dataPoint": "60% reconciliation time reduction", "source": "JPMorgan Q4 2024 Investor Presentation", "implication": "Competitors achieving automation benefits now"},
  {"dataPoint": "$2.3M quarterly cost gap", "source": "Internal cost analysis", "implication": "Gap compounds 15% annually without action"}
]

WHY IT'S GOOD: Situation states a specific fact. Insight quantifies THIS firm's disadvantage in dollars. Action is 6 words with clear owner/deadline. Source is the ACTUAL authoritative source. TensionPoint captures the conflict. EvidenceChain traces claims to sources.

SYNTHESIS NOTE REQUIREMENTS (MANDATORY for each section):
The synthesisNote field is REQUIRED. Format: "[CONNECTION_TYPE]: [explanation]"

CONNECTION TYPES (choose the most accurate):
- BUILDS_ON: Extends or expands the previous section's main point
- DEEPENS: Adds nuance, detail, or complexity to an earlier claim
- CHALLENGES: Presents a counterpoint, tension, or complication
- PIVOTS: Shifts focus to a new dimension with explicit bridge
- RESOLVES: Synthesizes or reconciles tensions from prior sections

SECTION-SPECIFIC FORMATS:
- First section: "ESTABLISHES: [what foundation this section lays for the document]"
- Middle sections: "[CONNECTION_TYPE]: [how this connects to section X and advances the argument]"
- Final section: "RESOLVES: [how this synthesizes the preceding analysis into actionable conclusion]"

GOOD EXAMPLES:
- "BUILDS_ON: The cost pressures identified in Market Analysis become acute when we examine implementation timelines."
- "CHALLENGES: While the efficiency gains above appear compelling, regulatory constraints introduce significant friction."
- "PIVOTS: Having established the competitive landscape, we now examine the internal capabilities required to respond."
- "RESOLVES: The technology, cost, and competitive factors above converge on a single strategic imperative."

ANTI-PATTERNS (DO NOT USE):
- ❌ "This section discusses..." (describes, doesn't connect)
- ❌ "Moving on to..." (transition word without connection logic)
- ❌ "Another important topic..." (no relationship to prior content)
- ❌ "See above" or "As mentioned" (vague back-references)
- ❌ Empty or generic statements that could apply to any document

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

Each section's synthesisNote must use the CONNECTION_TYPE format and reference specific findings:
- BAD: "This section covers technology implications" (no connection type, vague)
- GOOD: "BUILDS_ON: The $2.3M quarterly cost gap identified above makes technology modernization not optional but existential"

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
- Address the strongest counterargument or risk in your recommendations (fill counterargument field)
- Distinguish between correlation and causation
- Every claim must trace directly to provided research
- Fill the evidenceChain array to demonstrate source fidelity

STEEL MAN COUNTERARGUMENTS (Required for analytical credibility):
Each section's counterargument field must present the STRONGEST possible objection - not a weak strawman.

WEAK counterarguments to AVOID:
- "Implementation may be complex" (vague)
- "Some stakeholders might resist change" (generic)
- "There could be unforeseen challenges" (empty)
- "The timeline might be aggressive" (non-specific)

STRONG counterarguments to USE:
- "The $2.3M savings assumes 100% adoption—historical enterprise rollouts achieve 60% in year one, reducing realistic first-year savings to $1.4M"
- "JPMorgan's 60% reduction occurred with a $50M technology investment; smaller institutions may see 30-40% at proportional cost"
- "DRR compliance drives standardization, but early adopters risk rework if CFTC modifies CDM requirements before Q1 2026 finalization"

A strong counterargument:
1. Cites specific numbers or precedents
2. Challenges a core assumption in your recommendation
3. Forces you to strengthen your argument by addressing it

NEW SCHEMA FIELDS (Use these to demonstrate quality):
- tensionPoint: Identify the core conflict creating urgency. What forces are in opposition?
- evidenceChain: For each key claim, explicitly trace data → source → implication
- counterargument: What's the strongest objection? Addressing it shows rigor.
- synthesisNote: How does this section connect to others? Build the narrative arc.`;

function extractKeyStats(content) {
  if (!content) return { stats: '', contextualStats: [], sources: [] };

  // Split into sentences for context extraction
  const sentences = content.split(/(?<=[.!?])\s+/);

  const statPatterns = [
    /\d+\.?\d*\s*%/g,                          // Percentages: 23%, 4.5%
    /\$\d[\d,]*\.?\d*\s*[MBK]?(?:illion)?/gi,  // Currency: $4M, $2.5 billion
    /\d+x\b/gi,                                // Multipliers: 3x, 10x
    /\d{1,3}(?:,\d{3})+/g,                     // Large numbers: 1,000,000
    /Q[1-4]\s*20\d{2}/gi                       // Quarters: Q3 2024
  ];

  // Extract stats WITH their surrounding sentence context
  const contextualStats = [];
  const seenSentences = new Set();

  for (const sentence of sentences) {
    if (seenSentences.has(sentence) || sentence.length < 20 || sentence.length > 300) continue;

    for (const pattern of statPatterns) {
      pattern.lastIndex = 0; // Reset regex state
      if (pattern.test(sentence)) {
        contextualStats.push(sentence.trim());
        seenSentences.add(sentence);
        break;
      }
    }
    if (contextualStats.length >= 25) break;  // Increased for richer context
  }

  // Extract raw stats for backward compatibility
  const rawMatches = new Set();
  for (const pattern of statPatterns) {
    pattern.lastIndex = 0;
    const found = content.match(pattern) || [];
    found.slice(0, 5).forEach(m => rawMatches.add(m.trim()));
  }

  // Extract mentioned authoritative sources from research
  const sourcePatterns = [
    /according to ([^,.\n]+)/gi,
    /per ([^,.\n]+(?:report|study|analysis|survey|data)[^,.\n]*)/gi,
    /([A-Z][a-zA-Z]+ (?:Q[1-4] )?\d{4} (?:Annual |Quarterly )?Report)/g,
    /((?:Gartner|McKinsey|Forrester|Deloitte|BCG|Bain|Bloomberg|Reuters)[^,.\n]{0,50})/gi,
    /\[([^\]]+(?:Report|Study|Analysis|Survey|Data)[^\]]*)\]/gi
  ];

  const sources = new Set();
  for (const pattern of sourcePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null && sources.size < 15) {  // Increased for multi-source research
      const source = match[1]?.trim();
      if (source && source.length > 5 && source.length < 100) {
        sources.add(source);
      }
    }
  }

  return {
    stats: Array.from(rawMatches).slice(0, 15).join(', '),
    contextualStats: contextualStats.slice(0, 15),  // Increased from 10
    sources: Array.from(sources).slice(0, 15)       // Increased from 8
  };
}

function extractCausalRelationships(content) {
  if (!content) return { relationships: [], comparisons: [], trajectories: [], windows: [] };

  // Causal relationship patterns
  const causalPatterns = [
    // Effect BECAUSE cause
    /([^.]{20,100})\s+(?:because|due to|as a result of|resulting from|driven by)\s+([^.]{20,100})/gi,
    // Cause LED TO effect
    /([^.]{20,100})\s+(?:led to|resulted in|caused|triggered|enabled|drove|produced)\s+([^.]{20,100})/gi,
    // IF cause THEN effect (conditional)
    /(?:if|when|once)\s+([^,]{15,80}),?\s+(?:then\s+)?([^.]{15,80})/gi
  ];

  // Comparison patterns (for DATA → COMPARISON transformation)
  const comparisonPatterns = [
    /([^.]{10,80})\s+(?:outpacing|outperforming|ahead of|leading)\s+([^.]{10,80})/gi,
    /([^.]{10,80})\s+(?:lagging|behind|trailing|falling short of)\s+([^.]{10,80})/gi,
    /([^.]{10,80})\s+(?:compared to|versus|relative to|against)\s+([^.]{10,80})/gi
  ];

  // Trajectory patterns (for DATA → TRAJECTORY transformation)
  const trajectoryPatterns = [
    /([^.]{15,100})\s+(?:accelerating|growing|increasing|expanding|rising)\s*(?:at|by)?\s*(\d+[^.]{0,50})/gi,
    /([^.]{15,100})\s+(?:compounding|widening|narrowing|declining|shrinking)\s*(?:at|by)?\s*(\d+[^.]{0,50})/gi,
    /(?:at this|at the current)\s+(?:rate|pace)[^.]{0,30}([^.]{20,100})/gi
  ];

  // Window/deadline patterns (for DATA → WINDOW transformation)
  const windowPatterns = [
    /(?:deadline|due date|target date)[^.]{0,20}(Q[1-4]\s*20\d{2}|[A-Z][a-z]+\s+\d{4})/gi,
    /(?:by|before|until)\s+(Q[1-4]\s*20\d{2})[^.]{0,50}/gi,
    /(?:window|opportunity)\s+(?:closes|ends|expires)[^.]{0,50}/gi,
    /(Q[1-4]\s*20\d{2})[^.]{0,30}(?:deadline|compliance|requirement|mandate)/gi
  ];

  const relationships = [];
  const comparisons = [];
  const trajectories = [];
  const windows = [];
  const seen = new Set();

  // Extract causal relationships
  for (const pattern of causalPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null && relationships.length < 10) {  // Increased from 5
      const key = `rel:${match[1].substring(0, 30)}|${match[2].substring(0, 30)}`;
      if (!seen.has(key)) {
        seen.add(key);
        relationships.push({
          cause: match[1].trim().substring(0, 150),
          effect: match[2].trim().substring(0, 150)
        });
      }
    }
  }

  // Extract comparisons
  for (const pattern of comparisonPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null && comparisons.length < 8) {  // Increased from 4
      const key = `comp:${match[0].substring(0, 40)}`;
      if (!seen.has(key)) {
        seen.add(key);
        comparisons.push(match[0].trim().substring(0, 200));
      }
    }
  }

  // Extract trajectories
  for (const pattern of trajectoryPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null && trajectories.length < 8) {  // Increased from 4
      const key = `traj:${match[0].substring(0, 40)}`;
      if (!seen.has(key)) {
        seen.add(key);
        trajectories.push(match[0].trim().substring(0, 200));
      }
    }
  }

  // Extract windows/deadlines
  for (const pattern of windowPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null && windows.length < 8) {  // Increased from 4
      const key = `win:${match[0].substring(0, 40)}`;
      if (!seen.has(key)) {
        seen.add(key);
        windows.push(match[0].trim().substring(0, 150));
      }
    }
  }

  return { relationships, comparisons, trajectories, windows };
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

export function generateDocumentPrompt(userPrompt, researchFiles, swimlanes = []) {
  const researchContent = assembleResearchContent(researchFiles);

  // Enhanced research pre-processing
  const { stats, contextualStats, sources } = extractKeyStats(researchContent);
  const { relationships, comparisons, trajectories, windows } = extractCausalRelationships(researchContent);
  const swimlaneInstructions = generateSwimlaneSectionInstructions(swimlanes);
  const dateContext = getCurrentDateContext();
  const contextualStatsFormatted = contextualStats.length > 0
    ? contextualStats.map((s, i) => `${i + 1}. "${s}"`).join('\n')
    : 'No contextual statistics found - extract key data points from the research text';
  const sourcesFormatted = sources.length > 0
    ? sources.join(', ')
    : 'Extract authoritative sources mentioned within the research content';
  const causalFormatted = relationships.length > 0
    ? relationships.map(r => `- "${r.cause}" → "${r.effect}"`).join('\n')
    : 'Identify cause-effect relationships from the research';
  const comparisonsFormatted = comparisons.length > 0
    ? comparisons.map((c, i) => `${i + 1}. "${c}"`).join('\n')
    : 'No direct comparisons found - look for competitive positioning in the research';
  const trajectoriesFormatted = trajectories.length > 0
    ? trajectories.map((t, i) => `${i + 1}. "${t}"`).join('\n')
    : 'No trajectory indicators found - identify growth/decline patterns in the research';
  const windowsFormatted = windows.length > 0
    ? windows.map((w, i) => `${i + 1}. "${w}"`).join('\n')
    : 'No explicit deadlines found - identify time-sensitive factors in the research';

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

KEY DATA POINTS WITH CONTEXT (use these for evidence chains):
${contextualStatsFormatted}

RAW STATISTICS FOUND: ${stats || 'Extract numbers from research'}

AUTHORITATIVE SOURCES MENTIONED IN RESEARCH (use for source field, NOT filenames):
${sourcesFormatted}

CAUSAL RELATIONSHIPS IDENTIFIED (use for insight development):
${causalFormatted}

COMPETITIVE COMPARISONS FOUND (use for DATA → COMPARISON transformation):
${comparisonsFormatted}

TRAJECTORY INDICATORS FOUND (use for DATA → TRAJECTORY transformation):
${trajectoriesFormatted}

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

5. FINALLY - Generate sections (each building on the narrativeThread, addressing counterarguments)

QUALITY CHECK before finalizing:
- Does executiveSummary.insight match reasoning.stakesQuantified?
- Does executiveSummary.tensionPoint match reasoning.tensionAnalysis?
- Do section counterarguments relate to reasoning.counterargument?
- Does the narrative flow match reasoning.narrativeThread?

Generate the document JSON now. The "reasoning" object MUST be completed FIRST. The executiveSummary MUST reference specific data from the research and use authoritative sources (not filenames).${swimlanes.length > 0 ? ` You MUST create exactly ${swimlanes.length} sections, one for each swimlane topic listed above.` : ''}`;
}
