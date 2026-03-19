import express from 'express';
import { CONFIG } from '../config.js';
import { callGeminiForJson, callGeminiForText } from '../gemini.js';
import { TASK_ANALYSIS_SYSTEM_PROMPT, TASK_ANALYSIS_SCHEMA, getQASystemPrompt } from '../prompts/analysis.js';
import { apiLimiter } from '../middleware.js';
import { sanitizePrompt } from '../utils.js';
import { sessions, touchSession } from './content.js';

const router = express.Router();

router.post('/get-task-analysis', apiLimiter, async (req, res) => {
  const { taskName, entity, sessionId, researchText: directResearchText } = req.body;

  if (!taskName || !entity) {
    return res.status(400).json({ error: CONFIG.ERRORS.MISSING_TASK_NAME });
  }
  let researchText = directResearchText;

  if (!researchText && sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    touchSession(sessionId);
    researchText = session.researchFiles?.map(f => f.content).join('\n\n') || '';
  }

  if (!researchText) {
    return res.status(400).json({ error: 'Either sessionId or researchText is required for analysis' });
  }
  const sanitizedEntity = sanitizePrompt(entity);
  const sanitizedTaskName = sanitizePrompt(taskName);
  const geminiUserQuery = `**CRITICAL REMINDER:** You MUST escape all newlines (\\n) and double-quotes (") found in the research content before placing them into the final JSON string values.

Research Content:
${researchText}

**YOUR TASK:** Provide a full, detailed analysis for this specific task:
  - Entity: ${sanitizedEntity}
  - Task Name: ${sanitizedTaskName}`;
  const payload = {
    contents: [{ parts: [{ text: geminiUserQuery }] }],
    systemInstruction: { parts: [{ text: TASK_ANALYSIS_SYSTEM_PROMPT }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: TASK_ANALYSIS_SCHEMA,
      maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_ANALYSIS,
      temperature: CONFIG.API.TEMPERATURE_STRUCTURED,
      topP: CONFIG.API.TOP_P,
      topK: CONFIG.API.TOP_K,
      seed: CONFIG.API.SEED,
      thinkingConfig: {
        thinkingBudget: CONFIG.API.THINKING_BUDGET_ANALYSIS
      }
    }
  };
  try {
    const analysisData = await callGeminiForJson(payload);
    res.json(analysisData);
  } catch (e) {
    res.status(500).json({ error: `Error generating task analysis: ${e.message}` });
  }
});

router.post('/ask-question', apiLimiter, async (req, res) => {
  const { taskName, entity, question, sessionId, researchText: directResearchText } = req.body;
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: CONFIG.ERRORS.QUESTION_REQUIRED });
  }

  if (!entity || typeof entity !== 'string' || !entity.trim()) {
    return res.status(400).json({ error: CONFIG.ERRORS.ENTITY_REQUIRED });
  }

  if (!taskName || typeof taskName !== 'string' || !taskName.trim()) {
    return res.status(400).json({ error: CONFIG.ERRORS.TASK_NAME_REQUIRED });
  }
  let researchText = directResearchText;

  if (!researchText && sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    touchSession(sessionId);
    researchText = session.researchFiles?.map(f => f.content).join('\n\n') || '';
  }

  if (!researchText) {
    return res.status(400).json({ error: 'Either sessionId or researchText is required for Q&A' });
  }
  if (question.trim().length > CONFIG.VALIDATION.MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: CONFIG.ERRORS.QUESTION_TOO_LONG });
  }
  const sanitizedQuestion = sanitizePrompt(question);
  const sanitizedTaskName = sanitizePrompt(taskName);
  const sanitizedEntity = sanitizePrompt(entity);
  const geminiUserQuery = `Research Content:\n${researchText}\n\n**User Question:** ${sanitizedQuestion}`;
  const payload = {
    contents: [{ parts: [{ text: geminiUserQuery }] }],
    systemInstruction: { parts: [{ text: getQASystemPrompt(sanitizedTaskName, sanitizedEntity) }] },
    generationConfig: {
      maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_QA,
      temperature: CONFIG.API.TEMPERATURE_QA,
      topP: CONFIG.API.TOP_P,
      topK: CONFIG.API.TOP_K,
      thinkingConfig: {
        thinkingBudget: CONFIG.API.THINKING_BUDGET_ANALYSIS
      }
    }
  };
  try {
    const textResponse = await callGeminiForText(payload);
    res.json({ answer: textResponse });
  } catch (e) {
    console.error('Q&A error:', e.message);
    res.status(500).json({ error: `Error generating answer: ${e.message}` });
  }
});

export default router;
