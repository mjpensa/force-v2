import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, generateSlidesOutlinePrompt, generateSpeakerNotesPrompt, generateSpeakerNotesOutlinePrompt, slidesSchema, slidesOutlineSchema, speakerNotesSchema, speakerNotesOutlineSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema } from './prompts/research-analysis.js';
import { generateIntelligenceBriefPrompt, intelligenceBriefSchema } from './prompts/intelligence-brief.js';
import { CONFIG } from './config.js';

// Initialize Gemini API (using API_KEY from environment to match server/config.js)
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Timeout configuration for AI generation
const GENERATION_TIMEOUT_MS = 360000; // 6 minutes - increased for complex content and API variability

// ============================================================================
// REQUEST QUEUE - Controls concurrent API calls to prevent overload
// ============================================================================

/**
 * API Request Queue with controlled concurrency
 * Prevents overwhelming the Gemini API with too many simultaneous requests
 */
class APIQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }
  async add(task, name = 'unknown') {
    if (this.running >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
    try {
      const result = await task();
      return result;
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
  async runAll(tasks) {
    return Promise.all(tasks.map(({ task, name }) => this.add(task, name)));
  }
}

// Global API queue instance - max 4 concurrent Gemini API calls
const apiQueue = new APIQueue(4);

/**
 * Generation config presets for different content types
 *
 * GEMINI 2.5 FLASH OPTIMIZED SETTINGS (gemini-2.5-flash-preview-09-2025):
 * - thinkingBudget: 0 (disabled), -1 (dynamic/auto), or 128-24576 tokens
 * - temperature: 0.0-2.0 (default 1.0; lower for structured, higher for creative)
 * - topP: 0.0-1.0 (default 0.95)
 * - topK: FIXED at 64 for Gemini 2.5 Flash - NOT CONFIGURABLE (removed from configs)
 * - Billing: thinking tokens + output tokens combined
 *
 * TASK COMPLEXITY GUIDELINES:
 * - Simple (facts, classification): thinkingBudget = 0
 * - Medium (comparisons, summaries): thinkingBudget = 1024-4096
 * - Complex (analysis, reasoning): thinkingBudget = 8192-24576
 */

const DOCUMENT_CONFIG = {
  temperature: 0.65,       // Balanced for reasoning diversity
  topP: 0.9,               // High: allows diverse token selection for engaging prose
  topK: 40,                // Standard: good vocabulary breadth
  thinkingBudget: 20000    // High: 7-step COT reasoning, exec summary synthesis, counterargument development
};

const STRUCTURED_DEFAULT_CONFIG = {
  thinkingBudget: 0        // Disabled for simple structured output
};

const ROADMAP_CONFIG = {
  temperature: 0.1,        // Very low: deterministic rule-following
  topP: 0.5,               // Moderate constraint for consistent output
  topK: 20,                // Limited exploration for predictability
  thinkingBudget: 1024     // Light: enables date/overlap logic reasoning without slowing generation
};

const RESEARCH_ANALYSIS_CONFIG = {
  temperature: 0.4,        // Slightly higher: allows discovery of non-obvious insights
  topP: 0.75,              // Broader token selection for nuanced interpretation
  topK: 30,                // Moderate vocabulary for varied recommendations
  thinkingBudget: 8192     // ENABLED: Critical first-pass analysis - extracts sources, stats, themes that feed ALL downstream. Deep thinking here prevents garbage-in-garbage-out.
};

const SLIDES_CONFIG = {
  temperature: 0.55,       // Slightly lower: more precise execution of outline
  topP: 0.85,              // Focused selection while maintaining engagement
  thinkingBudget: 12000    // Increased: needs to execute outline faithfully, maintain evidence chains, format titles correctly
};

const SLIDES_OUTLINE_CONFIG = {
  temperature: 0.35,       // Strategic: structured with room for insightful framing
  topP: 0.75,              // Balanced: consistent structure with varied analytical perspectives
  thinkingBudget: 20000    // Maximum: Critical planning pass - analytical frameworks, evidence chain design, narrative arc, slide-level structure. Sets the ceiling for slides quality.
};

const SPEAKER_NOTES_CONFIG = {
  temperature: 0.55,       // Slightly higher: natural conversational tone for verbatim talking points
  topP: 0.88,              // Broad variety for engaging delivery cues and Q&A responses
  thinkingBudget: 6000     // Reduced for speed: outline already did heavy reasoning, this pass executes the plan
};

const SPEAKER_NOTES_OUTLINE_CONFIG = {
  temperature: 0.35,       // Low but allows strategic creativity in pushback anticipation
  topP: 0.75,              // Focused but not overly constrained for evidence chain discovery
  thinkingBudget: 8000     // Reduced for speed: focused reasoning on key evidence chains and narrative structure
};

const INTELLIGENCE_BRIEF_CONFIG = {
  temperature: 0.5,        // Balanced: precise synthesis with room for insightful connections
  topP: 0.85,              // Broad enough for varied talking points
  topK: 40,                // Standard vocabulary breadth
  thinkingBudget: 8192     // Medium-high: needs to synthesize multiple sources, anticipate questions, structure meeting flow
};

// ============================================================================
// SWIMLANE EXTRACTION - Extracts topic swimlanes from roadmap for document alignment
// ============================================================================

/**
 * Extract swimlane topics from roadmap data for document section alignment
 * @param {object} roadmapData - Generated roadmap data with data array
 * @returns {Array<{name: string, entity: string, taskCount: number}>} Swimlane topics
 */
function extractSwimlanesFromRoadmap(roadmapData) {
  if (!roadmapData?.data) return [];

  const swimlanes = [];
  let currentSwimlane = null;
  let taskCount = 0;

  for (const row of roadmapData.data) {
    if (row.isSwimlane) {
      // Save previous swimlane with its task count
      if (currentSwimlane) {
        swimlanes.push({ ...currentSwimlane, taskCount });
      }
      currentSwimlane = { name: row.title, entity: row.entity };
      taskCount = 0;
    } else if (currentSwimlane) {
      // Count tasks under current swimlane
      taskCount++;
    }
  }

  // Don't forget the last swimlane
  if (currentSwimlane) {
    swimlanes.push({ ...currentSwimlane, taskCount });
  }

  console.log(`[Swimlane Extraction] Found ${swimlanes.length} swimlanes:`, swimlanes.map(s => s.name));
  return swimlanes;
}

// ============================================================================
// OUTLINE RECONCILIATION - Aligns auto-detected outline sections with roadmap swimlanes
// ============================================================================

/**
 * Reconcile outline sections with authoritative swimlanes from roadmap.
 * The outline is generated in parallel with the roadmap (before swimlanes are available),
 * so it may have auto-detected sections that don't match the roadmap's entity swimlanes.
 * This function forces alignment while preserving the outline's reasoning and evidence chains.
 *
 * PRESERVES: reasoning object, primaryFramework, keyEvidenceChains, narrativeArcs
 * REPLACES: section swimlane names with authoritative swimlane names from roadmap
 *
 * @param {object} outline - Outline from generateSlidesOutlineOnly (may have auto-detected sections)
 * @param {Array<{name: string, entity: string, taskCount: number}>} swimlanes - Authoritative swimlanes from roadmap
 * @returns {object} Reconciled outline with correct section structure
 */
function reconcileOutlineWithSwimlanes(outline, swimlanes) {
  if (!outline || !swimlanes || swimlanes.length === 0) {
    return outline;
  }

  const augmentedSwimlanes = [
    { name: "Overview", taskCount: 0, isFixed: true },
    ...swimlanes,
    { name: "Conclusion", taskCount: 0, isFixed: true }
  ];

  const outlineSections = outline.sections || [];
  console.log(`[Outline Reconciliation] Input: ${outlineSections.length} outline sections, ${augmentedSwimlanes.length} target swimlanes`);

  // Extract Overview and Conclusion from outline if they exist
  const overviewSection = outlineSections.find(s =>
    s.swimlane?.toLowerCase() === 'overview'
  );
  const conclusionSection = outlineSections.find(s =>
    s.swimlane?.toLowerCase() === 'conclusion'
  );

  // Get middle sections (excluding Overview/Conclusion)
  const middleOutlineSections = outlineSections.filter(s =>
    s.swimlane?.toLowerCase() !== 'overview' &&
    s.swimlane?.toLowerCase() !== 'conclusion'
  );
  const middleSwimlanes = augmentedSwimlanes.filter(s => !s.isFixed);

  // Build reconciled sections
  const reconciledSections = [];

  // 1. Overview section (use outline's or create default)
  reconciledSections.push({
    swimlane: "Overview",
    narrativeArc: overviewSection?.narrativeArc ||
      "Context establishes urgency → Key themes previewed → Sets up detailed analysis",
    slides: overviewSection?.slides || createDefaultSlideBlueprints("Overview", 4)
  });

  // 2. Entity sections from roadmap swimlanes
  for (let i = 0; i < middleSwimlanes.length; i++) {
    const targetSwimlane = middleSwimlanes[i];

    // Try to find matching section in outline (fuzzy match by name)
    const matchingSection = middleOutlineSections.find(os =>
      os.swimlane?.toLowerCase().includes(targetSwimlane.name.toLowerCase()) ||
      targetSwimlane.name.toLowerCase().includes(os.swimlane?.toLowerCase())
    ) || middleOutlineSections[i]; // Fall back to index-based matching

    reconciledSections.push({
      swimlane: targetSwimlane.name, // FORCE the correct swimlane name from roadmap
      narrativeArc: matchingSection?.narrativeArc ||
        `${targetSwimlane.name} analysis reveals key insights → Evidence compounds urgency → Strategic implications emerge`,
      slides: matchingSection?.slides || createDefaultSlideBlueprints(targetSwimlane.name, 5)
    });
  }

  // 3. Conclusion section (use outline's or create default)
  reconciledSections.push({
    swimlane: "Conclusion",
    narrativeArc: conclusionSection?.narrativeArc ||
      "Synthesis of insights → Strategic implications → Actionable recommendations",
    slides: conclusionSection?.slides || createDefaultSlideBlueprints("Conclusion", 4)
  });

  console.log(`[Outline Reconciliation] Output: ${reconciledSections.length} sections: ${reconciledSections.map(s => s.swimlane).join(', ')}`);

  return {
    reasoning: outline.reasoning, // Preserve all reasoning from original outline
    sections: reconciledSections
  };
}

/**
 * Create default slide blueprints when outline is missing a section.
 * These blueprints provide minimal structure for the full slides generation.
 * @param {string} sectionName - Name of the section
 * @param {number} count - Number of slides to create
 * @returns {Array} Array of slide blueprints with basic structure
 */
function createDefaultSlideBlueprints(sectionName, count) {
  return Array.from({ length: count }, (_, i) => ({
    tagline: "KEY INSIGHT",
    keyDataPoint: `Key data point for ${sectionName} slide ${i + 1}`,
    analyticalLens: "COMPETITIVE_DYNAMICS",
    connectsTo: i < count - 1
      ? `This insight leads to the next aspect of ${sectionName}`
      : "This conclusion sets up the following section"
  }));
}

/**
 * Validate executive summary quality
 * Enhanced validation with narrative energy, evidence density, and source quality checks
 * Returns { valid: boolean, issues: string[] }
 */
function validateExecutiveSummary(execSummary) {
  const issues = [];

  // Handle both object and string formats (updated for new schema: situation, insight, action)
  const text = typeof execSummary === 'object'
    ? `${execSummary.situation || ''} ${execSummary.insight || ''} ${execSummary.action || ''}`
    : execSummary || '';

  // Check for quantified data
  const hasNumber = /\d+/.test(text);
  if (!hasNumber) {
    issues.push('Missing quantified data point');
  }

  // Check for action language
  const hasAction = /(recommend|approve|launch|initiate|authorize|implement|hire|invest|prioritize|execute|deploy|expand|reduce|increase|allocate|greenlight)/i.test(text);
  if (!hasAction) {
    issues.push('Missing actionable recommendation');
  }

  // Check minimum substance (not too short)
  const minLength = typeof execSummary === 'object' ? 100 : 150;
  if (text.length < minLength) {
    issues.push(`Too short (${text.length} chars, need ${minLength}+)`);
  }

  // Check for weak openers (anti-patterns) - but allow strong openers that happen to start with weak words
  const weakOpeners = /^(this|the|our|in today|as we|it is|there (is|are|has|have))/i;
  const strongOpenerPatterns = [
    /^[A-Z][a-zA-Z]+\s+(deployed|launched|announced|achieved|cut|reduced|eliminated|increased|acquired)/i,  // "JPMorgan deployed..."
    /^\d+[%xMBK]?[.,]?\s/,              // "60%. That's..."
    /^\$[\d,.]+[MBK]?/,                 // "$2.3M..."
    /^Q[1-4]\s+20\d{2}/i,               // "Q1 2025..."
    /^(On|In)\s+[A-Z][a-z]+\s+\d/       // "On March 15..."
  ];
  const firstSentence = typeof execSummary === 'object'
    ? execSummary.situation
    : text.split(/[.!?]/)[0];
  const trimmedFirst = firstSentence?.trim() || '';
  const hasStrongOpening = strongOpenerPatterns.some(p => p.test(trimmedFirst));
  const hasWeakOpening = weakOpeners.test(trimmedFirst);
  if (hasWeakOpening && !hasStrongOpening) {
    issues.push('Weak opening detected');
  }

  // Check for weasel words
  const weaselWords = /(significant|substantial|considerable|various|many|some|often|generally)/i;
  if (weaselWords.test(text)) {
    issues.push('Contains vague weasel words');
  }

  // Check for narrative energy markers (contrast/escalation words)
  const contrastWords = /(while|however|yet|but|whereas|although|despite)/i;
  const escalationWords = /(moreover|critically|furthermore|notably|increasingly)/i;
  if (!contrastWords.test(text) && !escalationWords.test(text)) {
    issues.push('Missing narrative energy markers (contrast/escalation)');
  }

  // Evidence density check - allow high-impact single data points to count as 2
  if (typeof execSummary === 'object') {
    const situationInsight = `${execSummary.situation || ''} ${execSummary.insight || ''}`;
    const dataPointMatches = situationInsight.match(/\d+\.?\d*\s*%|\$\d[\d,]*\.?\d*[MBK]?|Q[1-4]\s*20\d{2}|\d+x\b/gi) || [];
    // High-impact data points (large dollar amounts $XM/B or significant percentages 20%+)
    const highImpactMatches = situationInsight.match(/\$\d{1,3}(?:,\d{3})*\.?\d*[MB]|\d{2,}%/gi) || [];
    const effectiveDataPoints = dataPointMatches.length + (highImpactMatches.length > 0 ? 1 : 0);
    if (effectiveDataPoints < 2) {
      issues.push(`Low evidence density (${dataPointMatches.length} data points, need 2+)`);
    }
  }

  // NEW: Insight depth check - look for "so what" causal language
  if (typeof execSummary === 'object' && execSummary.insight) {
    const insightDepthPatterns = /(means that|implies|resulting in|translates to|equates to|represents|costs?|gap|disadvantage|risk|at stake|widening|compounds)/i;
    if (!insightDepthPatterns.test(execSummary.insight)) {
      issues.push('Insight lacks depth language (missing causal/impact connection)');
    }
  }

  // NEW: Source quality check - ensure it's not a filename
  if (typeof execSummary === 'object' && execSummary.source) {
    const badSourcePatterns = /\.(md|txt|pdf|docx|doc|xlsx|csv)$/i;
    const genericSourcePatterns = /^(research|document|file|data|upload|input)/i;
    if (badSourcePatterns.test(execSummary.source) || genericSourcePatterns.test(execSummary.source)) {
      issues.push('Source appears to be filename rather than authoritative source');
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validate reasoning coherence between reasoning object and executive summary
 * Ensures the model's chain-of-thought reasoning is reflected in the output
 * @param {object} reasoning - The reasoning object from document data
 * @param {object} executiveSummary - The executive summary object
 * @returns {{ coherent: boolean, issues: string[] }}
 */
function validateReasoningCoherence(reasoning, executiveSummary) {
  const issues = [];

  if (!reasoning || !executiveSummary) {
    return { coherent: false, issues: ['Missing reasoning or executiveSummary object'] };
  }

  // 1. Check that insight references stakesQuantified
  if (reasoning.stakesQuantified && executiveSummary.insight) {
    const stakesNumbers = reasoning.stakesQuantified.match(/\$[\d,.]+[MBK]?|\d+\.?\d*%/gi) || [];
    const insightNumbers = executiveSummary.insight.match(/\$[\d,.]+[MBK]?|\d+\.?\d*%/gi) || [];
    if (stakesNumbers.length > 0 && insightNumbers.length === 0) {
      issues.push('Insight lacks quantified data from reasoning.stakesQuantified');
    }
  }

  // 2. Check that tensionPoint aligns with tensionAnalysis
  if (reasoning.tensionAnalysis && executiveSummary.tensionPoint) {
    const keywords = reasoning.tensionAnalysis.toLowerCase()
      .match(/\b(cost|competitive|compliance|risk|pressure|delay|resource|gap|deadline|regulatory)\b/gi) || [];
    const hasAlignment = keywords.some(k =>
      executiveSummary.tensionPoint.toLowerCase().includes(k.toLowerCase())
    );
    if (keywords.length > 0 && !hasAlignment) {
      issues.push('TensionPoint does not reflect tensionAnalysis themes');
    }
  } else if (reasoning.tensionAnalysis && !executiveSummary.tensionPoint) {
    issues.push('Missing tensionPoint despite tensionAnalysis in reasoning');
  }

  // 3. Check that action has role and deadline
  if (executiveSummary.action) {
    const hasRole = /\b(cto|cfo|ceo|coo|cio|director|vp|head|chief|board|leadership|team)\b/i.test(executiveSummary.action);
    const hasDeadline = /\b(q[1-4]\s*20\d{2}|by\s+(january|february|march|april|may|june|july|august|september|october|november|december)|20\d{2})\b/i.test(executiveSummary.action);
    if (!hasRole) {
      issues.push('Action missing clear role assignment');
    }
    if (!hasDeadline) {
      issues.push('Action missing deadline/timeline');
    }
  }

  // 4. Check that evidenceChain references keyDataPoints
  if (reasoning.keyDataPoints && Array.isArray(reasoning.keyDataPoints) && reasoning.keyDataPoints.length >= 3 &&
      executiveSummary.evidenceChain && Array.isArray(executiveSummary.evidenceChain) && executiveSummary.evidenceChain.length > 0) {
    const keyNumbers = reasoning.keyDataPoints.join(' ').match(/\d+\.?\d*/g) || [];
    const evidenceNumbers = executiveSummary.evidenceChain
      .map(e => e.dataPoint || '').join(' ').match(/\d+\.?\d*/g) || [];
    const overlap = keyNumbers.filter(n => evidenceNumbers.includes(n));
    if (overlap.length === 0) {
      issues.push('EvidenceChain does not reference keyDataPoints from reasoning');
    }
  }

  return {
    coherent: issues.length === 0,
    issues
  };
}

/**
 * Validate individual section quality
 * Checks for insight-driven headings, evidence presence, and analytical balance
 * @param {object} section - Section object from document
 * @param {number} sectionIndex - Index of section for error messages
 * @returns {string[]} Array of issue strings
 */
function validateSectionQuality(section, sectionIndex) {
  const issues = [];
  const sectionId = `Section ${sectionIndex + 1} "${section.heading || 'untitled'}"`;

  // Check heading is insight-driven, not topic label
  const genericHeadings = /^(overview|introduction|summary|analysis|background|conclusion|section\s*\d|topic|area|focus)/i;
  if (genericHeadings.test(section.heading?.trim() || '')) {
    issues.push(`${sectionId}: Generic heading (should lead with insight)`);
  }

  // Check paragraphs have quantified evidence
  const allParagraphs = (section.paragraphs || []).join(' ');
  if (!/\d+/.test(allParagraphs)) {
    issues.push(`${sectionId}: No quantified data in paragraphs`);
  }

  // Check supporting evidence exists and has minimum count
  if (!section.supportingEvidence || section.supportingEvidence.length < 2) {
    issues.push(`${sectionId}: Insufficient supporting evidence (need 2+, have ${section.supportingEvidence?.length || 0})`);
  }

  // Check for weasel words in paragraphs
  const weaselWords = /(significant|substantial|considerable|various|many|some|often|generally)/i;
  if (weaselWords.test(allParagraphs)) {
    issues.push(`${sectionId}: Contains vague weasel words`);
  }

  return issues;
}

/**
 * Calculate quality score for document content
 * Returns overall score (0-100), breakdown by category, and warnings
 * @param {object} documentData - Generated document data
 * @returns {{ overall: number, breakdown: object, warnings: string[], rating: string }}
 */
function calculateQualityScore(documentData) {
  const breakdown = {
    opening: 0,      // 15 pts max
    evidence: 0,     // 20 pts max
    insight: 0,      // 20 pts max
    narrative: 0,    // 15 pts max
    counterargument: 0, // 15 pts max
    source: 0        // 15 pts max
  };
  const warnings = [];
  const execSummary = documentData?.executiveSummary || {};
  const sections = documentData?.sections || [];

  // 1. OPENING STRENGTH (15 pts)
  const situation = execSummary.situation || '';
  const strongOpeningPatterns = [
    /^\d+[%xMBK]?[.,]?\s/,              // THE NUMBER: "60%. That's..."
    /^[A-Z][^.]{5,}\s(while|but|yet)\s/i, // THE CONTRAST: "X while Y"
    /^(On|In)\s+[A-Z][a-z]+\s+\d/,      // THE MOMENT: "On March 15..."
    /^What\s+(happens|would|if)/i,       // THE QUESTION: "What happens..."
    /^\$[\d,.]+[MBK]?/,                 // THE STAKES: "$2.3M per quarter..."
    /^Q[1-4]\s+20\d{2}/,                // THE TIMELINE: "Q1 2026:..."
    /^[A-Z][a-zA-Z]+\s+(deployed|launched|announced|achieved|cut|reduced|eliminated|acquired)/i  // THE ACTOR: "JPMorgan deployed..."
  ];
  const hasStrongOpening = strongOpeningPatterns.some(p => p.test(situation.trim()));
  const weakOpeners = /^(this|the|our|in today|as we|it is|there (is|are|has|have))/i;
  const hasWeakOpening = weakOpeners.test(situation.trim());

  if (hasStrongOpening) {
    breakdown.opening = 15;
  } else if (!hasWeakOpening && situation.length > 50) {
    breakdown.opening = 10;
  } else if (hasWeakOpening) {
    breakdown.opening = 3;
    warnings.push('Executive summary uses weak opening pattern');
  } else {
    breakdown.opening = 5;
  }

  // 2. EVIDENCE DENSITY (20 pts)
  const situationInsight = `${execSummary.situation || ''} ${execSummary.insight || ''}`;
  const dataPointPattern = /\d+\.?\d*\s*%|\$\d[\d,]*\.?\d*[MBK]?(?:illion)?|Q[1-4]\s*20\d{2}|\d+x\b|\d{1,3}(?:,\d{3})+/gi;
  const dataPoints = (situationInsight.match(dataPointPattern) || []).length;
  const evidenceChainCount = (execSummary.evidenceChain || []).length;

  if (dataPoints >= 3 && evidenceChainCount >= 2) {
    breakdown.evidence = 20;
  } else if (dataPoints >= 2 && evidenceChainCount >= 1) {
    breakdown.evidence = 15;
  } else if (dataPoints >= 2) {
    breakdown.evidence = 12;
  } else if (dataPoints >= 1) {
    breakdown.evidence = 8;
    warnings.push(`Low evidence density (${dataPoints} data points in executive summary)`);
  } else {
    breakdown.evidence = 3;
    warnings.push('Executive summary lacks quantified data points');
  }

  // 3. INSIGHT DEPTH (20 pts)
  const insight = execSummary.insight || '';
  const insightDepthPatterns = [
    /(means that|implies|resulting in|translates to|equates to)/i,
    /(costs?|gap|disadvantage|risk|at stake)/i,
    /(widening|compounds|accelerat|trajectory)/i,
    /\$[\d,.]+[MBK]?/  // Dollar amounts in insight
  ];
  const insightPatternMatches = insightDepthPatterns.filter(p => p.test(insight)).length;

  if (insightPatternMatches >= 3) {
    breakdown.insight = 20;
  } else if (insightPatternMatches >= 2) {
    breakdown.insight = 15;
  } else if (insightPatternMatches >= 1) {
    breakdown.insight = 10;
  } else {
    breakdown.insight = 5;
    warnings.push('Insight lacks causal/impact language (missing "so what" connection)');
  }

  // 4. NARRATIVE ENERGY (15 pts)
  const allText = `${execSummary.situation || ''} ${execSummary.insight || ''} ${execSummary.tensionPoint || ''}`;
  const contrastWords = /(while|however|yet|but|whereas|although|despite)/i;
  const escalationWords = /(moreover|critically|furthermore|notably|increasingly|widening|accelerating)/i;
  const hasContrast = contrastWords.test(allText);
  const hasEscalation = escalationWords.test(allText);
  const hasTensionPoint = execSummary.tensionPoint && execSummary.tensionPoint.length > 20;

  if (hasContrast && hasEscalation && hasTensionPoint) {
    breakdown.narrative = 15;
  } else if ((hasContrast || hasEscalation) && hasTensionPoint) {
    breakdown.narrative = 12;
  } else if (hasContrast || hasEscalation) {
    breakdown.narrative = 8;
  } else {
    breakdown.narrative = 4;
    warnings.push('Missing narrative energy markers (contrast/escalation words)');
  }

  // 5. COUNTERARGUMENT QUALITY (15 pts)
  const sectionsWithCounterarguments = sections.filter(s => s.counterargument && s.counterargument.length > 50);
  const genericCounterarguments = /(may not|could be|might face|some may argue|potential challenges)/i;
  const specificCounterarguments = sectionsWithCounterarguments.filter(s => !genericCounterarguments.test(s.counterargument));
  const counterargumentRatio = sections.length > 0 ? specificCounterarguments.length / sections.length : 0;

  if (counterargumentRatio >= 0.8) {
    breakdown.counterargument = 15;
  } else if (counterargumentRatio >= 0.5) {
    breakdown.counterargument = 10;
  } else if (sectionsWithCounterarguments.length > 0) {
    breakdown.counterargument = 6;
    warnings.push(`Only ${sectionsWithCounterarguments.length}/${sections.length} sections have substantive counterarguments`);
  } else {
    breakdown.counterargument = 2;
    warnings.push('Sections lack counterarguments (missing analytical rigor)');
  }

  // 6. SOURCE QUALITY (15 pts) - ratio-based scoring for evidence chain
  const source = execSummary.source || '';
  const badSourcePatterns = /\.(md|txt|pdf|docx|doc|xlsx|csv)$/i;
  const genericSourcePatterns = /^(research|document|file|data|upload|input|source)/i;
  const authoritativePatterns = /(report|analysis|study|survey|publication|filing|data|institute|research)/i;

  const isFilename = badSourcePatterns.test(source) || genericSourcePatterns.test(source);
  const isAuthoritative = authoritativePatterns.test(source) && source.length > 10;

  // Calculate ratio of valid sources in evidence chain (not all-or-nothing)
  const evidenceChain = execSummary.evidenceChain || [];
  const validSourceCount = evidenceChain.filter(e => {
    const src = e.source || '';
    return src.length > 5 &&
           !badSourcePatterns.test(src) &&
           !genericSourcePatterns.test(src);
  }).length;
  const sourceRatio = evidenceChain.length > 0 ? validSourceCount / evidenceChain.length : 0;

  if (!isFilename && isAuthoritative && sourceRatio >= 0.8) {
    breakdown.source = 15;
  } else if (!isFilename && isAuthoritative && sourceRatio >= 0.5) {
    breakdown.source = 12;
  } else if (!isFilename && sourceRatio >= 0.5) {
    breakdown.source = 10;
  } else if (!isFilename && source.length > 10) {
    breakdown.source = 8;
  } else if (isFilename) {
    breakdown.source = 2;
    warnings.push('Source appears to be filename rather than authoritative source');
  } else {
    breakdown.source = 5;
  }

  if (sourceRatio < 0.8 && evidenceChain.length > 0) {
    warnings.push(`Only ${Math.round(sourceRatio * 100)}% of evidence chain entries have valid sources`);
  }

  // Calculate overall score
  const overall = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  // Determine rating
  let rating;
  if (overall >= 85) rating = 'Excellent';
  else if (overall >= 70) rating = 'Good';
  else if (overall >= 50) rating = 'Needs Improvement';
  else rating = 'Poor';

  return { overall, breakdown, warnings, rating };
}

/**
 * Validate slide content quality (logging only, no retry)
 * Checks for analytical rigor and narrative energy markers
 * @param {object} slidesData - Generated slides object with sections structure
 * @returns {{ valid: boolean, issues: string[] }}
 */
function validateSlideQuality(slidesData) {
  const issues = [];

  if (!slidesData?.sections || !Array.isArray(slidesData.sections)) {
    return { valid: false, issues: ['Invalid slides structure - missing sections array'] };
  }

  let slideIndex = 0;
  for (const section of slidesData.sections) {
    const sectionName = section.swimlane || 'Unknown Section';
    const isFixedSection = sectionName === 'Overview' || sectionName === 'Conclusion';
    const minSlides = isFixedSection ? 4 : 1;

    if (!section.slides || section.slides.length < minSlides) {
      issues.push(`Section "${sectionName}": ${section.slides?.length || 0} slides generated (minimum ${minSlides} required)`);
      continue;
    }

    // Section-level validation: Check sub-topic uniqueness
    const subTopics = new Set();
    const duplicateSubTopics = [];
    for (const slide of section.slides) {
      const subTopic = slide.subTopic?.trim();
      if (subTopic) {
        if (subTopics.has(subTopic.toLowerCase())) {
          duplicateSubTopics.push(subTopic);
        } else {
          subTopics.add(subTopic.toLowerCase());
        }
      }
    }
    if (duplicateSubTopics.length > 0) {
      issues.push(`Section "${sectionName}": Duplicate subTopics found: ${duplicateSubTopics.join(', ')}`);
    }

    // Section-level validation: Check layout variety (target 30-60% threeColumn)
    const threeColumnCount = section.slides.filter(s => s.layout === 'threeColumn').length;
    const totalSlides = section.slides.length;
    if (totalSlides >= 3) { // Only check variety for sections with 3+ slides
      const threeColumnRatio = threeColumnCount / totalSlides;
      if (threeColumnRatio < 0.2) {
        issues.push(`Section "${sectionName}": Low layout variety - only ${Math.round(threeColumnRatio * 100)}% threeColumn (target 30-60%)`);
      } else if (threeColumnRatio > 0.7) {
        issues.push(`Section "${sectionName}": Excessive threeColumn - ${Math.round(threeColumnRatio * 100)}% (target 30-60%)`);
      }
    }

    // Individual slide validation
    for (const slide of section.slides) {
      slideIndex++;
      const slideId = `Section "${sectionName}" Slide ${slideIndex} "${slide.tagline || 'untitled'}"`;
      validateSingleSlide(slide, slideId, issues);
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate a single slide's content quality
 * @param {object} slide - Single slide object
 * @param {string} slideId - Identifier for error messages
 * @param {string[]} issues - Array to push issues to
 */
function validateSingleSlide(slide, slideId, issues) {
  const allText = `${slide.paragraph1 || ''} ${slide.paragraph2 || ''} ${slide.paragraph3 || ''}`;

  // Check for missing paragraph3 on threeColumn slides (causes empty third column)
  if (slide.layout === 'threeColumn' && !slide.paragraph3?.trim()) {
    issues.push(`${slideId}: threeColumn layout requires paragraph3`);
  }

  // Check for quantified data
  if (!/\d+/.test(allText)) {
    issues.push(`${slideId}: Missing quantified data point`);
  }

  // Check for weak openers
  if (/^(This|The|Our|In today|As we|It is|There (is|are))/i.test(slide.paragraph1?.trim() || '')) {
    issues.push(`${slideId}: Weak opening detected`);
  }

  // Check for weasel words
  if (/(significant|substantial|considerable|various|many|some|often|generally)/i.test(allText)) {
    issues.push(`${slideId}: Contains vague weasel words`);
  }

  // Check for topic-label taglines (expanded blocklist)
  const genericTaglines = /^(OVERVIEW|INTRODUCTION|SUMMARY|ANALYSIS|BACKGROUND|CONCLUSION|KEY FINDINGS|KEY POINTS|CRITICAL POINTS|IMPORTANT FACTORS|COST ANALYSIS|EXECUTIVE SUMMARY)$/i;
  if (genericTaglines.test(slide.tagline?.trim() || '')) {
    issues.push(`${slideId}: Generic tagline "${slide.tagline}" (should signal insight, not topic)`);
  }

  // Check for source citations
  if (!/\[.*?\]/.test(allText) && !/(according to|reveals|shows)/i.test(allText)) {
    issues.push(`${slideId}: No apparent source citation`);
  }

  // Validate title line count (must be exactly 3 or 4 lines = 2 or 3 \n separators)
  const title = slide.title || '';
  const separatorCount = (title.match(/\n/g) || []).length;
  if (separatorCount < 2 || separatorCount > 3) {
    const lineCount = separatorCount + 1;
    issues.push(`${slideId}: Title has ${lineCount} lines (need 3-4). Title: "${title.replace(/\n/g, '\\n')}"`);
  }

  // Validate title line lengths based on layout
  const maxLineLength = slide.layout === 'threeColumn' ? 18 : 10;
  const titleLines = title.split('\n');
  for (let i = 0; i < titleLines.length; i++) {
    if (titleLines[i].length > maxLineLength) {
      issues.push(`${slideId}: Title line ${i + 1} too long (${titleLines[i].length} chars, max ${maxLineLength}): "${titleLines[i]}"`);
    }
  }

  // Validate individual word lengths in title (long words break narrow columns)
  // Max 9 chars for twoColumn (narrow), 12 chars for threeColumn (slightly wider)
  const maxWordLength = slide.layout === 'threeColumn' ? 12 : 9;
  const titleWords = title.replace(/\n/g, ' ').split(/\s+/).filter(w => w);
  for (const word of titleWords) {
    if (word.length > maxWordLength) {
      issues.push(`${slideId}: Title word too long (${word.length} chars, max ${maxWordLength}): "${word}" - use shorter synonym`);
    }
  }
}

/**
 * Validate outline structure before Pass 2 generation
 * Ensures reasoning object is complete and sections align with swimlanes
 * @param {object} outline - Generated outline from Pass 1
 * @param {Array} swimlanes - Swimlane topics from roadmap
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateOutlineStructure(outline, swimlanes) {
  const errors = [];

  // Check reasoning object completeness
  if (!outline.reasoning) errors.push('Missing reasoning object');
  if (!outline.reasoning?.primaryFramework) errors.push('Missing primaryFramework');
  if (!outline.reasoning?.keyEvidenceChains?.length) errors.push('Missing keyEvidenceChains');
  if (outline.reasoning?.keyEvidenceChains?.length < 3) {
    errors.push(`Only ${outline.reasoning?.keyEvidenceChains?.length || 0} evidence chains (need 3+)`);
  }

  // Check sections match swimlanes
  if (!outline.sections || !Array.isArray(outline.sections)) {
    errors.push('Missing or invalid sections array');
  }
  if (swimlanes.length > 0 && outline.sections?.length !== swimlanes.length) {
    errors.push(`Swimlane mismatch: ${swimlanes.length} swimlanes but ${outline.sections?.length} sections`);
  }

  // Validate each section has required fields
  const validLenses = ['SECOND_ORDER_EFFECTS', 'CONTRARIAN', 'COMPETITIVE_DYNAMICS',
                       'TEMPORAL_ARBITRAGE', 'RISK_ASYMMETRY', 'CAUSAL_CHAIN'];
  for (const section of (outline.sections || [])) {
    const sectionName = section.swimlane || 'Unknown';
    if (!section.narrativeArc) errors.push(`Section "${sectionName}": missing narrativeArc`);
    if (!section.slides?.length) errors.push(`Section "${sectionName}": no slides defined`);

    for (const slide of (section.slides || [])) {
      if (slide.analyticalLens && !validLenses.includes(slide.analyticalLens)) {
        errors.push(`Section "${sectionName}": invalid analyticalLens "${slide.analyticalLens}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate framework consistency between outline and final slides
 * Checks that primaryFramework from outline is reflected in slide content
 * @param {object} outline - Generated outline from Pass 1
 * @param {object} slidesData - Generated slides from Pass 2
 * @returns {{ valid: boolean, issues: string[], consistency: number }}
 */
function validateFrameworkConsistency(outline, slidesData) {
  const issues = [];
  const primaryFramework = outline?.reasoning?.primaryFramework;

  if (!primaryFramework) return { valid: true, issues: [], consistency: 100 };

  // Framework signature patterns to detect in slide text
  const frameworkPatterns = {
    'SECOND_ORDER_EFFECTS': /(?:trigger|follow|downstream|result in|which means|then|in turn)/i,
    'CONTRARIAN': /(?:obvious|conventional|however|but|reveals|surprising|counter to|expected)/i,
    'COMPETITIVE_DYNAMICS': /(?:competitor|market|first-mover|gap|edge|positioning|competitive)/i,
    'TEMPORAL_ARBITRAGE': /(?:front-load|compound|future|short-term|long-term|delayed|invest now)/i,
    'RISK_ASYMMETRY': /(?:asymmetric|bounded|unlimited|downside|upside|cap|limited risk)/i,
    'CAUSAL_CHAIN': /(?:because|cause|root|trigger|leads to|directly)/i
  };

  let frameworkMatches = 0;
  let totalAnalyticalSlides = 0;

  for (const section of slidesData?.sections || []) {
    for (const slide of section.slides || []) {
      totalAnalyticalSlides++;
      const allText = `${slide.paragraph1 || ''} ${slide.paragraph2 || ''} ${slide.paragraph3 || ''}`;

      if (frameworkPatterns[primaryFramework]?.test(allText)) {
        frameworkMatches++;
      }
    }
  }

  const consistency = totalAnalyticalSlides > 0
    ? Math.round((frameworkMatches / totalAnalyticalSlides) * 100)
    : 0;

  if (consistency < 50) {
    issues.push(`Primary framework "${primaryFramework}" detected in only ${consistency}% of slides (target: 50%+)`);
  }

  return { valid: issues.length === 0, issues, consistency };
}

/**
 * Validate that key evidence chains from outline appear in final slides
 * @param {object} outline - Generated outline from Pass 1
 * @param {object} slidesData - Generated slides from Pass 2
 * @returns {{ valid: boolean, issues: string[], usedChains: number, totalChains: number, coverage: number }}
 */
function validateEvidenceChainUsage(outline, slidesData) {
  const issues = [];
  const keyChains = outline?.reasoning?.keyEvidenceChains || [];

  if (keyChains.length === 0) return { valid: true, issues: [], usedChains: 0, totalChains: 0, coverage: 100 };

  // Extract all slide text
  let allSlideText = '';
  for (const section of slidesData?.sections || []) {
    for (const slide of section.slides || []) {
      allSlideText += ` ${slide.paragraph1 || ''} ${slide.paragraph2 || ''} ${slide.paragraph3 || ''}`;
    }
  }
  allSlideText = allSlideText.toLowerCase();

  // Check each key evidence chain
  let usedChains = 0;
  const missingChains = [];

  for (const chain of keyChains) {
    // Extract key numbers/terms from evidence (percentages, dollar amounts, quarters)
    const evidence = chain.evidence || '';
    const evidenceTerms = evidence.match(/\d+%|\$[\d.]+[MBK]?|Q[1-4]\s*20\d{2}|\d{2,}/gi) || [];

    // Check if any key term appears in slides
    const hasEvidence = evidenceTerms.some(term => allSlideText.includes(term.toLowerCase()));

    // Also check for key concept words (first 3-4 significant words)
    const conceptWords = evidence.split(/\s+/).slice(0, 4).filter(w => w.length > 4);
    const hasConceptMatch = conceptWords.some(word =>
      allSlideText.includes(word.toLowerCase())
    );

    if (hasEvidence || hasConceptMatch) {
      usedChains++;
    } else {
      missingChains.push(evidence.substring(0, 50) + (evidence.length > 50 ? '...' : ''));
    }
  }

  const coverage = Math.round((usedChains / keyChains.length) * 100);

  if (coverage < 60) {
    issues.push(`Only ${usedChains}/${keyChains.length} key evidence chains used (${coverage}%, target: 60%+)`);
  }

  return { valid: issues.length === 0, issues, usedChains, totalChains: keyChains.length, coverage, missingChains };
}

function withTimeout(promise, timeoutMs, operationName) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
async function generateWithGemini(prompt, schema, contentType, configOverrides = {}) {
  try {
    console.log(`[${contentType}] Starting generation with model: ${CONFIG.API.GEMINI_MODEL}`);
    const {
      temperature,
      topP,
      topK,
      thinkingBudget = STRUCTURED_DEFAULT_CONFIG.thinkingBudget,
      maxOutputTokens,
      frequencyPenalty,
      presencePenalty
    } = configOverrides;
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema
    };
    if (thinkingBudget > 0) {
      generationConfig.thinkingConfig = { thinkingBudget };
    }
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (topP !== undefined) generationConfig.topP = topP;
    if (topK !== undefined) generationConfig.topK = topK;
    if (maxOutputTokens !== undefined) generationConfig.maxOutputTokens = maxOutputTokens;
    if (frequencyPenalty !== undefined) generationConfig.frequencyPenalty = frequencyPenalty;
    if (presencePenalty !== undefined) generationConfig.presencePenalty = presencePenalty;
    console.log(`[${contentType}] Generation config:`, JSON.stringify({ temperature, topP, topK, thinkingBudget }));
    const model = genAI.getGenerativeModel({
      model: CONFIG.API.GEMINI_MODEL,
      generationConfig
    });
    const result = await withTimeout(
      model.generateContent(prompt),
      GENERATION_TIMEOUT_MS,
      `${contentType} generation`
    );
    const response = result.response;
    const text = response.text();
    console.log(`[${contentType}] Received response, length: ${text.length} chars`);
    try {
      const data = JSON.parse(text);
      console.log(`[${contentType}] Successfully parsed JSON`);
      return data;
    } catch (parseError) {
      console.log(`[${contentType}] JSON parse error: ${parseError.message}`);
      try {
        const repairedJsonText = jsonrepair(text);
        const repairedData = JSON.parse(repairedJsonText);
        console.log(`[${contentType}] Successfully repaired and parsed JSON`);
        return repairedData;
      } catch (repairError) {
        console.log(`[${contentType}] JSON repair also failed`);
        throw parseError; // Throw the original parse error
      }
    }
  } catch (error) {
    console.error(`[${contentType}] Generation failed:`, error.message);
    throw new Error(`Failed to generate ${contentType}: ${error.message}`);
  }
}
async function generateRoadmap(userPrompt, researchFiles) {
  try {
    const prompt = generateRoadmapPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
/**
 * Generate presentation slides with two-pass generation for improved narrative coherence
 * Pass 1: Generate narrative outline (structure, connections, key data points)
 * Pass 2: Generate full slides using outline as constraint
 * @param {string} userPrompt - User's analysis request
 * @param {Array} researchFiles - Research files to analyze
 * @param {Array} swimlanes - Optional swimlane topics from roadmap for section alignment
 */
async function generateSlides(userPrompt, researchFiles, swimlanes = []) {
  try {
    if (swimlanes.length > 0) {
      console.log(`[Slides] Two-pass generation with ${swimlanes.length} swimlane-aligned sections`);
    } else {
      console.log(`[Slides] Two-pass generation (will auto-detect topics)`);
    }

    // Create augmented swimlanes with fixed Overview and Conclusion sections
    const augmentedSwimlanes = [
      { name: "Overview", taskCount: 0, isFixed: true },
      ...swimlanes,
      { name: "Conclusion", taskCount: 0, isFixed: true }
    ];
    console.log(`[Slides] Augmented swimlanes: ${augmentedSwimlanes.length} sections (including Overview and Conclusion)`);

    // Pass 1: Generate narrative outline (fast, structured)
    console.log(`[Slides] Pass 1: Generating narrative outline...`);
    const outlinePrompt = generateSlidesOutlinePrompt(userPrompt, researchFiles, augmentedSwimlanes);
    const outline = await generateWithGemini(outlinePrompt, slidesOutlineSchema, 'SlideOutline', SLIDES_OUTLINE_CONFIG);

    const totalOutlineSlides = outline.sections?.reduce((sum, s) => sum + (s.slides?.length || 0), 0) || 0;
    console.log(`[Slides] Outline generated: ${outline.sections?.length || 0} sections, ${totalOutlineSlides} slide blueprints`);

    // Validate outline structure before proceeding to Pass 2
    const outlineValidation = validateOutlineStructure(outline, augmentedSwimlanes);
    if (!outlineValidation.valid) {
      console.warn('[Slides] Outline validation issues:', outlineValidation.errors);
    } else {
      console.log('[Slides] Outline validation passed');
    }

    // Pass 2: Generate full slides with outline as constraint
    console.log(`[Slides] Pass 2: Generating full slides with outline constraint...`);
    const fullPrompt = generateSlidesPrompt(userPrompt, researchFiles, augmentedSwimlanes, outline);
    const data = await generateWithGemini(fullPrompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    // Validate quality (logging only - don't block user)
    const slideQualityValidation = validateSlideQuality(data);
    if (!slideQualityValidation.valid) {
      console.log(`[Slides] Quality validation issues:`, slideQualityValidation.issues);
    } else {
      console.log(`[Slides] Quality validation passed`);
    }

    // Validate framework consistency with outline
    const frameworkValidation = validateFrameworkConsistency(outline, data);
    if (!frameworkValidation.valid) {
      console.log(`[Slides] Framework consistency issues:`, frameworkValidation.issues);
    } else {
      console.log(`[Slides] Framework consistency: ${frameworkValidation.consistency}%`);
    }

    // Validate evidence chain usage
    const evidenceChainValidation = validateEvidenceChainUsage(outline, data);
    if (!evidenceChainValidation.valid) {
      console.log(`[Slides] Evidence chain issues:`, evidenceChainValidation.issues);
      if (evidenceChainValidation.missingChains?.length > 0) {
        console.log(`[Slides] Missing evidence chains:`, evidenceChainValidation.missingChains);
      }
    } else {
      console.log(`[Slides] Evidence chain usage: ${evidenceChainValidation.coverage}% (${evidenceChainValidation.usedChains}/${evidenceChainValidation.totalChains})`);
    }

    // Combine all validation issues for backward compatibility
    const allValidationIssues = [
      ...slideQualityValidation.issues,
      ...frameworkValidation.issues,
      ...evidenceChainValidation.issues
    ];

    return {
      success: true,
      data,
      validationIssues: allValidationIssues,
      outline,
      validation: {
        outline: outlineValidation,
        slideQuality: slideQualityValidation,
        framework: frameworkValidation,
        evidenceChains: evidenceChainValidation
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate ONLY the slides outline (Pass 1) - for parallel execution
 * Can run without swimlanes (will auto-detect topics)
 * @param {string} userPrompt - User's analysis request
 * @param {Array} researchFiles - Research files to analyze
 * @param {Array} swimlanes - Optional swimlane topics (can be empty for parallel execution)
 */
async function generateSlidesOutlineOnly(userPrompt, researchFiles, swimlanes = []) {
  try {
    console.log(`[Slides Outline] Generating narrative outline (${swimlanes.length} swimlanes)...`);

    // Create augmented swimlanes with fixed Overview and Conclusion sections
    const augmentedSwimlanes = [
      { name: "Overview", taskCount: 0, isFixed: true },
      ...swimlanes,
      { name: "Conclusion", taskCount: 0, isFixed: true }
    ];

    const outlinePrompt = generateSlidesOutlinePrompt(userPrompt, researchFiles, augmentedSwimlanes);
    const outline = await generateWithGemini(outlinePrompt, slidesOutlineSchema, 'SlideOutline', SLIDES_OUTLINE_CONFIG);

    const totalOutlineSlides = outline.sections?.reduce((sum, s) => sum + (s.slides?.length || 0), 0) || 0;
    console.log(`[Slides Outline] Generated: ${outline.sections?.length || 0} sections, ${totalOutlineSlides} slide blueprints`);

    return { success: true, data: outline };
  } catch (error) {
    console.error('[Slides Outline] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate full slides from an existing outline (Pass 2)
 * Requires swimlanes and outline from Pass 1
 * @param {string} userPrompt - User's analysis request
 * @param {Array} researchFiles - Research files to analyze
 * @param {Array} swimlanes - Swimlane topics from roadmap
 * @param {object} outline - Outline from generateSlidesOutlineOnly
 */
async function generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, outline) {
  try {
    console.log(`[Slides Pass 2] Generating full slides from outline...`);

    // Create augmented swimlanes with fixed Overview and Conclusion sections
    const augmentedSwimlanes = [
      { name: "Overview", taskCount: 0, isFixed: true },
      ...swimlanes,
      { name: "Conclusion", taskCount: 0, isFixed: true }
    ];

    // Validate outline structure before proceeding
    const outlineValidation = validateOutlineStructure(outline, augmentedSwimlanes);
    if (!outlineValidation.valid) {
      console.warn('[Slides Pass 2] Outline validation issues:', outlineValidation.errors);
    }

    // Generate full slides with outline as constraint
    const fullPrompt = generateSlidesPrompt(userPrompt, researchFiles, augmentedSwimlanes, outline);
    const data = await generateWithGemini(fullPrompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    // Run all validations
    const slideQualityValidation = validateSlideQuality(data);
    const frameworkValidation = validateFrameworkConsistency(outline, data);
    const evidenceChainValidation = validateEvidenceChainUsage(outline, data);

    if (!slideQualityValidation.valid) {
      console.log(`[Slides Pass 2] Quality validation issues:`, slideQualityValidation.issues);
    }
    if (frameworkValidation.valid) {
      console.log(`[Slides Pass 2] Framework consistency: ${frameworkValidation.consistency}%`);
    }
    if (evidenceChainValidation.valid) {
      console.log(`[Slides Pass 2] Evidence chain usage: ${evidenceChainValidation.coverage}%`);
    }

    const allValidationIssues = [
      ...slideQualityValidation.issues,
      ...frameworkValidation.issues,
      ...evidenceChainValidation.issues
    ];

    return {
      success: true,
      data,
      validationIssues: allValidationIssues,
      outline,
      validation: {
        outline: outlineValidation,
        slideQuality: slideQualityValidation,
        framework: frameworkValidation,
        evidenceChains: evidenceChainValidation
      }
    };
  } catch (error) {
    console.error('[Slides Pass 2] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate speaker notes for slides using two-pass generation for maximum quality
 * Pass 1: Generate reasoning outline with CoT (audience analysis, evidence chains, pushback prep)
 * Pass 2: Generate full notes using outline as constraint
 * @param {object} slidesData - Generated slides data with sections
 * @param {Array} researchFiles - Original research files
 * @param {string} userPrompt - Original user request
 * @returns {Promise<{success: boolean, data?: object, outline?: object, error?: string}>}
 */
async function generateSpeakerNotes(slidesData, researchFiles, userPrompt) {
  try {
    console.log('[Speaker Notes] Starting two-pass speaker notes generation...');

    // Count total slides to annotate
    const totalSlides = slidesData.sections?.reduce((sum, section) =>
      sum + (section.slides?.length || 0), 0) || 0;
    console.log(`[Speaker Notes] Generating notes for ${totalSlides} slides across ${slidesData.sections?.length || 0} sections`);

    // Pass 1: Generate reasoning outline with deep CoT (with fallback)
    let outline = null;
    let outlinePrompt = null;
    let outlineMetrics = { evidenceChains: 0, sources: 0, pushbacks: 0, transitions: 0, slideOutlines: 0 };

    try {
      console.log('[Speaker Notes] Pass 1: Generating reasoning outline with CoT...');
      outlinePrompt = generateSpeakerNotesOutlinePrompt(slidesData, researchFiles, userPrompt);
      outline = await generateWithGemini(outlinePrompt, speakerNotesOutlineSchema, 'SpeakerNotesOutline', SPEAKER_NOTES_OUTLINE_CONFIG);

      // Log outline quality metrics
      outlineMetrics = {
        evidenceChains: outline.reasoning?.keyEvidenceChains?.length || 0,
        sources: outline.reasoning?.sourceInventory?.length || 0,
        pushbacks: outline.reasoning?.anticipatedPushback?.length || 0,
        transitions: outline.reasoning?.narrativeTransitions?.length || 0,
        slideOutlines: outline.slideOutlines?.length || 0
      };
      console.log('[Speaker Notes] Pass 1 complete:', outlineMetrics);

      // Quality warnings (no retry - prioritizing speed)
      if (outlineMetrics.evidenceChains < 3) {
        console.warn('[Speaker Notes] Low evidence chain count in outline:', outlineMetrics.evidenceChains);
      }
      if (outlineMetrics.sources < 2) {
        console.warn('[Speaker Notes] Low source count in outline:', outlineMetrics.sources);
      }
    } catch (pass1Error) {
      console.warn('[Speaker Notes] Pass 1 failed, falling back to single-pass generation:', pass1Error.message);
      outline = null;
    }

    // Pass 2: Generate full notes (with or without outline constraint)
    console.log(`[Speaker Notes] Pass 2: Generating full notes ${outline ? 'with outline constraint' : 'WITHOUT outline (fallback mode)'}...`);
    const fullPrompt = generateSpeakerNotesPrompt(slidesData, researchFiles, userPrompt, outline);
    const data = await generateWithGemini(fullPrompt, speakerNotesSchema, 'SpeakerNotes', SPEAKER_NOTES_CONFIG);

    // Validate we got notes for all slides
    const notesCount = data.slides?.length || 0;
    if (notesCount < totalSlides) {
      console.warn(`[Speaker Notes] Generated ${notesCount} notes for ${totalSlides} slides - some slides may be missing notes`);
    } else {
      console.log(`[Speaker Notes] Pass 2 complete: ${notesCount} speaker notes generated`);
    }

    // Log if reasoning was included in output
    if (data.reasoning) {
      console.log('[Speaker Notes] Reasoning block included in output for transparency');
    } else if (outline?.reasoning) {
      // Copy reasoning from outline if not present in output
      console.log('[Speaker Notes] Copying reasoning from outline to output');
      data.reasoning = outline.reasoning;
    }

    // Fix #9: Validate delivery cues presence (logging only)
    const deliveryCuePattern = /\[(pause|emphasize|gesture|lean in|lower voice|rhetorical)\]/i;
    const slidesWithCues = data.slides?.filter(s =>
      s.narrative?.talkingPoints?.some(tp => deliveryCuePattern.test(tp))
    ).length || 0;

    if (slidesWithCues === 0) {
      console.warn('[Speaker Notes] No delivery cues detected in any talking points');
    } else if (slidesWithCues < Math.floor((data.slides?.length || 0) / 2)) {
      console.warn(`[Speaker Notes] Delivery cues found in only ${slidesWithCues}/${data.slides?.length} slides`);
    } else {
      console.log(`[Speaker Notes] Delivery cues present in ${slidesWithCues}/${data.slides?.length} slides`);
    }

    return { success: true, data, outline };
  } catch (error) {
    console.error('[Speaker Notes] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate executive summary document with optional swimlane alignment
 * @param {string} userPrompt - User's analysis request
 * @param {Array} researchFiles - Research files to analyze
 * @param {Array} swimlanes - Optional swimlane topics from roadmap for section alignment
 */
async function generateDocument(userPrompt, researchFiles, swimlanes = []) {
  const MAX_RETRIES = 2;
  let lastResult = null;
  let lastValidation = null;
  let lastCoherenceValidation = null;

  if (swimlanes.length > 0) {
    console.log(`[Document] Generating with ${swimlanes.length} swimlane-aligned sections`);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const prompt = generateDocumentPrompt(userPrompt, researchFiles, swimlanes);
      const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG);

      // Validate executive summary quality
      const validation = validateExecutiveSummary(data.executiveSummary);

      // Validate reasoning coherence (COT → output alignment)
      const coherenceValidation = validateReasoningCoherence(data.reasoning, data.executiveSummary);
      if (!coherenceValidation.coherent) {
        console.log(`[Document] Reasoning coherence issues:`, coherenceValidation.issues);
      }

      lastResult = data;
      lastValidation = validation;
      lastCoherenceValidation = coherenceValidation;

      // Also validate section quality (logging only - don't block on section issues)
      if (data.sections && Array.isArray(data.sections)) {
        const sectionIssues = data.sections.flatMap((s, i) => validateSectionQuality(s, i));
        if (sectionIssues.length > 0) {
          console.log(`[Document] Section quality issues:`, sectionIssues);
        }
      }

      // Combined validation: both exec summary AND reasoning coherence must pass
      const combinedValid = validation.valid && coherenceValidation.coherent;

      if (combinedValid) {
        console.log(`[Document] Executive summary and reasoning coherence passed on attempt ${attempt + 1}`);
        const qualityScore = calculateQualityScore(data);
        console.log(`[Document] Quality score: ${qualityScore.overall}/100 (${qualityScore.rating})`);

        // Determine quality tier
        const qualityTier = qualityScore.overall >= 85 ? 'excellent' :
                           qualityScore.overall >= 70 ? 'good' :
                           qualityScore.overall >= 50 ? 'needs-improvement' : 'poor';

        return {
          success: true,
          data,
          qualityScore,
          qualityTier,
          coherenceIssues: coherenceValidation.issues,
          qualityWarning: qualityScore.overall < 70 ?
            `Quality score ${qualityScore.overall}/100 below threshold. Consider regenerating.` : null
        };
      }

      const allIssues = [...validation.issues, ...coherenceValidation.issues];
      console.log(`[Document] Validation issues on attempt ${attempt + 1}:`, allIssues);

      // Only retry if we have attempts left
      if (attempt < MAX_RETRIES - 1) {
        console.log(`[Document] Retrying generation...`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Return last result even if validation failed (don't block user)
  const allValidationIssues = [...(lastValidation?.issues || []), ...(lastCoherenceValidation?.issues || [])];
  console.log(`[Document] Returning result despite validation issues:`, allValidationIssues);
  const qualityScore = calculateQualityScore(lastResult);
  console.log(`[Document] Quality score: ${qualityScore.overall}/100 (${qualityScore.rating})`);

  // Determine quality tier
  const qualityTier = qualityScore.overall >= 85 ? 'excellent' :
                     qualityScore.overall >= 70 ? 'good' :
                     qualityScore.overall >= 50 ? 'needs-improvement' : 'poor';

  return {
    success: true,
    data: lastResult,
    qualityScore,
    qualityTier,
    validationIssues: allValidationIssues,
    coherenceIssues: lastCoherenceValidation?.issues || [],
    qualityWarning: qualityScore.overall < 70 ?
      `Quality score ${qualityScore.overall}/100 below threshold. Consider regenerating.` : null
  };
}
async function generateResearchAnalysis(userPrompt, researchFiles) {
  try {
    const prompt = generateResearchAnalysisPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, researchAnalysisSchema, 'ResearchAnalysis', RESEARCH_ANALYSIS_CONFIG);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate pre-meeting intelligence brief from session data
 * Synthesizes sources, document, roadmap, and slides into meeting prep
 * @param {Object} sessionData - Contains sources, document, roadmap, slides
 * @param {Object} meetingContext - Contains meetingAttendees, meetingObjective, keyConcerns
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function generateIntelligenceBrief(sessionData, meetingContext) {
  try {
    console.log('[IntelligenceBrief] Generating pre-meeting brief...');
    console.log('[IntelligenceBrief] Session data available:', {
      sources: sessionData.sources?.length || 0,
      hasDocument: !!sessionData.document,
      hasRoadmap: !!sessionData.roadmap,
      hasSlides: !!sessionData.slides
    });

    const prompt = generateIntelligenceBriefPrompt(sessionData, meetingContext);
    const data = await generateWithGemini(prompt, intelligenceBriefSchema, 'IntelligenceBrief', INTELLIGENCE_BRIEF_CONFIG);

    console.log('[IntelligenceBrief] Generated brief:', {
      keyInsights: data.keyInsights?.length || 0,
      talkingPoints: data.talkingPoints?.length || 0,
      anticipatedQuestions: data.anticipatedQuestions?.length || 0,
      recommendedNextSteps: data.recommendedNextSteps?.length || 0
    });

    return { success: true, data };
  } catch (error) {
    console.error('[IntelligenceBrief] Generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate all content types with optimized 3-phase pipeline
 *
 * OPTIMIZED PIPELINE (Speaker Notes deferred to background):
 * Phase 0: Start Research Analysis immediately (100% independent, no dependencies)
 * Phase 1: Roadmap + Slides Outline in parallel (Outline can auto-detect topics)
 * Phase 2: Slides Pass 2 + Document in parallel (both use swimlanes from roadmap)
 *
 * Speaker Notes are generated on-demand via generateSpeakerNotesAsync() to avoid
 * blocking the main response. This reduces initial latency from ~10min to ~2min.
 */
export async function generateAllContent(userPrompt, researchFiles) {
  try {
    console.log('[Generation] Starting optimized 3-phase pipeline (speaker notes deferred)...');
    const startTime = Date.now();

    // Phase 0: Start Research Analysis immediately (no dependencies)
    // This runs in background while other phases execute
    console.log('[Generation] Phase 0: Starting Research Analysis (independent)...');
    const researchAnalysisPromise = apiQueue.add(
      () => generateResearchAnalysis(userPrompt, researchFiles),
      'ResearchAnalysis'
    );

    // Phase 1: Roadmap + Slides Outline in parallel
    // Slides outline can run without swimlanes (will auto-detect topics)
    console.log('[Generation] Phase 1: Roadmap + Slides Outline (parallel)...');
    const phase1Tasks = [
      { task: () => generateRoadmap(userPrompt, researchFiles), name: 'Roadmap' },
      { task: () => generateSlidesOutlineOnly(userPrompt, researchFiles, []), name: 'SlidesOutline' }
    ];
    const [roadmap, slidesOutline] = await apiQueue.runAll(phase1Tasks);

    // Extract swimlane topics for document section alignment
    const swimlanes = roadmap.success
      ? extractSwimlanesFromRoadmap(roadmap.data)
      : [];
    console.log(`[Generation] Extracted ${swimlanes.length} swimlanes from roadmap`);

    // Phase 2: Slides Pass 2 + Document in parallel (both use swimlanes)
    console.log(`[Generation] Phase 2: Slides Pass 2 + Document (with ${swimlanes.length} swimlanes)...`);

    // CRITICAL FIX: Reconcile outline sections with authoritative roadmap swimlanes.
    // The outline was generated in Phase 1 without swimlanes (to enable parallel execution),
    // so it may have auto-detected sections that don't match the roadmap's entity swimlanes.
    // This reconciliation ensures entity swimlanes (e.g., "Bank of America", "Citigroup")
    // appear correctly in the slides TOC.
    let reconciledOutline = slidesOutline.data;
    if (slidesOutline.success && swimlanes.length > 0) {
      console.log('[Generation] Reconciling outline with roadmap swimlanes...');
      console.log('[Generation] Original outline sections:', slidesOutline.data?.sections?.map(s => s.swimlane) || []);
      reconciledOutline = reconcileOutlineWithSwimlanes(slidesOutline.data, swimlanes);
      console.log('[Generation] Reconciled outline sections:', reconciledOutline?.sections?.map(s => s.swimlane) || []);
    } else {
      console.log('[Generation] Skipping reconciliation - outline success:', slidesOutline.success, 'swimlanes:', swimlanes.length);
    }

    const phase2Tasks = [
      {
        task: () => slidesOutline.success
          ? generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, reconciledOutline)
          : generateSlides(userPrompt, researchFiles, swimlanes), // Fallback to full generation
        name: 'Slides'
      },
      { task: () => generateDocument(userPrompt, researchFiles, swimlanes), name: 'Document' }
    ];
    const [slides, document] = await apiQueue.runAll(phase2Tasks);

    // Wait for Research Analysis (likely already complete from Phase 0)
    const researchAnalysis = await researchAnalysisPromise;

    // Cross-generator validation: Check swimlane alignment between roadmap and slides
    if (slides.success && swimlanes.length > 0) {
      const slideSwimlanes = slides.data?.sections?.map(s => s.swimlane) || [];
      const roadmapSwimlanes = swimlanes.map(s => s.name);

      const mismatchedSwimlanes = slideSwimlanes.filter(
        ss => !roadmapSwimlanes.some(rs =>
          rs.toLowerCase().includes(ss.toLowerCase()) ||
          ss.toLowerCase().includes(rs.toLowerCase())
        )
      );

      if (mismatchedSwimlanes.length > 0) {
        console.warn('[Generation] Swimlane mismatch detected:', {
          roadmap: roadmapSwimlanes,
          slides: slideSwimlanes,
          unmatched: mismatchedSwimlanes
        });
      } else {
        console.log(`[Generation] Swimlane alignment verified: ${slideSwimlanes.length} sections match roadmap`);
      }
    }

    // Speaker notes are now generated on-demand, not during initial generation
    // This reduces initial response time from ~10min to ~2min
    const speakerNotes = { success: false, error: 'Speaker notes available on-demand', deferred: true };

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Generation] Core content complete in ${totalTime}s (speaker notes deferred)`);

    return { roadmap, slides, document, researchAnalysis, speakerNotes };
  } catch (error) {
    throw error;
  }
}

/**
 * Generate speaker notes asynchronously (on-demand)
 * Called separately after main content generation to avoid blocking
 * @param {object} slidesData - Generated slides data with sections
 * @param {Array} researchFiles - Original research files
 * @param {string} userPrompt - Original user request
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function generateSpeakerNotesAsync(slidesData, researchFiles, userPrompt) {
  if (!slidesData?.sections) {
    return { success: false, error: 'Slides data required for speaker notes generation' };
  }

  console.log('[Speaker Notes Async] Starting on-demand generation...');
  const startTime = Date.now();

  const result = await apiQueue.add(
    () => generateSpeakerNotes(slidesData, researchFiles, userPrompt),
    'SpeakerNotes'
  );

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  if (result.success) {
    console.log(`[Speaker Notes Async] Complete in ${totalTime}s (${result.data?.slides?.length || 0} notes)`);
  } else {
    console.warn(`[Speaker Notes Async] Failed after ${totalTime}s:`, result.error);
  }

  return result;
}
export async function regenerateContent(viewType, prompt, researchFiles) {
  try {
    const taskName = `Regenerate-${viewType}`;
    const task = async () => {
      switch (viewType) {
        case 'roadmap':
          return generateRoadmap(prompt, researchFiles);
        case 'slides':
          return generateSlides(prompt, researchFiles);
        case 'document':
          return generateDocument(prompt, researchFiles);
        case 'research-analysis':
          return generateResearchAnalysis(prompt, researchFiles);
        default:
          throw new Error(`Invalid view type: ${viewType}`);
      }
    };
    return await apiQueue.add(task, taskName);
  } catch (error) {
    throw error;
  }
}
