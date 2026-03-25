import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, generateSlidesOutlinePrompt, generateSpeakerNotesPrompt, generateSpeakerNotesOutlinePrompt, slidesSchema, slidesOutlineSchema, speakerNotesSchema, speakerNotesOutlineSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema } from './prompts/research-analysis.js';
import { generateIntelligenceBriefPrompt, intelligenceBriefSchema } from './prompts/intelligence-brief.js';
import { CONFIG } from './config.js';
import { genAI } from './gemini.js';
const GENERATION_TIMEOUT_MS = 360000; // 6 minutes

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

const apiQueue = new APIQueue(4);

// Generation config factory — topK is fixed at 64 for Gemini 2.5 Flash (not configurable)
const DEFAULTS = { thinkingBudget: 0 };
const createConfig = (overrides = {}) => ({ ...DEFAULTS, ...overrides });

const DOCUMENT_CONFIG = createConfig({ temperature: 0.65, topP: 0.9, thinkingBudget: 20000, maxOutputTokens: 65536 });
const ROADMAP_CONFIG = createConfig({ temperature: 0.1, topP: 0.5, thinkingBudget: 1024 });
const RESEARCH_ANALYSIS_CONFIG = createConfig({ temperature: 0.4, topP: 0.75, thinkingBudget: 8192 });
const SLIDES_CONFIG = createConfig({ temperature: 0.55, topP: 0.85, thinkingBudget: 12000, maxOutputTokens: 65536 });
const SLIDES_OUTLINE_CONFIG = createConfig({ temperature: 0.35, topP: 0.75, thinkingBudget: 20000 });
const SPEAKER_NOTES_CONFIG = createConfig({ temperature: 0.55, topP: 0.88, thinkingBudget: 6000 });
const SPEAKER_NOTES_OUTLINE_CONFIG = createConfig({ temperature: 0.35, topP: 0.75, thinkingBudget: 8000 });
const INTELLIGENCE_BRIEF_CONFIG = createConfig({ temperature: 0.5, topP: 0.85, thinkingBudget: 8192 });

// Shared validation patterns (used across multiple validators)
const WEAK_OPENERS = /^(this|the|our|in today|as we|it is|there (is|are|has|have))/i;
const WEASEL_WORDS = /(significant|substantial|considerable|various|many|some|often|generally)/i;
const CONTRAST_WORDS = /(while|however|yet|but|whereas|although|despite)/i;
const ESCALATION_WORDS = /(moreover|critically|furthermore|notably|increasingly|widening|accelerating)/i;
const BAD_SOURCE_PATTERNS = /\.(md|txt|pdf|docx|doc|xlsx|csv)$/i;
const GENERIC_SOURCE_PATTERNS = /^(research|document|file|data|upload|input|source)/i;
const STRONG_OPENER_PATTERNS = [
  /^[A-Z][a-zA-Z]+\s+(deployed|launched|announced|achieved|cut|reduced|eliminated|increased|acquired)/i,
  /^\d+[%xMBK]?[.,]?\s/,
  /^\$[\d,.]+[MBK]?/,
  /^Q[1-4]\s+20\d{2}/i,
  /^(On|In)\s+[A-Z][a-z]+\s+\d/,
  /^What\s+(happens|would|if)/i,
  /^[A-Z][^.]{5,}\s(while|but|yet)\s/i
];

function checkWeakOpener(text) {
  const trimmed = (text || '').trim();
  return { isWeak: WEAK_OPENERS.test(trimmed), isStrong: STRONG_OPENER_PATTERNS.some(p => p.test(trimmed)) };
}

function createAugmentedSwimlanes(swimlanes) {
  return [
    { name: "Overview", taskCount: 0, isFixed: true },
    ...swimlanes,
    { name: "Conclusion", taskCount: 0, isFixed: true }
  ];
}
function extractSwimlanesFromRoadmap(roadmapData) {
  if (!roadmapData?.data) return [];
  const swimlanes = [];
  let currentSwimlane = null;
  let taskCount = 0;
  for (const row of roadmapData.data) {
    if (row.isSwimlane) {
      if (currentSwimlane) swimlanes.push({ ...currentSwimlane, taskCount });
      currentSwimlane = { name: row.title, entity: row.entity };
      taskCount = 0;
    } else if (currentSwimlane) {
      taskCount++;
    }
  }
  if (currentSwimlane) {
    swimlanes.push({ ...currentSwimlane, taskCount });
  }

  return swimlanes;
}

// Reconcile outline sections with authoritative swimlanes from roadmap.
// PRESERVES: reasoning, primaryFramework, keyEvidenceChains, narrativeArcs
// REPLACES: section swimlane names with authoritative names from roadmap
function reconcileOutlineWithSwimlanes(outline, swimlanes) {
  if (!outline || !swimlanes || swimlanes.length === 0) {
    return outline;
  }

  const augmentedSwimlanes = createAugmentedSwimlanes(swimlanes);

  const outlineSections = outline.sections || [];

  const overviewSection = outlineSections.find(s => s.swimlane?.toLowerCase() === 'overview');
  const conclusionSection = outlineSections.find(s => s.swimlane?.toLowerCase() === 'conclusion');
  const middleOutlineSections = outlineSections.filter(s =>
    s.swimlane?.toLowerCase() !== 'overview' && s.swimlane?.toLowerCase() !== 'conclusion'
  );
  const middleSwimlanes = augmentedSwimlanes.filter(s => !s.isFixed);
  const reconciledSections = [];

  reconciledSections.push({
    swimlane: "Overview",
    narrativeArc: overviewSection?.narrativeArc ||
      "Context establishes urgency → Key themes previewed → Sets up detailed analysis",
    slides: overviewSection?.slides || createDefaultSlideBlueprints("Overview", 4)
  });

  for (let i = 0; i < middleSwimlanes.length; i++) {
    const targetSwimlane = middleSwimlanes[i];
    const matchingSection = middleOutlineSections.find(os =>
      os.swimlane?.toLowerCase().includes(targetSwimlane.name.toLowerCase()) ||
      targetSwimlane.name.toLowerCase().includes(os.swimlane?.toLowerCase())
    ) || middleOutlineSections[i];

    reconciledSections.push({
      swimlane: targetSwimlane.name,
      narrativeArc: matchingSection?.narrativeArc ||
        `${targetSwimlane.name} analysis reveals key insights → Evidence compounds urgency → Strategic implications emerge`,
      slides: matchingSection?.slides || createDefaultSlideBlueprints(targetSwimlane.name, 5)
    });
  }

  reconciledSections.push({
    swimlane: "Conclusion",
    narrativeArc: conclusionSection?.narrativeArc ||
      "Synthesis of insights → Strategic implications → Actionable recommendations",
    slides: conclusionSection?.slides || createDefaultSlideBlueprints("Conclusion", 4)
  });


  return { reasoning: outline.reasoning, sections: reconciledSections };
}

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

function validateExecutiveSummary(execSummary) {
  const issues = [];
  const text = typeof execSummary === 'object'
    ? `${execSummary.situation || ''} ${execSummary.insight || ''} ${execSummary.action || ''}`
    : execSummary || '';

  if (!/\d+/.test(text)) issues.push('Missing quantified data point');

  if (!/(recommend|approve|launch|initiate|authorize|implement|hire|invest|prioritize|execute|deploy|expand|reduce|increase|allocate|greenlight)/i.test(text)) {
    issues.push('Missing actionable recommendation');
  }

  const minLength = typeof execSummary === 'object' ? 100 : 150;
  if (text.length < minLength) issues.push(`Too short (${text.length} chars, need ${minLength}+)`);

  const firstSentence = typeof execSummary === 'object'
    ? execSummary.situation
    : text.split(/[.!?]/)[0];
  const { isWeak, isStrong } = checkWeakOpener(firstSentence);
  if (isWeak && !isStrong) issues.push('Weak opening detected');

  if (WEASEL_WORDS.test(text)) issues.push('Contains vague weasel words');

  if (!CONTRAST_WORDS.test(text) && !ESCALATION_WORDS.test(text)) {
    issues.push('Missing narrative energy markers (contrast/escalation)');
  }

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

  if (typeof execSummary === 'object' && execSummary.insight) {
    const insightDepthPatterns = /(means that|implies|resulting in|translates to|equates to|represents|costs?|gap|disadvantage|risk|at stake|widening|compounds)/i;
    if (!insightDepthPatterns.test(execSummary.insight)) {
      issues.push('Insight lacks depth language (missing causal/impact connection)');
    }
  }

  if (typeof execSummary === 'object' && execSummary.source) {
    if (BAD_SOURCE_PATTERNS.test(execSummary.source) || GENERIC_SOURCE_PATTERNS.test(execSummary.source)) {
      issues.push('Source appears to be filename rather than authoritative source');
    }
  }

  return { valid: issues.length === 0, issues };
}

function validateReasoningCoherence(reasoning, executiveSummary) {
  const issues = [];
  if (!reasoning || !executiveSummary) {
    return { coherent: false, issues: ['Missing reasoning or executiveSummary object'] };
  }

  if (reasoning.stakesQuantified && executiveSummary.insight) {
    const stakesNumbers = reasoning.stakesQuantified.match(/\$[\d,.]+[MBK]?|\d+\.?\d*%/gi) || [];
    const insightNumbers = executiveSummary.insight.match(/\$[\d,.]+[MBK]?|\d+\.?\d*%/gi) || [];
    if (stakesNumbers.length > 0 && insightNumbers.length === 0) {
      issues.push('Insight lacks quantified data from reasoning.stakesQuantified');
    }
  }

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

  if (executiveSummary.action) {
    if (!/\b(cto|cfo|ceo|coo|cio|director|vp|head|chief|board|leadership|team)\b/i.test(executiveSummary.action)) {
      issues.push('Action missing clear role assignment');
    }
    if (!/\b(q[1-4]\s*20\d{2}|by\s+(january|february|march|april|may|june|july|august|september|october|november|december)|20\d{2})\b/i.test(executiveSummary.action)) {
      issues.push('Action missing deadline/timeline');
    }
  }

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

  return { coherent: issues.length === 0, issues };
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
    const {
      temperature,
      topP,
      thinkingBudget = 0,
      maxOutputTokens
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
    if (maxOutputTokens !== undefined) generationConfig.maxOutputTokens = maxOutputTokens;
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
    try {
      const data = JSON.parse(text);
      return data;
    } catch (parseError) {
      try {
        const repairedJsonText = jsonrepair(text);
        const repairedData = JSON.parse(repairedJsonText);
        return repairedData;
      } catch (repairError) {
        throw parseError;
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
async function generateSlides(userPrompt, researchFiles, swimlanes = []) {
  try {
    const outlineResult = await generateSlidesOutlineOnly(userPrompt, researchFiles, swimlanes);
    if (!outlineResult.success) return outlineResult;
    return generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, outlineResult.data);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateSlidesOutlineOnly(userPrompt, researchFiles, swimlanes = []) {
  try {
    const augmentedSwimlanes = createAugmentedSwimlanes(swimlanes);
    const outlinePrompt = generateSlidesOutlinePrompt(userPrompt, researchFiles, augmentedSwimlanes);
    const outline = await generateWithGemini(outlinePrompt, slidesOutlineSchema, 'SlideOutline', SLIDES_OUTLINE_CONFIG);

    return { success: true, data: outline };
  } catch (error) {
    console.error('[Slides Outline] Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, outline) {
  try {
    const augmentedSwimlanes = createAugmentedSwimlanes(swimlanes);

    const fullPrompt = generateSlidesPrompt(userPrompt, researchFiles, augmentedSwimlanes, outline);
    const data = await generateWithGemini(fullPrompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    return { success: true, data };
  } catch (error) {
    console.error('[Slides Pass 2] Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function generateSpeakerNotes(slidesData, researchFiles, userPrompt) {
  try {
    let outline = null;

    try {
      const outlinePrompt = generateSpeakerNotesOutlinePrompt(slidesData, researchFiles, userPrompt);
      outline = await generateWithGemini(outlinePrompt, speakerNotesOutlineSchema, 'SpeakerNotesOutline', SPEAKER_NOTES_OUTLINE_CONFIG);

    } catch (pass1Error) {
      outline = null;
    }

    const fullPrompt = generateSpeakerNotesPrompt(slidesData, researchFiles, userPrompt, outline);
    const data = await generateWithGemini(fullPrompt, speakerNotesSchema, 'SpeakerNotes', SPEAKER_NOTES_CONFIG);

    if (!data.reasoning && outline?.reasoning) {
      data.reasoning = outline.reasoning;
    }

    return { success: true, data };
  } catch (error) {
    console.error('[Speaker Notes] Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function generateDocument(userPrompt, researchFiles, swimlanes = []) {
  const MAX_RETRIES = 2;
  let lastResult = null;
  let lastValidation = null;
  let lastCoherenceValidation = null;


  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const prompt = generateDocumentPrompt(userPrompt, researchFiles, swimlanes);
      const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG);
      const validation = validateExecutiveSummary(data.executiveSummary);
      const coherenceValidation = validateReasoningCoherence(data.reasoning, data.executiveSummary);

      lastResult = data;
      lastValidation = validation;
      lastCoherenceValidation = coherenceValidation;

      const combinedValid = validation.valid && coherenceValidation.coherent;
      if (combinedValid) {
        return {
          success: true,
          data,
          coherenceIssues: coherenceValidation.issues
        };
      }

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  const allValidationIssues = [...(lastValidation?.issues || []), ...(lastCoherenceValidation?.issues || [])];

  return {
    success: true,
    data: lastResult,
    validationIssues: allValidationIssues,
    coherenceIssues: lastCoherenceValidation?.issues || []
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

export async function generateIntelligenceBrief(sessionData, meetingContext) {
  try {

    const prompt = generateIntelligenceBriefPrompt(sessionData, meetingContext);
    const data = await generateWithGemini(prompt, intelligenceBriefSchema, 'IntelligenceBrief', INTELLIGENCE_BRIEF_CONFIG);


    return { success: true, data };
  } catch (error) {
    console.error('[IntelligenceBrief] Generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// 3-phase pipeline: Phase 0 (Research), Phase 1 (Roadmap + Outline), Phase 2 (Slides + Document)
// Speaker notes generated on-demand via generateSpeakerNotesAsync()
export async function generateAllContent(userPrompt, researchFiles) {
  const researchAnalysisPromise = apiQueue.add(
    () => generateResearchAnalysis(userPrompt, researchFiles), 'ResearchAnalysis'
  );

  const phase1Tasks = [
    { task: () => generateRoadmap(userPrompt, researchFiles), name: 'Roadmap' },
    { task: () => generateSlidesOutlineOnly(userPrompt, researchFiles, []), name: 'SlidesOutline' }
  ];
  const [roadmap, slidesOutline] = await apiQueue.runAll(phase1Tasks);

  const swimlanes = roadmap.success ? extractSwimlanesFromRoadmap(roadmap.data) : [];

  // CRITICAL: Reconcile outline with authoritative roadmap swimlanes for correct TOC
  let reconciledOutline = slidesOutline.data;
  if (slidesOutline.success && swimlanes.length > 0) {
    reconciledOutline = reconcileOutlineWithSwimlanes(slidesOutline.data, swimlanes);
  }

  const phase2Tasks = [
    {
      task: () => slidesOutline.success
        ? generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, reconciledOutline)
        : generateSlides(userPrompt, researchFiles, swimlanes),
      name: 'Slides'
    },
    { task: () => generateDocument(userPrompt, researchFiles, swimlanes), name: 'Document' }
  ];
  const [slides, document] = await apiQueue.runAll(phase2Tasks);

  const researchAnalysis = await researchAnalysisPromise;

  const speakerNotes = { success: false, error: 'Speaker notes available on-demand', deferred: true };

  return { roadmap, slides, document, researchAnalysis, speakerNotes };
}

export async function generateSpeakerNotesAsync(slidesData, researchFiles, userPrompt) {
  if (!slidesData?.sections) {
    return { success: false, error: 'Slides data required for speaker notes generation' };
  }

  return await apiQueue.add(
    () => generateSpeakerNotes(slidesData, researchFiles, userPrompt),
    'SpeakerNotes'
  );
}
export async function regenerateContent(viewType, prompt, researchFiles) {
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
  return await apiQueue.add(task, `Regenerate-${viewType}`);
}
