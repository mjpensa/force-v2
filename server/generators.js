import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, generateSlidesOutlinePrompt, slidesSchema, slidesOutlineSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema } from './prompts/research-analysis.js';
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
 */
const DOCUMENT_CONFIG = {
  temperature: 0.45,       // Increased: more narrative variety and creative phrasing
  topP: 0.55,              // Balanced: good token selection for varied constructions
  topK: 20,                // Richer vocabulary for compelling, engaging prose
  thinkingBudget: 2048     // Extended reasoning for deeper analysis and evidence connections
  // Note: frequencyPenalty/presencePenalty not supported by Gemini Flash
};
const STRUCTURED_DEFAULT_CONFIG = {
  thinkingBudget: 0  // Disabled for speed
};
const ROADMAP_CONFIG = {
  temperature: 0.1,      // Lowest: maximum determinism for rule-based output
  topP: 0.3,             // Very constrained: follow explicit rules exactly
  topK: 5,               // Minimal exploration: pick most likely tokens
  thinkingBudget: 0      // Disabled for speed
};
const RESEARCH_ANALYSIS_CONFIG = {
  temperature: 0.2,      // Low: reliable analysis without hallucination
  topP: 0.5,             // Moderate: allows varied recommendations
  topK: 10,              // Some exploration for insightful suggestions
  thinkingBudget: 0      // Disabled for speed
};
const SLIDES_CONFIG = {
  temperature: 0.25,      // Increased for narrative variety
  topP: 0.5,              // Broader vocabulary selection
  topK: 15,               // Richer word choices
  thinkingBudget: 512     // Deeper reasoning for coherence
  // Note: frequencyPenalty/presencePenalty not supported by Gemini Flash
};

const SLIDES_OUTLINE_CONFIG = {
  temperature: 0.1,       // Deterministic structure
  topP: 0.3,
  topK: 5,
  thinkingBudget: 256     // Light reasoning for outline
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

  // Check for weak openers (anti-patterns)
  const weakOpeners = /^(this|the|our|in today|as we|it is|there (is|are|has|have))/i;
  const firstSentence = typeof execSummary === 'object'
    ? execSummary.situation
    : text.split(/[.!?]/)[0];
  if (weakOpeners.test(firstSentence?.trim() || '')) {
    issues.push('Weak opening detected');
  }

  // Check for weasel words
  const weaselWords = /(significant|substantial|considerable|various|many|some|often|generally)/i;
  if (weaselWords.test(text)) {
    issues.push('Contains vague weasel words');
  }

  // NEW: Check for narrative energy markers (contrast/escalation words)
  const contrastWords = /(while|however|yet|but|whereas|although|despite)/i;
  const escalationWords = /(moreover|critically|furthermore|notably|increasingly)/i;
  if (!contrastWords.test(text) && !escalationWords.test(text)) {
    issues.push('Missing narrative energy markers (contrast/escalation)');
  }

  // NEW: Evidence density check (at least 2 specific data points in situation+insight)
  if (typeof execSummary === 'object') {
    const situationInsight = `${execSummary.situation || ''} ${execSummary.insight || ''}`;
    const dataPointMatches = situationInsight.match(/\d+\.?\d*\s*%|\$\d[\d,]*\.?\d*[MBK]?|Q[1-4]\s*20\d{2}|\d+x\b/gi) || [];
    if (dataPointMatches.length < 2) {
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
    /^Q[1-4]\s+20\d{2}/                 // THE TIMELINE: "Q1 2026:..."
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

  // 6. SOURCE QUALITY (15 pts)
  const source = execSummary.source || '';
  const badSourcePatterns = /\.(md|txt|pdf|docx|doc|xlsx|csv)$/i;
  const genericSourcePatterns = /^(research|document|file|data|upload|input|source)/i;
  const authoritativePatterns = /(report|analysis|study|survey|publication|filing|data|institute|research)/i;

  const isFilename = badSourcePatterns.test(source) || genericSourcePatterns.test(source);
  const isAuthoritative = authoritativePatterns.test(source) && source.length > 10;
  const hasEvidenceChainSources = (execSummary.evidenceChain || []).every(e => e.source && e.source.length > 5);

  if (!isFilename && isAuthoritative && hasEvidenceChainSources) {
    breakdown.source = 15;
  } else if (!isFilename && isAuthoritative) {
    breakdown.source = 12;
  } else if (!isFilename && source.length > 10) {
    breakdown.source = 8;
  } else if (isFilename) {
    breakdown.source = 2;
    warnings.push('Source appears to be filename rather than authoritative source');
  } else {
    breakdown.source = 5;
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

    if (!section.slides || section.slides.length === 0) {
      issues.push(`Section "${sectionName}": No slides generated (minimum 1-2 required)`);
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

    // Pass 1: Generate narrative outline (fast, structured)
    console.log(`[Slides] Pass 1: Generating narrative outline...`);
    const outlinePrompt = generateSlidesOutlinePrompt(userPrompt, researchFiles, swimlanes);
    const outline = await generateWithGemini(outlinePrompt, slidesOutlineSchema, 'SlideOutline', SLIDES_OUTLINE_CONFIG);

    const totalOutlineSlides = outline.sections?.reduce((sum, s) => sum + (s.slides?.length || 0), 0) || 0;
    console.log(`[Slides] Outline generated: ${outline.sections?.length || 0} sections, ${totalOutlineSlides} slide blueprints`);

    // Pass 2: Generate full slides with outline as constraint
    console.log(`[Slides] Pass 2: Generating full slides with outline constraint...`);
    const fullPrompt = generateSlidesPrompt(userPrompt, researchFiles, swimlanes, outline);
    const data = await generateWithGemini(fullPrompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    // Validate quality (logging only - don't block user)
    const validation = validateSlideQuality(data);
    if (!validation.valid) {
      console.log(`[Slides] Quality validation issues:`, validation.issues);
    } else {
      console.log(`[Slides] Quality validation passed`);
    }

    return { success: true, data, validationIssues: validation.issues, outline };
  } catch (error) {
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

  if (swimlanes.length > 0) {
    console.log(`[Document] Generating with ${swimlanes.length} swimlane-aligned sections`);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const prompt = generateDocumentPrompt(userPrompt, researchFiles, swimlanes);
      const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG);

      // Validate executive summary quality
      const validation = validateExecutiveSummary(data.executiveSummary);
      lastResult = data;
      lastValidation = validation;

      // Also validate section quality (logging only - don't block on section issues)
      if (data.sections && Array.isArray(data.sections)) {
        const sectionIssues = data.sections.flatMap((s, i) => validateSectionQuality(s, i));
        if (sectionIssues.length > 0) {
          console.log(`[Document] Section quality issues:`, sectionIssues);
        }
      }

      if (validation.valid) {
        console.log(`[Document] Executive summary passed validation on attempt ${attempt + 1}`);
        const qualityScore = calculateQualityScore(data);
        console.log(`[Document] Quality score: ${qualityScore.overall}/100 (${qualityScore.rating})`);
        return { success: true, data, qualityScore };
      }

      console.log(`[Document] Validation issues on attempt ${attempt + 1}:`, validation.issues);

      // Only retry if we have attempts left
      if (attempt < MAX_RETRIES - 1) {
        console.log(`[Document] Retrying generation...`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Return last result even if validation failed (don't block user)
  console.log(`[Document] Returning result despite validation issues:`, lastValidation?.issues);
  const qualityScore = calculateQualityScore(lastResult);
  console.log(`[Document] Quality score: ${qualityScore.overall}/100 (${qualityScore.rating})`);
  return { success: true, data: lastResult, qualityScore, validationIssues: lastValidation?.issues };
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
 * Generate all content types with two-phase approach for swimlane alignment
 *
 * Phase 1: Generate roadmap first to extract swimlane topics
 * Phase 2: Generate remaining content in parallel, with document using swimlane alignment
 *
 * This ensures document sections align with Gantt chart swimlanes while
 * maintaining parallel generation for other content types.
 */
export async function generateAllContent(userPrompt, researchFiles) {
  try {
    // Phase 1: Generate roadmap first to extract swimlane topics
    console.log('[Generation] Phase 1: Generating roadmap to extract swimlanes...');
    const roadmap = await generateRoadmap(userPrompt, researchFiles);

    // Extract swimlane topics for document section alignment
    const swimlanes = roadmap.success
      ? extractSwimlanesFromRoadmap(roadmap.data)
      : [];

    // Phase 2: Generate remaining content with swimlane-aligned slides and document
    console.log(`[Generation] Phase 2: Generating slides (${swimlanes.length} swimlanes), document, and research analysis...`);
    const tasks = [
      { task: () => generateSlides(userPrompt, researchFiles, swimlanes), name: 'Slides' },
      { task: () => generateDocument(userPrompt, researchFiles, swimlanes), name: 'Document' },
      { task: () => generateResearchAnalysis(userPrompt, researchFiles), name: 'ResearchAnalysis' }
    ];

    const [slides, document, researchAnalysis] = await apiQueue.runAll(tasks);

    return { roadmap, slides, document, researchAnalysis };
  } catch (error) {
    throw error;
  }
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
