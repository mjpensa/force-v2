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
 *
 * DOCUMENT_CONFIG_FAST: Optimized for SPEED - fallback mode
 * - No thinking budget for instant generation
 * - Low temperature for consistent output
 *
 * DOCUMENT_CONFIG_ENHANCED: Optimized for QUALITY - analytical rigor
 * - Extended thinking for deep reasoning
 * - Higher temperature for narrative variety
 */
const DOCUMENT_CONFIG_FAST = {
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0   // Zero: fast generation
};

const DOCUMENT_CONFIG_ENHANCED = {
  temperature: 0.3,      // Higher for varied expression
  topP: 0.6,             // Broader vocabulary selection
  topK: 20,              // More token choices
  thinkingBudget: 8192   // Enable deep reasoning
};

const DOCUMENT_POLISH_CONFIG = {
  temperature: 0.5,      // Higher creativity for narrative polish
  topP: 0.7,
  topK: 30,
  thinkingBudget: 0      // Speed - structure already done
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
  temperature: 0.1,
  topP: 0.3,
  topK: 5,
  thinkingBudget: 0   // Zero: no thinking needed for simple JSON
};
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
      thinkingBudget = STRUCTURED_DEFAULT_CONFIG.thinkingBudget
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
      const positionMatch = parseError.message.match(/position (\d+)/);
      const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0;
      if (errorPosition > 0) {
        const contextStart = Math.max(0, errorPosition - 200);
        const contextEnd = Math.min(text.length, errorPosition + 200);
      }
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
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
/**
 * Enhanced document generation with two passes:
 * Pass 1: Deep analytical structure with extended thinking
 * Pass 2: Narrative polish for engagement
 */
async function generateDocumentEnhanced(userPrompt, researchFiles) {
  // Pass 1: Analytical structure (with thinking)
  console.log('[Document-Enhanced] Starting Pass 1: Analytical structure with extended thinking');
  const structurePrompt = generateDocumentPrompt(userPrompt, researchFiles);
  const structure = await generateWithGemini(
    structurePrompt,
    documentSchema,
    'Document-Analysis',
    DOCUMENT_CONFIG_ENHANCED
  );

  // Pass 2: Narrative polish (faster, creative)
  console.log('[Document-Enhanced] Starting Pass 2: Narrative polish');
  const polishPrompt = `Rewrite this executive summary to maximize narrative energy and engagement.

INSTRUCTIONS:
- Sharpen every heading to lead with insight, not topic labels
- Strengthen verb choices (eliminate "is/are/was/were" where possible)
- Vary sentence rhythm for better flow
- Ensure each paragraph opens with its most compelling point
- Keep all facts, evidence, and structure intact
- Preserve all JSON fields and structure exactly

CURRENT DRAFT:
${JSON.stringify(structure, null, 2)}

Return the improved version in the exact same JSON schema.`;

  const polished = await generateWithGemini(
    polishPrompt,
    documentSchema,
    'Document-Polish',
    DOCUMENT_POLISH_CONFIG
  );

  return polished;
}

/**
 * Generate executive summary document with enhanced quality
 * Falls back to fast generation if enhanced mode fails
 */
async function generateDocument(userPrompt, researchFiles, enhanced = true) {
  try {
    if (enhanced) {
      try {
        const data = await generateDocumentEnhanced(userPrompt, researchFiles);
        return { success: true, data };
      } catch (enhancedError) {
        console.warn('[Document] Enhanced generation failed, falling back to fast mode:', enhancedError.message);
        // Fall through to fast generation
      }
    }

    // Fast generation (fallback)
    console.log('[Document] Using fast generation mode');
    const prompt = generateDocumentPrompt(userPrompt, researchFiles);
    const data = await generateWithGemini(prompt, documentSchema, 'Document', DOCUMENT_CONFIG_FAST);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
