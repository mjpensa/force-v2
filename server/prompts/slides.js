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

// Outline schema for two-pass generation (Pass 1: narrative structure)
export const slidesOutlineSchema = {
  description: "Narrative outline for slide presentation - defines structure before full content generation",
  type: "object",
  properties: {
    reasoning: {
      type: "object",
      description: "Chain-of-thought reasoning completed BEFORE structuring sections. Forces analytical rigor.",
      properties: {
        overallNarrativeArc: {
          type: "string",
          description: "Complete story arc: [Opening Tension] -> [Deepening Stakes] -> [Resolution/Action]. What is the single narrative thread?",
          nullable: false
        },
        primaryFramework: {
          type: "string",
          enum: ["SECOND_ORDER_EFFECTS", "CONTRARIAN", "COMPETITIVE_DYNAMICS", "TEMPORAL_ARBITRAGE", "RISK_ASYMMETRY"],
          description: "Dominant analytical lens for this presentation. Which framework best reveals the core insight?",
          nullable: false
        },
        keyEvidenceChains: {
          type: "array",
          items: {
            type: "object",
            properties: {
              evidence: { type: "string", description: "Specific data point from research with source", nullable: false },
              insight: { type: "string", description: "What this evidence means - the 'so what'", nullable: false },
              implication: { type: "string", description: "Action or decision this drives", nullable: false }
            },
            required: ["evidence", "insight", "implication"]
          },
          description: "3-5 anchor evidence-insight-implication chains that will drive the presentation"
        },
        crossSectionConnections: {
          type: "array",
          items: { type: "string" },
          description: "How each section's ending creates tension for the next section's opening"
        }
      },
      required: ["overallNarrativeArc", "primaryFramework", "keyEvidenceChains"]
    },
    sections: {
      type: "array",
      description: "Section outlines with narrative arcs and slide blueprints",
      items: {
        type: "object",
        properties: {
          swimlane: {
            type: "string",
            description: "The swimlane/topic name",
            nullable: false
          },
          narrativeArc: {
            type: "string",
            description: "1-sentence narrative arc: tension → insight → resolution for this section",
            nullable: false
          },
          slides: {
            type: "array",
            description: "Slide blueprints with taglines, data points, and connections",
            items: {
              type: "object",
              properties: {
                tagline: {
                  type: "string",
                  description: "2-word insight-driven tagline (NOT topic labels like OVERVIEW)",
                  nullable: false
                },
                keyDataPoint: {
                  type: "string",
                  description: "The primary quantified data point this slide will feature",
                  nullable: false
                },
                analyticalLens: {
                  type: "string",
                  enum: ["SECOND_ORDER_EFFECTS", "CONTRARIAN", "COMPETITIVE_DYNAMICS", "TEMPORAL_ARBITRAGE", "RISK_ASYMMETRY", "CAUSAL_CHAIN"],
                  description: "The specific analytical framework applied to this slide. Must explicitly name which lens drives the insight.",
                  nullable: false
                },
                connectsTo: {
                  type: "string",
                  description: "How this slide's implication connects to the next slide's evidence",
                  nullable: false
                }
              },
              required: ["tagline", "keyDataPoint", "analyticalLens", "connectsTo"]
            },
            minItems: 1
          }
        },
        required: ["swimlane", "narrativeArc", "slides"]
      }
    }
  },
  required: ["reasoning", "sections"]
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
 * Generate prompt for slide outline (Pass 1 of two-pass generation)
 * Creates narrative structure with cross-slide connections before full content generation
 * @param {string} userPrompt - The user's request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @param {Array<{name: string, entity: string, taskCount: number}>} swimlanes - Swimlane topics from Gantt chart
 * @returns {string} Complete prompt for outline generation
 */
export function generateSlidesOutlinePrompt(userPrompt, researchFiles, swimlanes = []) {
  // Validate inputs
  if (!userPrompt || userPrompt.trim() === '') {
    throw new Error('userPrompt is required for outline generation');
  }
  if (!researchFiles || researchFiles.length === 0) {
    throw new Error('At least one research file is required for outline generation');
  }

  // Validate and filter research files
  const validFiles = researchFiles.filter(file => {
    if (!file || typeof file.filename !== 'string' || typeof file.content !== 'string') {
      return false;
    }
    return file.content.trim().length > 0;
  });

  if (validFiles.length === 0) {
    throw new Error('At least one research file with content is required for outline generation');
  }

  // Convert array to formatted string
  const researchContent = validFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  // Extract key statistics
  const keyStats = extractKeyStats(researchContent);

  // Format swimlanes for the prompt
  const swimlaneList = swimlanes.length > 0
    ? swimlanes.map((s, i) => `${i + 1}. "${s.name}" (${s.taskCount} related tasks)`).join('\n')
    : null;

  const swimlaneInstructions = swimlanes.length > 0
    ? `
SECTIONS (create one per swimlane, in this exact order):
${swimlaneList}
`
    : `
SECTIONS: Identify 3-6 major themes from the research and create one section per theme.
`;

  return `You are creating a NARRATIVE OUTLINE for a presentation. This outline will guide full slide content generation.

Your goal: Define the STRUCTURE and NARRATIVE FLOW before any detailed content is written.

## CHAIN OF THOUGHT: REASON BEFORE STRUCTURING

You MUST complete the 'reasoning' object FIRST, before creating any sections. This forces analytical rigor.

1. OVERALL NARRATIVE ARC: What is the complete story?
   - Opening Tension: What problem/opportunity creates urgency?
   - Deepening Stakes: How does evidence compound the urgency?
   - Resolution: What action resolves the tension?
   Format: "[Opening Tension] -> [Deepening Stakes] -> [Resolution/Action]"

2. PRIMARY FRAMEWORK: Name ONE dominant analytical lens from the enum:
   - SECOND_ORDER_EFFECTS: Trace consequences 2-3 steps deep (If X → Y → Z)
   - CONTRARIAN: Challenge the obvious conclusion with evidence
   - COMPETITIVE_DYNAMICS: Frame decisions in competitive context
   - TEMPORAL_ARBITRAGE: Connect short-term pain to long-term gain
   - RISK_ASYMMETRY: Show bounded downside vs. unbounded upside

3. KEY EVIDENCE CHAINS: Identify 3-5 anchor chains from the research:
   For each: Evidence (specific data with source) -> Insight (what it means) -> Implication (action it drives)

4. CROSS-SECTION CONNECTIONS: How does each section's ending hook into the next?

ONLY AFTER completing reasoning should you define sections and slides.

${swimlaneInstructions}

FOR EACH SECTION, provide:

1. "swimlane": The topic name (use exact swimlane name if provided)

2. "narrativeArc": A single sentence describing the section's story arc using this pattern:
   "[Tension/Problem] → [Key Insight from data] → [Resolution/Implication]"

   EXAMPLE: "Rising reconciliation costs threaten margins → JPMorgan's 50% cost reduction proves CDM viability → Q2 2025 becomes the adoption deadline for competitive survival"

3. "slides": Array of 5-10 slide blueprints, each with:

   a) "tagline": 2-word INSIGHT-DRIVEN tagline (max 21 characters)
      GOOD: "MARGIN EROSION", "50% COST GAP", "Q2 DEADLINE", "73% UNPREPARED"
      BAD: "OVERVIEW", "SUMMARY", "KEY POINTS", "ANALYSIS", "INTRODUCTION"

   b) "keyDataPoint": The PRIMARY quantified evidence this slide will feature
      Extract REAL numbers from research: percentages, dollar amounts, timeframes, ratios
      EXAMPLE: "50% reconciliation cost reduction at JPMorgan Q4 2024"

   c) "analyticalLens": The ANALYTICAL FRAMEWORK for this slide. MUST be one of the enum values:
      - "SECOND_ORDER_EFFECTS": If X happens → Y follows → Z results
      - "CONTRARIAN": Obvious conclusion is X, but evidence shows Y
      - "COMPETITIVE_DYNAMICS": While we do X, competitors gain/lose Y
      - "TEMPORAL_ARBITRAGE": Short-term cost X enables long-term advantage Y
      - "RISK_ASYMMETRY": Downside capped at X, upside extends to Y
      - "CAUSAL_CHAIN": A causes B which triggers C

   d) "connectsTo": How this slide's IMPLICATION leads to the next slide's EVIDENCE
      This creates narrative threading between slides.
      EXAMPLE: "Cost pressure from delayed adoption → leads to → competitive disadvantage analysis"
      For the last slide in a section: "Section conclusion → creates tension for → next section's opening"

NARRATIVE FLOW REQUIREMENTS:

1. SECTION-LEVEL COHERENCE:
   - First 1-2 slides: CONTEXT (what IS happening)
   - Middle 3-5 slides: ANALYSIS (why it matters, deep dive)
   - Final 2-3 slides: IMPLICATIONS (what to DO)

2. CROSS-SLIDE CONNECTIONS:
   - Every slide must logically flow from the previous
   - The "connectsTo" field is CRITICAL - it defines the narrative thread
   - Avoid isolated "islands" of analysis

3. CROSS-SECTION TENSION:
   - Each section's ending should create tension
   - The next section's opening should resolve or build on that tension

KEY DATA POINTS FROM RESEARCH (use these in your outlines):
${keyStats || 'Extract specific numbers, percentages, and dates from the research'}

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

OUTPUT: Valid JSON matching the outline schema. Start with { and end with }
`;
}
/**
 * Get framework signal phrases for enforcement in Pass 2
 * @param {string} framework - The primary framework from outline reasoning
 * @returns {string} Signal phrases for the specified framework
 */
function getFrameworkSignalPhrases(framework) {
  const phrases = {
    'SECOND_ORDER_EFFECTS': '"This triggers...", "Which in turn...", "The downstream effect...", "If X → Y → Z"',
    'CONTRARIAN': '"Conventional wisdom suggests...", "However, data reveals...", "Counter to expectations..."',
    'COMPETITIVE_DYNAMICS': '"Market positioning shifts...", "First-mover advantage...", "The competitive gap..."',
    'TEMPORAL_ARBITRAGE': '"Front-loading investment...", "Compounds over time...", "Short-term X enables long-term Y"',
    'RISK_ASYMMETRY': '"Bounded risk of...", "Unlimited potential for...", "Asymmetric opportunity..."',
    'CAUSAL_CHAIN': '"Because...", "Root cause...", "This leads directly to..."'
  };
  return phrases[framework] || 'Use explicit analytical language that signals your reasoning';
}

/**
 * Generate prompt for slides with research content, organized by swimlane sections
 * AI creates multiple slides per swimlane topic, summarizing research for each
 * @param {string} userPrompt - The user's request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @param {Array<{name: string, entity: string, taskCount: number}>} swimlanes - Swimlane topics from Gantt chart
 * @param {object|null} outline - Optional narrative outline from pass 1 for guided generation
 * @returns {string} Complete prompt for AI
 */
export function generateSlidesPrompt(userPrompt, researchFiles, swimlanes = [], outline = null) {
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
- Minimum 5 slides per section with substantial research content
- Maximum 10 slides to maintain focus and avoid repetition

NARRATIVE PROGRESSION WITHIN EACH SECTION (REQUIRED):
Every section must follow this three-phase arc for coherent storytelling:

PHASE 1 - CONTEXT (1-2 slides at section start):
- What IS happening? (Competitive move, market shift, regulatory change)
- Use twoColumn layout for focused, authoritative opening
- Tagline signals the situation: "MARKET SHIFT", "Q3 DEADLINE", "COMPETITOR MOVE"
- Establish urgency and stakes before diving into analysis

PHASE 2 - ANALYSIS (3-5 slides, section middle):
- Why does it matter? Deep dive into data, comparisons, implications
- Mix twoColumn and threeColumn layouts for visual variety
- Each slide explores a distinct analytical angle
- Tagline signals insight: "COST GAP WIDENING", "MARGIN EROSION", "60% UNPREPARED"
- Build the case with compounding evidence

PHASE 3 - IMPLICATIONS (2-3 slides at section end):
- What should we DO? Recommendations, timelines, decision points
- Prefer threeColumn for presenting options or multiple factors
- Tagline signals action: "DECISION REQUIRED", "TIMELINE CRITICAL", "INVESTMENT CASE"
- End with forward momentum, not backward summary

ANTI-PATTERN: Random slide order that jumps context→implications→context
Readers need context before analysis, analysis before implications

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

  // Build outline constraint if outline is provided (Pass 2 of two-pass generation)
  const primaryFramework = outline?.reasoning?.primaryFramework;
  const keyEvidenceChains = outline?.reasoning?.keyEvidenceChains || [];

  const outlineConstraint = outline ? `
NARRATIVE OUTLINE (STRICT CONSTRAINT - FROM PASS 1):
You have been given a pre-planned narrative structure. You MUST follow it exactly.

${JSON.stringify(outline, null, 2)}

PRIMARY FRAMEWORK ENFORCEMENT:
The outline specifies "${primaryFramework}" as the dominant analytical lens.
- EVERY analytical slide MUST use this framework's signature patterns
- At least 50% of slides must explicitly signal this framework
- Use phrases from: ${getFrameworkSignalPhrases(primaryFramework)}

KEY EVIDENCE CHAINS (MUST APPEAR IN SLIDES):
${keyEvidenceChains.map((c, i) =>
  `${i + 1}. Evidence: "${c.evidence?.substring(0, 80)}${c.evidence?.length > 80 ? '...' : ''}" -> Must appear in at least one slide`
).join('\n') || 'No key evidence chains specified'}

OUTLINE REQUIREMENTS (HARD CONSTRAINTS):
- Use the EXACT taglines from the outline (minor rewording only for impact)
- Feature the keyDataPoint identified for each slide as PRIMARY evidence
- Apply the analyticalLens specified - use the EXACT framework from the outline
- Honor the connectsTo field - ensure your slide's conclusion leads logically to the next slide
- Maintain the narrativeArc for each section (tension → insight → resolution)

` : '';

  return `You are creating presentation slides organized into SECTIONS, with STRICT formatting requirements.

${sectionInstructions}
${outlineConstraint}
CROSS-SLIDE NARRATIVE THREADING (CRITICAL FOR COHERENCE):
- Each slide MUST build on the previous slide's implication
- Use forward-referencing language: "This creates the foundation for...", "Building on this...", "This pressure directly..."
- Section endings must create tension that the next section resolves
- ANTI-PATTERN: Isolated "islands" of analysis with no connection between slides

TRANSITION PATTERNS (use in paragraph endings to connect slides):
- Cause-effect: "This cost pressure directly impacts..." → next slide explores the impact
- Escalation: "Beyond this, an even larger concern emerges..." → next slide reveals the bigger issue
- Contrast pivot: "While X appears favorable, Y reveals..." → next slide examines the contradiction
- Timeline progression: "Having established X, the Q3 deadline forces..." → next slide addresses timeline
- Evidence stacking: "Combined with [previous point], this data shows..." → builds cumulative case

ANALYTICAL DEPTH FRAMEWORKS (MANDATORY - NAME YOUR FRAMEWORK):
Go beyond surface-level observations. For EVERY analytical slide, you MUST:
1. Apply one framework explicitly
2. Use the framework's signature language patterns so readers can identify which lens drives the analysis

FRAMEWORK SIGNATURE PATTERNS (use these phrases to signal your framework):

1. SECOND_ORDER_EFFECTS: "If X happens → Y follows → which means Z..."
   Signal phrases: "This triggers...", "Which in turn...", "The downstream effect..."
   Don't just state the fact; trace its downstream consequences
   Example: "50% cost reduction → competitors lose pricing power → industry consolidation accelerates"

2. CONTRARIAN: "The obvious conclusion is X, but evidence suggests Y..."
   Signal phrases: "Conventional wisdom suggests...", "However, data reveals...", "Counter to expectations..."
   Challenge the expected interpretation with data
   Example: "While CDM appears costly, the $2.3M quarterly loss from NOT adopting exceeds implementation cost"

3. COMPETITIVE_DYNAMICS: "While we consider X, competitors gain/lose Y..."
   Signal phrases: "Market positioning shifts as...", "First-mover advantage...", "The competitive gap..."
   Frame decisions in competitive context, not isolation
   Example: "Each quarter of delay shifts market share; early adopters capture sticky client relationships"

4. TEMPORAL_ARBITRAGE: "Short-term cost X enables long-term advantage Y..."
   Signal phrases: "Front-loading investment...", "Compounds over time...", "Delayed gratification..."
   Connect present pain to future gain (or present inaction to future loss)
   Example: "18-month implementation investment yields 10-year operational moat"

5. RISK_ASYMMETRY: "Downside is capped at X, but upside extends to Y..."
   Signal phrases: "Bounded risk of...", "Unlimited potential for...", "Asymmetric opportunity..."
   Frame decisions in terms of bounded downside vs. unbounded upside
   Example: "$4M pilot risk vs. $40M annual savings potential = asymmetric opportunity"

6. CAUSAL_CHAIN: "A causes B which triggers C..."
   Signal phrases: "Because of...", "This leads to...", "The root cause..."
   Trace the causal links explicitly

TAGLINE INSIGHT PATTERNS (use these, NOT topic labels):
Your tagline must signal INSIGHT, TENSION, or STAKES - never just name the topic.

QUANTIFIED STAKES: "73% UNPREPARED", "$4.2M AT RISK", "50% COST GAP", "8% QUARTERLY EROSION"
ACTION TENSION: "DECISION WINDOW", "ADOPTION CLIFF", "CLOSING RUNWAY", "PILOT OR PERISH"
COMPETITIVE GAP: "WIDENING GAP", "FIRST-MOVER EDGE", "MARGIN EROSION", "MARKET SHARE SHIFT"
TEMPORAL PRESSURE: "Q2 DEADLINE", "18-MONTH RUNWAY", "WINDOW CLOSING", "2025 INFLECTION"

TAGLINE ANTI-PATTERNS (NEVER USE - THESE ARE TOPIC LABELS, NOT INSIGHTS):
"OVERVIEW", "SUMMARY", "KEY POINTS", "ANALYSIS", "FINDINGS", "FACTORS", "INTRODUCTION"
"BACKGROUND", "CONTEXT", "DETAILS", "INFORMATION", "DISCUSSION", "CONSIDERATIONS"

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

EVIDENCE → INSIGHT → IMPLICATION CHAIN (REQUIRED FOR EVERY PARAGRAPH):

Every paragraph MUST follow this three-part structure:
1. EVIDENCE: Open with a sourced, quantified data point from research
2. INSIGHT: Explain what this data MEANS - the "so what?" that reveals significance
3. IMPLICATION: State what the reader should DO, DECIDE, or EXPECT as a result

PARAGRAPH CONSTRUCTION PATTERN:
- Sentence 1-2: EVIDENCE - "[Source] reveals [specific data point]..."
- Sentence 2-3: INSIGHT - "This demonstrates/indicates/exposes [meaning]..."
- Sentence 3-4: IMPLICATION - "Organizations that [action] will [outcome]..."

EXAMPLE - POOR PARAGRAPH (no chain, isolated facts):
"JPMorgan deployed CDM. Reconciliation costs dropped 50%. Banks face pressure."
Problems: No source attribution, facts don't connect, no insight or implication

EXAMPLE - GOOD PARAGRAPH (complete chain):
"JPMorgan's Q4 2024 deployment of CDM cut reconciliation costs 50%, according to their Annual Investor Report. This early-mover advantage compounds quarterly as manual-process competitors fall further behind on unit economics. Organizations delaying past Q2 2025 face a widening cost gap estimated at 8-12% per quarter."
Why it works: Sourced evidence → clear insight about competitive dynamics → actionable implication with timeline

SOURCE EXTRACTION (CRITICAL - DRIVES CREDIBILITY):
- Research documents contain references to actual authoritative sources (reports, filings, publications)
- You MUST extract and cite these REAL source names in paragraphs, NOT the uploaded filenames
- Cite sources explicitly: "According to [Actual Source Name]..." or "[Report Name] reveals..."

AUTHORITATIVE SOURCE CATEGORIES TO EXTRACT:
- Official reports: "Federal Reserve Economic Data Q3 2024", "JPMorgan 2024 Annual Report"
- Research firms: "Gartner Magic Quadrant 2024", "McKinsey Global Institute Study"
- Regulatory filings: "SEC Form 10-K", "CFTC Rule 17a-4 Guidance", "ISDA CDM Specification v3.0"
- Industry publications: "Risk.net Analysis", "Bloomberg Terminal Data"
- Internal sources: "Internal competitive analysis", "Q3 Strategy Review"

CITATION PATTERNS (use these phrases):
- "According to [Source], [fact]..."
- "[Source] reveals [finding]..."
- "The [Report Name] shows [data]..."
- "Per [Organization]'s analysis, [insight]..."

SOURCE CITATION ANTI-PATTERNS (NEVER DO):
- NEVER cite uploaded filenames: "According to research.md..." or "data.pdf shows..."
- NEVER use vague attribution: "Sources indicate...", "Reports suggest...", "Studies show..."
- NEVER use meaningless brackets: "[1]", "[source]", "[citation needed]"
- NEVER omit source entirely: "Costs dropped 40%" without attribution

Look for patterns in research: "According to [Source]", "per [Report]", citations, footnotes, author attributions

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
- BAD: "EXECUTIVE SUMMARY", "KEY POINTS", "OVERVIEW", "KEY FINDINGS", "COST ANALYSIS", "IMPORTANT FACTORS"
- GOOD: "MARGIN EROSION", "Q3 DEADLINE", "73% CHURN RISK", "COST WINDOW CLOSING", "ADOPTION LAG WIDENS"

COMPLETE SLIDE EXAMPLES (STUDY THESE):

EXAMPLE - POOR SLIDE (don't do this):
{
  tagline: "CDM OVERVIEW",
  title: "Common\\nData\\nModel",
  paragraph1: "CDM is a data model used in financial services. It helps with data reconciliation across different systems. Many banks are considering adoption. The technology has been around for several years and is becoming more important.",
  paragraph2: "Implementation requires careful planning. Organizations should assess their current state. There are various factors to consider. The benefits can be significant for those who adopt early."
}
PROBLEMS: Generic tagline, no sources, no data points, weasel words ("various", "significant"), no insight chain, vague statements

EXAMPLE - GOOD SLIDE (do this):
{
  tagline: "MARGIN COMPRESSION",
  title: "CDM cuts\\ncosts 50%\\nfor rivals",
  paragraph1: "JPMorgan's Q4 2024 CDM deployment slashed reconciliation costs by 50%, according to their Annual Investor Report. This competitive gap compounds as early adopters lock in operational efficiency while manual-process firms hemorrhage $2.3M quarterly on redundant reconciliation workflows. Each quarter of delay widens the unit cost disadvantage by an estimated 8-12%, creating urgency for accelerated adoption timelines.",
  paragraph2: "The Federal Reserve's Economic Data reveals 60% of mid-tier banks haven't initiated CDM pilots, exposing a market where fast followers still capture second-mover advantage. Goldman Sachs and Citi both announced Q1 2025 deployment targets, signaling industry consensus on CDM's strategic necessity. Organizations without active CDM roadmaps by Q2 2025 risk permanent cost structure disadvantage against digitally-transformed competitors."
}
WHY IT WORKS: Insight-driven tagline, sourced data points, complete evidence-insight-implication chains, specific numbers, power verbs ("slashed", "hemorrhage", "exposing"), forward momentum

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
