/**
 * Unified Content Generation Routes
 * Handles synchronous generation of all three content types
 * (Roadmap, Slides, Document)
 *
 * Note: In-memory session storage (cleared on server restart)
 *
 * Performance optimizations:
 * - LRU-style session cache with memory pressure handling
 * - Efficient file processing with streaming
 * - Response caching headers
 */

import express from 'express';
import mammoth from 'mammoth';
import crypto from 'crypto';
import { generateAllContent, regenerateContent } from '../generators.js';
import { uploadMiddleware, handleUploadErrors } from '../middleware.js';
import { generatePptx } from '../templates/ppt-export-service.js';

const router = express.Router();

// In-memory session storage with LRU-style management
// Map<sessionId, { prompt, researchFiles, content, createdAt, lastAccessed }>
const sessions = new Map();
const MAX_SESSIONS = 100; // Limit max sessions to prevent memory issues
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// Performance: Track access for LRU eviction
function touchSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastAccessed = Date.now();
  }
}

// Performance: LRU-style cleanup when over capacity
function enforceSessionLimit() {
  if (sessions.size <= MAX_SESSIONS) return;

  // Sort by lastAccessed (oldest first) and remove excess
  const sortedSessions = [...sessions.entries()]
    .sort((a, b) => (a[1].lastAccessed || a[1].createdAt) - (b[1].lastAccessed || b[1].createdAt));

  const toRemove = sessions.size - MAX_SESSIONS;
  for (let i = 0; i < toRemove; i++) {
    sessions.delete(sortedSessions[i][0]);
  }
}

// Clean up old sessions (older than 1 hour since last access) and enforce limits
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    // Use lastAccessed time (not createdAt) so active sessions don't expire
    const lastActivity = session.lastAccessed || session.createdAt;
    if (now - lastActivity > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
  enforceSessionLimit();
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return crypto.randomUUID();
}

/**
 * Format raw error messages into user-friendly text
 * @param {string} rawError - Raw error message
 * @param {string} viewType - Content type (roadmap, slides, document)
 * @returns {string} User-friendly error message
 */
function formatUserError(rawError, viewType) {
  if (!rawError) return `Failed to generate ${viewType}. Please try again.`;

  // Map common error patterns to user-friendly messages
  const errorMappings = [
    { pattern: /JSON.*parse.*position/i, message: 'The AI response was malformed. Please try again.' },
    { pattern: /timeout|timed out/i, message: 'Generation took too long. Please try again with simpler content.' },
    { pattern: /rate limit/i, message: 'Too many requests. Please wait a moment and try again.' },
    { pattern: /empty.*content|no.*section|invalid.*content/i, message: 'The AI could not generate valid content. Try providing more detailed source material.' },
    { pattern: /network|connection|ECONNREFUSED/i, message: 'Network error occurred. Please check your connection and try again.' },
    { pattern: /quota|exceeded/i, message: 'API quota exceeded. Please try again later.' },
    { pattern: /invalid.*schema|validation.*failed/i, message: 'Generated content did not match expected format. Please try again.' }
  ];

  for (const mapping of errorMappings) {
    if (mapping.pattern.test(rawError)) {
      return mapping.message;
    }
  }

  // Default: Return sanitized version of original error (limit length)
  const sanitized = rawError.substring(0, 150);
  return `Failed to generate ${viewType}: ${sanitized}${rawError.length > 150 ? '...' : ''}`;
}

/**
 * POST /api/content/generate
 * Generates all content types (roadmap, slides, document, research-analysis) synchronously
 *
 * Request (multipart/form-data):
 * - prompt: string (form field)
 * - researchFiles: File[] (uploaded files)
 *
 * Response:
 * {
 *   status: 'completed' | 'error',
 *   content: {
 *     roadmap: { success, data, error },
 *     slides: { success, data, error },
 *     document: { success, data, error },
 *     researchAnalysis: { success, data, error }
 *   }
 * }
 */
router.post('/generate', uploadMiddleware.array('researchFiles'), async (req, res) => {
  // Extend timeout for long-running generation (4 sequential AI calls, each up to 5 min)
  // Default timeout is 2 minutes which is insufficient
  const GENERATE_TIMEOUT_MS = 25 * 60 * 1000; // 25 minutes
  req.setTimeout(GENERATE_TIMEOUT_MS);
  res.setTimeout(GENERATE_TIMEOUT_MS);
  try {
    const { prompt } = req.body;
    const files = req.files;

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request. Required: prompt (string)'
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'At least one research file is required'
      });
    }

    // Process uploaded files to extract content
    const sortedFiles = files.sort((a, b) => a.originalname.localeCompare(b.originalname));

    // Process files in parallel
    const fileProcessingPromises = sortedFiles.map(async (file) => {
      let content = '';

      // Handle DOCX files with mammoth
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.convertToHtml({ buffer: file.buffer });
        content = result.value;
      } else {
        // Handle text-based files (TXT, MD, etc.)
        content = file.buffer.toString('utf8');
      }

      return {
        filename: file.originalname,
        content: content
      };
    });

    // Wait for all files to be processed
    const researchFiles = await Promise.all(fileProcessingPromises);

    // Generate all content synchronously
    const results = await generateAllContent(prompt, researchFiles);

    // Create session and store content (including research for task analysis)
    const sessionId = generateSessionId();
    const now = Date.now();
    sessions.set(sessionId, {
      prompt,
      researchFiles: researchFiles.map(f => f.filename),
      // Store research content for session-based task analysis (truncated to limit memory)
      researchContent: researchFiles.map(f => f.content).join('\n\n---\n\n').substring(0, 500000),
      content: {
        roadmap: results.roadmap,
        slides: results.slides,
        document: results.document,
        researchAnalysis: results.researchAnalysis
      },
      createdAt: now,
      lastAccessed: now
    });

    // Enforce session limit after adding new session
    enforceSessionLimit();

    // Return sessionId for frontend to poll/fetch content
    res.json({
      status: 'completed',
      sessionId,
      prompt,
      researchFiles: researchFiles.map(f => f.filename),
      content: {
        roadmap: results.roadmap,
        slides: results.slides,
        document: results.document,
        researchAnalysis: results.researchAnalysis
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * POST /api/content/regenerate/:viewType
 * Regenerates content for a specific view type
 *
 * Request (multipart/form-data):
 * - prompt: string (form field)
 * - researchFiles: File[] (uploaded files)
 * - viewType (URL param): 'roadmap', 'slides', 'document', or 'research-analysis'
 *
 * Response:
 * {
 *   viewType: string,
 *   status: 'completed' | 'error',
 *   data: object | null,
 *   error: string | null
 * }
 */
router.post('/regenerate/:viewType', uploadMiddleware.array('researchFiles'), async (req, res) => {
  // Extend timeout for long-running AI generation (up to 5 min per content type)
  const REGENERATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  req.setTimeout(REGENERATE_TIMEOUT_MS);
  res.setTimeout(REGENERATE_TIMEOUT_MS);

  try {
    const { viewType } = req.params;
    const { prompt } = req.body;
    const files = req.files;

    // Validate view type
    const validViewTypes = ['roadmap', 'slides', 'document', 'research-analysis'];
    if (!validViewTypes.includes(viewType)) {
      return res.status(400).json({
        error: `Invalid view type. Must be one of: ${validViewTypes.join(', ')}`
      });
    }

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request. Required: prompt (string)'
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'At least one research file is required'
      });
    }

    // Process uploaded files
    const sortedFiles = files.sort((a, b) => a.originalname.localeCompare(b.originalname));
    const fileProcessingPromises = sortedFiles.map(async (file) => {
      let content = '';
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.convertToHtml({ buffer: file.buffer });
        content = result.value;
      } else {
        content = file.buffer.toString('utf8');
      }
      return { filename: file.originalname, content };
    });
    const researchFiles = await Promise.all(fileProcessingPromises);

    // Regenerate content
    const result = await regenerateContent(viewType, prompt, researchFiles);

    res.json({
      viewType,
      status: result.success ? 'completed' : 'error',
      data: result.data || null,
      error: result.error ? formatUserError(result.error, viewType) : null
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to regenerate content',
      details: error.message
    });
  }
});

/**
 * GET /api/content/:sessionId/slides/export
 * Exports slides from a session as a branded PowerPoint file
 *
 * NOTE: This route MUST be defined before /:sessionId/:viewType to avoid being shadowed
 *
 * URL params:
 * - sessionId: string - Session ID
 *
 * Response: PowerPoint file (.pptx) download
 */
router.get('/:sessionId/slides/export', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session may have expired. Please generate new content.'
      });
    }

    const slidesResult = session.content.slides;
    if (!slidesResult || !slidesResult.success || !slidesResult.data) {
      return res.status(404).json({
        error: 'Slides not available',
        message: slidesResult?.error || 'Slides generation failed or not yet complete'
      });
    }

    const slides = slidesResult.data;

    // Generate the PowerPoint file
    const pptxBuffer = await generatePptx(slides, {
      author: 'BIP',
      company: 'BIP'
    });

    // Create filename from presentation title
    const title = slides.title || 'Presentation';
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}.pptx`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptxBuffer.length);

    res.send(pptxBuffer);

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate PowerPoint file',
      details: error.message
    });
  }
});

/**
 * GET /api/content/:sessionId/:viewType
 * Retrieves content for a specific view type from a session
 *
 * URL params:
 * - sessionId: string - Session ID from /generate response
 * - viewType: 'roadmap' | 'slides' | 'document' | 'research-analysis'
 *
 * Response:
 * - For roadmap: Returns the gantt data directly
 * - For other views: Returns { success, data, error }
 */
router.get('/:sessionId/:viewType', (req, res) => {
  try {
    const { sessionId, viewType } = req.params;

    // Check if session exists
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session may have expired or does not exist. Please generate new content.',
        hint: 'Sessions expire after 1 hour'
      });
    }

    // Performance: Track access for LRU management
    touchSession(sessionId);

    // Map viewType to content key
    const viewTypeMap = {
      'roadmap': 'roadmap',
      'slides': 'slides',
      'document': 'document',
      'research-analysis': 'researchAnalysis'
    };

    const contentKey = viewTypeMap[viewType];
    if (!contentKey) {
      return res.status(400).json({
        error: 'Invalid view type',
        message: `View type must be one of: ${Object.keys(viewTypeMap).join(', ')}`
      });
    }

    const contentResult = session.content[contentKey];
    if (!contentResult) {
      return res.status(404).json({
        error: 'Content not found',
        message: `No ${viewType} content available for this session`
      });
    }

    // Performance: Add cache control headers for completed content
    if (contentResult.success && contentResult.data) {
      // Cache successful responses for 5 minutes on the client
      res.set('Cache-Control', 'private, max-age=300');
      res.set('ETag', `"${sessionId}-${viewType}-${session.lastAccessed}"`);

      return res.json({
        status: 'completed',
        data: contentResult.data
      });
    } else {
      // Don't cache error responses
      res.set('Cache-Control', 'no-store');
      return res.json({
        status: 'error',
        error: formatUserError(contentResult.error, viewType)
      });
    }

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve content',
      details: error.message
    });
  }
});

/**
 * POST /api/content/slides/export
 * Exports slides as a branded PowerPoint file (direct POST, no session)
 *
 * Request body:
 * - slides: object (slides data to export)
 *
 * Response: PowerPoint file (.pptx) download
 */
router.post('/slides/export', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { slides } = req.body;

    if (!slides || !slides.slides || !Array.isArray(slides.slides)) {
      return res.status(400).json({
        error: 'Invalid slides data',
        message: 'Request must include slides object with slides array'
      });
    }


    // Generate the PowerPoint file
    const pptxBuffer = await generatePptx(slides, {
      author: 'BIP',
      company: 'BIP'
    });

    // Create filename from presentation title
    const title = slides.title || 'Presentation';
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}.pptx`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptxBuffer.length);


    res.send(pptxBuffer);

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate PowerPoint file',
      details: error.message
    });
  }
});

/**
 * POST /api/content/update-task-dates
 * Updates task bar positions (start/end columns) in the session
 *
 * Request body:
 * - sessionId: string
 * - taskIndex: number (index in ganttData.data array)
 * - startCol: number (new start column)
 * - endCol: number (new end column)
 */
router.post('/update-task-dates', express.json(), (req, res) => {
  try {
    const { sessionId, taskIndex, startCol, endCol } = req.body;

    if (!sessionId || taskIndex === undefined) {
      return res.status(400).json({ error: 'sessionId and taskIndex are required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    touchSession(sessionId);

    // Update the task in roadmap data
    const roadmapData = session.content.roadmap?.data;
    if (!roadmapData || !roadmapData.data || !roadmapData.data[taskIndex]) {
      return res.status(400).json({ error: 'Task not found in roadmap data' });
    }

    const task = roadmapData.data[taskIndex];
    if (task.bar) {
      if (startCol !== undefined) task.bar.startCol = startCol;
      if (endCol !== undefined) task.bar.endCol = endCol;
    }

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task dates', details: error.message });
  }
});

/**
 * POST /api/content/update-task-color
 * Updates task bar color in the session
 *
 * Request body:
 * - sessionId: string
 * - taskIndex: number (index in ganttData.data array)
 * - color: string (new color class)
 */
router.post('/update-task-color', express.json(), (req, res) => {
  try {
    const { sessionId, taskIndex, color } = req.body;

    if (!sessionId || taskIndex === undefined || !color) {
      return res.status(400).json({ error: 'sessionId, taskIndex, and color are required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    touchSession(sessionId);

    // Update the task in roadmap data
    const roadmapData = session.content.roadmap?.data;
    if (!roadmapData || !roadmapData.data || !roadmapData.data[taskIndex]) {
      return res.status(400).json({ error: 'Task not found in roadmap data' });
    }

    const task = roadmapData.data[taskIndex];
    if (task.bar) {
      task.bar.color = color;
    }

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task color', details: error.message });
  }
});

// Apply upload error handling middleware
router.use(handleUploadErrors);

// Export sessions map for use by analysis routes
export { sessions, touchSession };

export default router;
