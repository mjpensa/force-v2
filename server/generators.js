import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, generateSlidesOutlinePrompt, generateSpeakerNotesPrompt, generateSpeakerNotesOutlinePrompt, slidesSchema, slidesOutlineSchema, speakerNotesSchema, speakerNotesOutlineSchema } from './prompts/slides.js';
import { generateDocumentPrompt, documentSchema } from './prompts/document.js';
import { generateResearchAnalysisPrompt, researchAnalysisSchema } from './prompts/research-analysis.js';
import { generateIntelligenceBriefPrompt, intelligenceBriefSchema } from './prompts/intelligence-brief.js';
import { assembleResearchContent, extractKeyStats, getCurrentDateContext, buildResearchDigest, formatResearchDigest } from './prompts/common.js';
import { generateNarrativeSpinePrompt, narrativeSpineSchema, formatNarrativeSpine } from './prompts/narrative-spine.js';
import { generateSwotAnalysisPrompt, swotAnalysisSchema } from './prompts/swot-analysis.js';
import { generateCompetitiveAnalysisPrompt, competitiveAnalysisSchema } from './prompts/competitive-analysis.js';
import { generateRiskRegisterPrompt, riskRegisterSchema } from './prompts/risk-register.js';
import { callModelForJson } from './gemini.js';
import { diskCache, hashSchema } from './cache/DiskCache.js';
import { archiveResponse } from './cache/archive.js';
import { validateOrWarn } from './schema-guard.js';
import { SLIDE_LIMITS } from '../Public/shared/slide-limits.js';
import { modelRotator } from './model-rotation.js';
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

const apiQueue = new APIQueue(2);

// Generation config factory
const DEFAULTS = { thinkingBudget: 0 };
const createConfig = (overrides = {}) => ({ ...DEFAULTS, ...overrides });

const DOCUMENT_CONFIG = createConfig({ temperature: 0.65, topP: 0.9, thinkingBudget: 20000, maxOutputTokens: 65536 });
const ROADMAP_CONFIG = createConfig({ temperature: 0.1, topP: 0.5, topK: 20, thinkingBudget: 1024 });
const RESEARCH_ANALYSIS_CONFIG = createConfig({ temperature: 0.4, topP: 0.75, thinkingBudget: 8192 });
const SLIDES_CONFIG = createConfig({ temperature: 0.55, topP: 0.85, thinkingBudget: 12000, maxOutputTokens: 65536 });
const SLIDES_OUTLINE_CONFIG = createConfig({ temperature: 0.35, topP: 0.75, thinkingBudget: 20000 });
const SPEAKER_NOTES_CONFIG = createConfig({ temperature: 0.55, topP: 0.88, thinkingBudget: 6000 });
const SPEAKER_NOTES_OUTLINE_CONFIG = createConfig({ temperature: 0.35, topP: 0.75, thinkingBudget: 8000 });
const INTELLIGENCE_BRIEF_CONFIG = createConfig({ temperature: 0.5, topP: 0.85, thinkingBudget: 8192 });
const NARRATIVE_SPINE_CONFIG = createConfig({ temperature: 0.2, topP: 0.7, thinkingBudget: 4096, maxOutputTokens: 2048 });
const SWOT_CONFIG = createConfig({ temperature: 0.4, topP: 0.8, thinkingBudget: 8192 });
const COMPETITIVE_ANALYSIS_CONFIG = createConfig({ temperature: 0.4, topP: 0.8, thinkingBudget: 8192 });
const RISK_REGISTER_CONFIG = createConfig({ temperature: 0.3, topP: 0.75, thinkingBudget: 8192 });

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

  if (executiveSummary.action) {
    if (!/\b(cto|cfo|ceo|coo|cio|director|vp|head|chief|board|leadership|team)\b/i.test(executiveSummary.action)) {
      issues.push('Action missing clear role assignment');
    }
    if (!/\b(q[1-4]\s*20\d{2}|by\s+(january|february|march|april|may|june|july|august|september|october|november|december)|20\d{2})\b/i.test(executiveSummary.action)) {
      issues.push('Action missing deadline/timeline');
    }
  }

  return { coherent: issues.length === 0, issues };
}

async function generateWithGemini(prompt, schema, contentType, configOverrides = {}, options = {}) {
  try {
    // The full prompt is already part of the cache key (DiskCache._hashKey), so prompt edits
    // invalidate correctly. Schema and model were not: the key carried only the schema's
    // top-level `description`, and 8 of the 12 schemas don't define one — so a schema change
    // silently replayed a pre-change response, and a rotation to a different model reused
    // the previous model's output. Both produce confident wrong conclusions.
    const cacheConfig = {
      schema: hashSchema(schema),
      model: modelRotator.current(),
      contentType,
      ...configOverrides
    };
    const cached = await diskCache.get(prompt, cacheConfig, options);
    if (cached) return cached;

    const {
      temperature,
      topP,
      topK,
      thinkingBudget = 0,
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
    // Goes through the shared client, which is what gives the content pipeline retry with
    // backoff. It previously had none: a transient 503 killed the call outright, and on a
    // 20-request/day free tier every lost call is 5% of the budget. Quota exhaustion is
    // still never retried — see isQuotaExhausted in gemini.js.
    const data = await callModelForJson(prompt, {
      generationConfig,
      timeoutMs: GENERATION_TIMEOUT_MS,
      label: contentType,
      onRetry: (attempt, err) =>
        console.warn(`[${contentType}] attempt ${attempt} failed, retrying: ${err.message}`),
    });

    validateOrWarn(data, schema, contentType);
    await diskCache.set(prompt, cacheConfig, data);
    archiveResponse(contentType, prompt, data);
    return data;
  } catch (error) {
    console.error(`[${contentType}] Generation failed:`, error.message);
    try { modelRotator.handleError(error); } catch { /* rotation failed or non-rate-limit error */ }
    throw new Error(`Failed to generate ${contentType}: ${error.message}`);
  }
}
function trimEmptyColumns(data) {
  if (!data?.timeColumns?.length || !data?.data?.length) return data;
  const tasks = data.data.filter(d => !d.isSwimlane && d.bar?.startCol != null);
  if (tasks.length === 0) return data;
  const minCol = Math.max(1, Math.min(...tasks.map(t => t.bar.startCol)) - 1);
  const maxCol = Math.min(data.timeColumns.length + 1, Math.max(...tasks.map(t => t.bar.endCol)) + 1);
  if (minCol <= 1 && maxCol >= data.timeColumns.length + 1) return data;
  const offset = minCol - 1;
  const newTimeColumns = data.timeColumns.slice(offset, maxCol - 1);
  const newData = data.data.map(item => {
    if (item.isSwimlane || !item.bar || item.bar.startCol == null) return item;
    return { ...item, bar: { ...item.bar, startCol: item.bar.startCol - offset, endCol: item.bar.endCol - offset } };
  });
  return { ...data, timeColumns: newTimeColumns, data: newData };
}

async function generateRoadmap(userPrompt, researchFiles, precomputed = null) {
  try {
    const prompt = generateRoadmapPrompt(userPrompt, researchFiles, precomputed);
    const rawData = await generateWithGemini(prompt, roadmapSchema, 'Roadmap', ROADMAP_CONFIG);
    const data = trimEmptyColumns(rawData);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function generateSlides(userPrompt, researchFiles, swimlanes = [], precomputed = null) {
  try {
    const outlineResult = await generateSlidesOutlineOnly(userPrompt, researchFiles, swimlanes, precomputed);
    if (!outlineResult.success) return outlineResult;
    return generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, outlineResult.data, precomputed);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateSlidesOutlineOnly(userPrompt, researchFiles, swimlanes = [], precomputed = null) {
  try {
    const augmentedSwimlanes = createAugmentedSwimlanes(swimlanes);
    const outlinePrompt = generateSlidesOutlinePrompt(userPrompt, researchFiles, augmentedSwimlanes, precomputed);
    const outline = await generateWithGemini(outlinePrompt, slidesOutlineSchema, 'SlideOutline', SLIDES_OUTLINE_CONFIG);

    return { success: true, data: outline };
  } catch (error) {
    console.error('[Slides Outline] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Editorial quality check on generated slides.
 *
 * Previously read `data.slides`, which slidesSchema has never produced — the shape is
 * `{title, sections[].slides}`. Against real output (the golden captures hold decks of 50
 * and 27 slides) it returned exactly one issue, "No slides array found", every time. The
 * correction pass below requires `issues.length >= 3`, so the self-critique had never run
 * in production. The line-count check compounded it by splitting on the two-character
 * sequence backslash-n rather than a newline, so it could not fire against parsed JSON.
 *
 * slideIndex is numbered continuously across sections, because the correction prompt
 * refers to slides by number and per-section numbering would make "Slide 3" ambiguous.
 */
function validateSlideOutput(data) {
  const issues = [];
  if (!Array.isArray(data?.sections)) {
    return { valid: false, issues: [{ slideIndex: 0, field: 'sections', message: 'No sections array found' }] };
  }

  let idx = 0;
  for (const section of data.sections) {
    for (const slide of section?.slides ?? []) {
      idx += 1;
      if (slide.tagline && slide.tagline.length > SLIDE_LIMITS.TAGLINE_MAX) {
        issues.push({
          slideIndex: idx,
          field: 'tagline',
          message: `Tagline "${slide.tagline}" exceeds ${SLIDE_LIMITS.TAGLINE_MAX} chars (${slide.tagline.length})`,
        });
      }
      if (slide.title) {
        const lines = String(slide.title).split('\n');
        if (lines.length > SLIDE_LIMITS.TITLE_MAX_LINES) {
          issues.push({
            slideIndex: idx,
            field: 'title',
            message: `Title has ${lines.length} lines (max ${SLIDE_LIMITS.TITLE_MAX_LINES})`,
          });
        }
      }
      for (const field of ['paragraph1', 'paragraph2', 'paragraph3']) {
        const text = slide[field];
        if (text && (text.length < SLIDE_LIMITS.PARAGRAPH_MIN || text.length > SLIDE_LIMITS.PARAGRAPH_MAX)) {
          issues.push({
            slideIndex: idx,
            field,
            message: `${field} is ${text.length} chars (target ${SLIDE_LIMITS.PARAGRAPH_TARGET_MIN}-${SLIDE_LIMITS.PARAGRAPH_TARGET_MAX})`,
          });
        }
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

/** Total slides across all sections — used to prove a correction pass didn't drop content. */
function countSlides(data) {
  return (data?.sections ?? []).reduce((n, s) => n + (s?.slides?.length ?? 0), 0);
}

/**
 * A correction must not silently shrink the deck.
 *
 * The original accept condition was only "fewer issues than before", which a response that
 * dropped half the slides satisfies trivially — fewer slides, fewer violations.
 */
function correctionPreservesContent(before, after) {
  if (!Array.isArray(after?.sections)) return false;
  if (after.sections.length !== (before.sections?.length ?? 0)) return false;
  if (countSlides(after) !== countSlides(before)) return false;

  const beforeSlides = (before.sections ?? []).flatMap(s => s?.slides ?? []);
  const afterSlides = after.sections.flatMap(s => s?.slides ?? []);
  return afterSlides.every((slide, i) => {
    const original = beforeSlides[i];
    if (!original) return false;
    // A field that had content must still have content; rewording is fine, emptying is not.
    return ['tagline', 'title', 'paragraph1', 'paragraph2'].every(
      f => !original[f] || Boolean(slide[f])
    );
  });
}

async function generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, outline, precomputed = null) {
  try {
    const augmentedSwimlanes = createAugmentedSwimlanes(swimlanes);

    const fullPrompt = generateSlidesPrompt(userPrompt, researchFiles, augmentedSwimlanes, outline, precomputed);
    const data = await generateWithGemini(fullPrompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    const validation = validateSlideOutput(data);
    if (validation.issues.length) {
      console.log(`[Slides] ${validation.issues.length} quality issue(s) in generated deck`);
    }

    // Off by default. Now that validateSlideOutput actually reports issues, this pass would
    // fire on most decks — and each firing is a second Gemini call with skipCache, which on
    // a 20-request/day free tier is a material budget change that should be a deliberate
    // decision rather than a side effect of fixing the validator. Enable with
    // SLIDES_CRITIQUE=1 once the Phase 2 compliance report shows how often it would trigger
    // and how much it actually improves.
    const critiqueEnabled = process.env.SLIDES_CRITIQUE === '1';
    if (critiqueEnabled && !validation.valid && validation.issues.length >= 3) {
      try {
        const correctionPrompt = `You previously generated slides JSON but it has these quality issues:\n${validation.issues.map(i => `- Slide ${i.slideIndex} ${i.field}: ${i.message}`).join('\n')}\n\nFix ONLY the flagged issues. Keep all other content identical. Return the complete corrected slides JSON.`;
        const correctedData = await generateWithGemini(
          correctionPrompt + '\n\nOriginal output:\n' + JSON.stringify(data),
          slidesSchema, 'SlidesCritique', SLIDES_CONFIG, { skipCache: true }
        );
        const revalidation = validateSlideOutput(correctedData);
        // Fewer issues alone is not enough: a response that dropped half the deck scores
        // better by that measure. Require the content to survive too.
        if (
          revalidation.issues.length < validation.issues.length &&
          correctionPreservesContent(data, correctedData)
        ) {
          return { success: true, data: correctedData, validationIssues: revalidation.issues };
        }
        console.warn('[Slides Critique] Correction rejected: content not preserved or no improvement');
      } catch (critiqueError) {
        console.warn('[Slides Critique] Correction failed, using original:', critiqueError.message);
      }
    }

    return { success: true, data, validationIssues: validation.issues };
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

async function generateDocument(userPrompt, researchFiles, swimlanes = [], precomputed = null) {
  const MAX_RETRIES = 2;
  let lastResult = null;
  let lastValidation = null;
  let lastCoherenceValidation = null;


  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const prompt = generateDocumentPrompt(userPrompt, researchFiles, swimlanes, precomputed);
      const retryOptions = attempt > 0 ? { skipCache: true } : {};
      const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG, retryOptions);
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
/**
 * Generators whose entire body is "build the prompt, call the model, wrap the result".
 *
 * These were five byte-identical functions differing only in prompt builder, schema,
 * content type and config. Three of them also logged the failure a second time —
 * generateWithGemini already logs it — while the other two stayed silent, so the same class
 * of failure produced two, one, or one-plus-a-duplicate log lines depending on which view
 * hit it. The wrapper log is dropped; generateWithGemini owns it.
 *
 * Keeping this table-driven means the Phase 4 prompt rewrite changes one call path rather
 * than five near-copies that can drift apart.
 */
const SIMPLE_GENERATORS = {
  swotAnalysis:       { promptFn: generateSwotAnalysisPrompt,        schema: swotAnalysisSchema,        contentType: 'SwotAnalysis',        config: SWOT_CONFIG },
  competitiveAnalysis:{ promptFn: generateCompetitiveAnalysisPrompt, schema: competitiveAnalysisSchema, contentType: 'CompetitiveAnalysis', config: COMPETITIVE_ANALYSIS_CONFIG },
  riskRegister:       { promptFn: generateRiskRegisterPrompt,        schema: riskRegisterSchema,        contentType: 'RiskRegister',        config: RISK_REGISTER_CONFIG },
  narrativeSpine:     { promptFn: generateNarrativeSpinePrompt,      schema: narrativeSpineSchema,      contentType: 'NarrativeSpine',      config: NARRATIVE_SPINE_CONFIG },
  // decorate: generatedAt is stamped here rather than asked of the model. The prompt used to
  // carry an ISO timestamp for the model to echo back, which made every rendering of the
  // prompt byte-unique — and the prompt is the disk-cache key, so research-analysis could
  // never hit cache. Three identical requests produced three distinct keys.
  researchAnalysis:   { promptFn: generateResearchAnalysisPrompt,    schema: researchAnalysisSchema,    contentType: 'ResearchAnalysis',    config: RESEARCH_ANALYSIS_CONFIG,
                        decorate: data => ({ ...data, generatedAt: new Date().toISOString() }) },
};

function makeSimpleGenerator({ promptFn, schema, contentType, config, decorate }) {
  return async function (userPrompt, researchFiles, precomputed = null) {
    try {
      const prompt = promptFn(userPrompt, researchFiles, precomputed);
      const data = await generateWithGemini(prompt, schema, contentType, config);
      return { success: true, data: decorate ? decorate(data) : data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

const generateSwotAnalysis = makeSimpleGenerator(SIMPLE_GENERATORS.swotAnalysis);
const generateCompetitiveAnalysis = makeSimpleGenerator(SIMPLE_GENERATORS.competitiveAnalysis);
const generateRiskRegister = makeSimpleGenerator(SIMPLE_GENERATORS.riskRegister);
const generateNarrativeSpine = makeSimpleGenerator(SIMPLE_GENERATORS.narrativeSpine);
const generateResearchAnalysis = makeSimpleGenerator(SIMPLE_GENERATORS.researchAnalysis);

export async function generateAllContent(userPrompt, researchFiles, requestedViews = null, onProgress = null) {
  const shouldGenerate = (view) => !requestedViews || requestedViews.includes(view);
  const skipped = { success: false, error: 'Skipped', skipped: true };
  const emit = (event) => onProgress?.(event);

  const researchContent = assembleResearchContent(researchFiles);
  const keyStats = extractKeyStats(researchContent);
  const dateContext = getCurrentDateContext();
  let precomputed = { researchContent, keyStats, dateContext };

  // Phase 0: Narrative spine + research analysis in parallel
  emit({ type: 'view:started', view: 'research-analysis' });
  const phase0Tasks = [
    { task: () => generateNarrativeSpine(userPrompt, researchFiles, precomputed), name: 'NarrativeSpine' },
  ];
  if (shouldGenerate('research-analysis')) {
    phase0Tasks.push({
      task: () => generateResearchAnalysis(userPrompt, researchFiles, precomputed).then(result => {
        emit({ type: result.success ? 'view:completed' : 'view:failed', view: 'research-analysis', result });
        return result;
      }),
      name: 'ResearchAnalysis'
    });
  }
  const phase0Results = await apiQueue.runAll(phase0Tasks);
  const spineResult = phase0Results[0];
  const researchAnalysis = phase0Tasks.length > 1 ? phase0Results[1] : skipped;

  // Inject spine and research digest into precomputed for downstream prompts
  const narrativeSpine = spineResult.success ? spineResult.data : null;
  const researchDigest = researchAnalysis.success ? buildResearchDigest(researchAnalysis.data) : null;
  precomputed = {
    ...precomputed,
    narrativeSpine,
    narrativeSpineText: formatNarrativeSpine(narrativeSpine),
    researchDigest,
    researchDigestText: formatResearchDigest(researchDigest)
  };

  emit({ type: 'view:started', view: 'roadmap' });
  const phase1Tasks = [];
  if (shouldGenerate('roadmap') || shouldGenerate('slides')) {
    phase1Tasks.push({ task: () => generateRoadmap(userPrompt, researchFiles, precomputed), name: 'Roadmap' });
  }
  if (shouldGenerate('slides')) {
    phase1Tasks.push({ task: () => generateSlidesOutlineOnly(userPrompt, researchFiles, [], precomputed), name: 'SlidesOutline' });
  }

  const phase1Results = await apiQueue.runAll(phase1Tasks);
  const roadmap = phase1Tasks.find(t => t.name === 'Roadmap') ? phase1Results[phase1Tasks.findIndex(t => t.name === 'Roadmap')] : skipped;
  const slidesOutline = phase1Tasks.find(t => t.name === 'SlidesOutline') ? phase1Results[phase1Tasks.findIndex(t => t.name === 'SlidesOutline')] : skipped;

  emit({ type: roadmap.success ? 'view:completed' : 'view:failed', view: 'roadmap', result: roadmap });

  const swimlanes = roadmap.success ? extractSwimlanesFromRoadmap(roadmap.data) : [];

  let reconciledOutline = slidesOutline.data;
  if (slidesOutline.success && swimlanes.length > 0) {
    reconciledOutline = reconcileOutlineWithSwimlanes(slidesOutline.data, swimlanes);
  }

  emit({ type: 'view:started', view: 'slides' });
  emit({ type: 'view:started', view: 'document' });

  const phase2Tasks = [];
  if (shouldGenerate('slides')) {
    phase2Tasks.push({
      task: () => (slidesOutline.success
        ? generateSlidesFromOutline(userPrompt, researchFiles, swimlanes, reconciledOutline, precomputed)
        : generateSlides(userPrompt, researchFiles, swimlanes, precomputed)
      ).then(result => {
        emit({ type: result.success ? 'view:completed' : 'view:failed', view: 'slides', result });
        return result;
      }),
      name: 'Slides'
    });
  }
  if (shouldGenerate('document')) {
    phase2Tasks.push({
      task: () => generateDocument(userPrompt, researchFiles, swimlanes, precomputed).then(result => {
        emit({ type: result.success ? 'view:completed' : 'view:failed', view: 'document', result });
        return result;
      }),
      name: 'Document'
    });
  }
  const phase2Results = await apiQueue.runAll(phase2Tasks);
  const slides = phase2Tasks.find(t => t.name === 'Slides') ? phase2Results[phase2Tasks.findIndex(t => t.name === 'Slides')] : skipped;
  const document = phase2Tasks.find(t => t.name === 'Document') ? phase2Results[phase2Tasks.findIndex(t => t.name === 'Document')] : skipped;

  // Phase 3: New analysis views (parallel, no dependencies)
  let swotAnalysis = skipped;
  let competitiveAnalysis = skipped;
  let riskRegister = skipped;
  const phase3Tasks = [];
  if (shouldGenerate('swot-analysis')) {
    emit({ type: 'view:started', view: 'swot-analysis' });
    phase3Tasks.push({
      task: () => generateSwotAnalysis(userPrompt, researchFiles, precomputed).then(result => {
        emit({ type: result.success ? 'view:completed' : 'view:failed', view: 'swot-analysis', result });
        return result;
      }),
      name: 'SwotAnalysis'
    });
  }
  if (shouldGenerate('competitive-analysis')) {
    emit({ type: 'view:started', view: 'competitive-analysis' });
    phase3Tasks.push({
      task: () => generateCompetitiveAnalysis(userPrompt, researchFiles, precomputed).then(result => {
        emit({ type: result.success ? 'view:completed' : 'view:failed', view: 'competitive-analysis', result });
        return result;
      }),
      name: 'CompetitiveAnalysis'
    });
  }
  if (shouldGenerate('risk-register')) {
    emit({ type: 'view:started', view: 'risk-register' });
    phase3Tasks.push({
      task: () => generateRiskRegister(userPrompt, researchFiles, precomputed).then(result => {
        emit({ type: result.success ? 'view:completed' : 'view:failed', view: 'risk-register', result });
        return result;
      }),
      name: 'RiskRegister'
    });
  }
  if (phase3Tasks.length > 0) {
    const phase3Results = await apiQueue.runAll(phase3Tasks);
    const findResult = (name) => {
      const idx = phase3Tasks.findIndex(t => t.name === name);
      return idx >= 0 ? phase3Results[idx] : skipped;
    };
    swotAnalysis = findResult('SwotAnalysis');
    competitiveAnalysis = findResult('CompetitiveAnalysis');
    riskRegister = findResult('RiskRegister');
  }

  const speakerNotes = { success: false, error: 'Speaker notes available on-demand', deferred: true };

  return {
    roadmap: shouldGenerate('roadmap') ? roadmap : skipped,
    slides, document, researchAnalysis, speakerNotes,
    swotAnalysis, competitiveAnalysis, riskRegister
  };
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
export async function regenerateContent(viewType, prompt, researchFiles, existingContent = {}) {
  const researchContent = assembleResearchContent(researchFiles);
  const keyStats = extractKeyStats(researchContent);
  const dateContext = getCurrentDateContext();
  const precomputed = { researchContent, keyStats, dateContext };
  const swimlanes = existingContent.roadmap?.data
    ? extractSwimlanesFromRoadmap(existingContent.roadmap.data)
    : [];
  const task = async () => {
    switch (viewType) {
      case 'roadmap':
        return generateRoadmap(prompt, researchFiles, precomputed);
      case 'slides':
        return generateSlides(prompt, researchFiles, swimlanes, precomputed);
      case 'document':
        return generateDocument(prompt, researchFiles, swimlanes, precomputed);
      case 'research-analysis':
        return generateResearchAnalysis(prompt, researchFiles, precomputed);
      case 'swot-analysis':
        return generateSwotAnalysis(prompt, researchFiles, precomputed);
      case 'competitive-analysis':
        return generateCompetitiveAnalysis(prompt, researchFiles, precomputed);
      case 'risk-register':
        return generateRiskRegister(prompt, researchFiles, precomputed);
      default:
        throw new Error(`Invalid view type: ${viewType}`);
    }
  };
  return await apiQueue.add(task, `Regenerate-${viewType}`);
}

export { validateExecutiveSummary, validateReasoningCoherence, checkWeakOpener,
         reconcileOutlineWithSwimlanes, extractSwimlanesFromRoadmap, APIQueue,
         validateSlideOutput, countSlides, correctionPreservesContent };
