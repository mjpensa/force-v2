import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { generateRoadmapPrompt, roadmapSchema } from './prompts/roadmap.js';
import { generateSlidesPrompt, slidesSchema } from './prompts/slides.js';
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
  temperature: 0.4,      // Increased: more creative phrasing for narrative energy
  topP: 0.55,            // Increased: slightly broader token selection for varied constructions
  topK: 20,              // Increased: richer vocabulary for compelling, engaging prose
  thinkingBudget: 2048   // Extended reasoning for deeper analysis and evidence connections
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
  temperature: 0.15,   // Slight increase: more varied phrasing
  topP: 0.4,           // Broader: richer vocabulary selection
  topK: 10,            // Expanded: better word choice variety
  thinkingBudget: 256  // Light reasoning for content quality decisions
};

/**
 * Validate executive summary quality
 * Returns { valid: boolean, issues: string[] }
 */
function validateExecutiveSummary(execSummary) {
  const issues = [];

  // Handle both object and string formats
  const text = typeof execSummary === 'object'
    ? `${execSummary.stakes || ''} ${execSummary.keyFinding || ''} ${execSummary.recommendation || ''}`
    : execSummary || '';

  // Check for quantified data
  const hasNumber = /\d+/.test(text);
  if (!hasNumber) {
    issues.push('Missing quantified data point');
  }

  // Check for action language
  const hasAction = /(recommend|approve|launch|initiate|authorize|implement|hire|invest|prioritize|execute|deploy|expand|reduce|increase|allocate)/i.test(text);
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
    ? execSummary.stakes
    : text.split(/[.!?]/)[0];
  if (weakOpeners.test(firstSentence?.trim() || '')) {
    issues.push('Weak opening detected');
  }

  // Check for weasel words
  const weaselWords = /(significant|substantial|considerable|various|many|some|often|generally)/i;
  if (weaselWords.test(text)) {
    issues.push('Contains vague weasel words');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validate slide content quality (logging only, no retry)
 * Checks for analytical rigor and narrative energy markers
 * @param {object} slidesData - Generated slides object
 * @returns {{ valid: boolean, issues: string[] }}
 */
function validateSlideQuality(slidesData) {
  const issues = [];

  if (!slidesData?.slides || !Array.isArray(slidesData.slides)) {
    return { valid: false, issues: ['Invalid slides structure'] };
  }

  for (let i = 0; i < slidesData.slides.length; i++) {
    const slide = slidesData.slides[i];
    const slideId = `Slide ${i + 1} "${slide.tagline || 'untitled'}"`;
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

    // Check for topic-label taglines
    if (/^(OVERVIEW|INTRODUCTION|SUMMARY|ANALYSIS|BACKGROUND|CONCLUSION)$/i.test(slide.tagline?.trim() || '')) {
      issues.push(`${slideId}: Generic tagline (should signal insight)`);
    }

    // Check for source citations
    if (!/\[.*?\]/.test(allText) && !/(according to|reveals|shows)/i.test(allText)) {
      issues.push(`${slideId}: No apparent source citation`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
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
async function generateSlides(userPrompt, researchFiles) {
  try {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, slidesSchema, 'Slides', SLIDES_CONFIG);

    // Validate quality (logging only - don't block user)
    const validation = validateSlideQuality(data);
    if (!validation.valid) {
      console.log(`[Slides] Quality validation issues:`, validation.issues);
    } else {
      console.log(`[Slides] Quality validation passed`);
    }

    return { success: true, data, validationIssues: validation.issues };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
/**
 * Generate executive summary document
 */
async function generateDocument(userPrompt, researchFiles) {
  const MAX_RETRIES = 2;
  let lastResult = null;
  let lastValidation = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const prompt = generateDocumentPrompt(userPrompt, researchFiles);
      const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG);

      // Validate executive summary quality
      const validation = validateExecutiveSummary(data.executiveSummary);
      lastResult = data;
      lastValidation = validation;

      if (validation.valid) {
        console.log(`[Document] Executive summary passed validation on attempt ${attempt + 1}`);
        return { success: true, data };
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
  return { success: true, data: lastResult, validationIssues: lastValidation?.issues };
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
 * Generate all content types with controlled concurrency via API queue
 * This prevents overwhelming the Gemini API with too many simultaneous requests
 */
export async function generateAllContent(userPrompt, researchFiles) {
  try {
    // Use apiQueue.runAll to control concurrency and prevent rate limiting
    const tasks = [
      { task: () => generateRoadmap(userPrompt, researchFiles), name: 'Roadmap' },
      { task: () => generateSlides(userPrompt, researchFiles), name: 'Slides' },
      { task: () => generateDocument(userPrompt, researchFiles), name: 'Document' },
      { task: () => generateResearchAnalysis(userPrompt, researchFiles), name: 'ResearchAnalysis' }
    ];

    const [roadmap, slides, document, researchAnalysis] = await apiQueue.runAll(tasks);

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
