/**
 * Chart Routes Module
 * Handles chart generation endpoints
 *
 * Note: No persistence - charts are generated and returned directly
 */

import express from 'express';
import crypto from 'crypto';
import mammoth from 'mammoth';
import { CONFIG } from '../config.js';
import { sanitizePrompt } from '../utils.js';
import { callGeminiForJson } from '../gemini.js';
import { CHART_GENERATION_SYSTEM_PROMPT, GANTT_CHART_SCHEMA } from '../prompts.js';
import { strictLimiter, uploadMiddleware } from '../middleware.js';

const router = express.Router();

/**
 * POST /generate-chart
 * Generates a chart synchronously and returns it directly
 */
router.post('/generate-chart', uploadMiddleware.array('researchFiles'), strictLimiter, async (req, res) => {
  const requestId = crypto.randomBytes(8).toString('hex');

  try {

    const userPrompt = req.body.prompt;

    // Sanitize user prompt to prevent prompt injection attacks
    const sanitizedPrompt = sanitizePrompt(userPrompt);

    // Process files
    let researchText = "";
    let researchFiles = [];

    if (req.files && req.files.length > 0) {
      const sortedFiles = req.files.sort((a, b) => a.originalname.localeCompare(b.originalname));

      // Process files in parallel
      const fileProcessingPromises = sortedFiles.map(async (file) => {
        let content = '';

        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const result = await mammoth.convertToHtml({ buffer: file.buffer });
          content = result.value;
        } else {
          content = file.buffer.toString('utf8');
        }

        return {
          name: file.originalname,
          content: content
        };
      });

      const processedFiles = await Promise.all(fileProcessingPromises);

      for (const processedFile of processedFiles) {
        researchText += `\n\n--- Start of file: ${processedFile.name} ---\n`;
        researchFiles.push(processedFile.name);
        researchText += processedFile.content;
        researchText += `\n--- End of file: ${processedFile.name} ---\n`;
      }

    }

    // Build user query
    const geminiUserQuery = `${sanitizedPrompt}

**CRITICAL REMINDER:** You MUST escape all newlines (\\n) and double-quotes (") found in the research content before placing them into the final JSON string values.

Research Content:
${researchText}`;

    // Define the payload
    const payload = {
      contents: [{ parts: [{ text: geminiUserQuery }] }],
      systemInstruction: { parts: [{ text: CHART_GENERATION_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GANTT_CHART_SCHEMA,
        maxOutputTokens: CONFIG.API.MAX_OUTPUT_TOKENS_CHART,
        temperature: CONFIG.API.TEMPERATURE_STRUCTURED,
        topP: CONFIG.API.TOP_P,
        topK: CONFIG.API.TOP_K,
        seed: CONFIG.API.SEED,
        thinkingConfig: {
          thinkingBudget: CONFIG.API.THINKING_BUDGET_ANALYSIS
        }
      }
    };

    // Call the API
    const ganttData = await callGeminiForJson(
      payload,
      CONFIG.API.RETRY_COUNT,
      (attemptNum, error) => {
      }
    );

    // Validate data structure
    if (!ganttData || typeof ganttData !== 'object') {
      throw new Error('AI returned invalid data structure (not an object)');
    }

    if (!ganttData.timeColumns || !Array.isArray(ganttData.timeColumns)) {
      throw new Error('AI returned invalid timeColumns (not an array)');
    }

    if (!ganttData.data || !Array.isArray(ganttData.data)) {
      throw new Error('AI returned invalid data array (not an array)');
    }

    if (ganttData.timeColumns.length === 0) {
      throw new Error('AI returned empty timeColumns array');
    }

    if (ganttData.data.length === 0) {
      throw new Error('AI returned empty data array');
    }


    // Return chart data directly
    res.json({
      status: 'complete',
      data: ganttData
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * POST /update-task-dates
 * Acknowledges task date updates (client-side only)
 */
router.post('/update-task-dates', express.json(), (req, res) => {
  try {
    const {
      taskName,
      newStartCol,
      newEndCol,
      startDate,
      endDate
    } = req.body;

    // Validate required fields
    if (!taskName || newStartCol === undefined || newEndCol === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: taskName, newStartCol, newEndCol'
      });
    }


    res.json({
      success: true,
      message: 'Task dates updated',
      taskName,
      newStartCol,
      newEndCol,
      startDate,
      endDate
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update task dates',
      details: error.message
    });
  }
});

/**
 * POST /update-task-color
 * Acknowledges task color updates (client-side only)
 */
router.post('/update-task-color', express.json(), (req, res) => {
  try {
    const {
      taskName,
      taskIndex,
      newColor
    } = req.body;

    // Validate required fields
    if (!taskName || taskIndex === undefined || !newColor) {
      return res.status(400).json({
        error: 'Missing required fields: taskName, taskIndex, newColor'
      });
    }


    res.json({
      success: true,
      message: 'Task color updated',
      taskName,
      newColor
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update task color',
      details: error.message
    });
  }
});

export default router;
