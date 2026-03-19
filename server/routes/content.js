import express from 'express';
import crypto from 'crypto';
import { generateAllContent, regenerateContent, generateIntelligenceBrief, generateSpeakerNotesAsync } from '../generators.js';
import { uploadMiddleware, handleUploadErrors } from '../middleware.js';
import { generatePptx } from '../templates/ppt-export-service-v2.js';
import { generateDocx, generateIntelligenceBriefDocx } from '../templates/docx-export-service.js';
import { fileCache } from '../cache/FileCache.js';

const router = express.Router();

export const sessions = new Map();
const MAX_SESSIONS = 100;
const SESSION_TTL_MS = 60 * 60 * 1000;

export function touchSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastAccessed = Date.now();
  }
}

function enforceSessionLimit() {
  if (sessions.size <= MAX_SESSIONS) return;

  const sortedSessions = [...sessions.entries()]
    .sort((a, b) => (a[1].lastAccessed || a[1].createdAt) - (b[1].lastAccessed || b[1].createdAt));

  const toRemove = sessions.size - MAX_SESSIONS;
  for (let i = 0; i < toRemove; i++) {
    sessions.delete(sortedSessions[i][0]);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    const lastActivity = session.lastAccessed || session.createdAt;
    if (now - lastActivity > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
  enforceSessionLimit();
}, 5 * 60 * 1000);

function generateSessionId() {
  return crypto.randomUUID();
}

function formatUserError(rawError, viewType) {
  if (!rawError) return `Failed to generate ${viewType}. Please try again.`;

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

  const sanitized = rawError.substring(0, 150);
  return `Failed to generate ${viewType}: ${sanitized}${rawError.length > 150 ? '...' : ''}`;
}

router.post('/generate', uploadMiddleware.array('researchFiles'), async (req, res) => {
  const GENERATE_TIMEOUT_MS = 25 * 60 * 1000;
  req.setTimeout(GENERATE_TIMEOUT_MS);
  res.setTimeout(GENERATE_TIMEOUT_MS);
  try {
    const { prompt } = req.body;
    const files = req.files;
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
    const sortedFiles = files.sort((a, b) => a.originalname.localeCompare(b.originalname));
    const fileProcessingPromises = sortedFiles.map(async (file) => {
      const content = await fileCache.get(file.buffer, file.mimetype, file.originalname);

      return {
        filename: file.originalname,
        content: content
      };
    });
    const researchFiles = await Promise.all(fileProcessingPromises);
    const results = await generateAllContent(prompt, researchFiles);
    const sessionId = generateSessionId();
    const now = Date.now();
    sessions.set(sessionId, {
      prompt,
      researchFiles: researchFiles.map(f => ({ filename: f.filename, content: f.content })),
      content: {
        roadmap: results.roadmap,
        slides: results.slides,
        document: results.document,
        researchAnalysis: results.researchAnalysis
      },
      createdAt: now,
      lastAccessed: now
    });
    enforceSessionLimit();
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

router.post('/regenerate/:viewType', uploadMiddleware.array('researchFiles'), async (req, res) => {
  const REGENERATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  req.setTimeout(REGENERATE_TIMEOUT_MS);
  res.setTimeout(REGENERATE_TIMEOUT_MS);

  try {
    const { viewType } = req.params;
    const { prompt } = req.body;
    const files = req.files;
    const validViewTypes = ['roadmap', 'slides', 'document', 'research-analysis'];
    if (!validViewTypes.includes(viewType)) {
      return res.status(400).json({
        error: `Invalid view type. Must be one of: ${validViewTypes.join(', ')}`
      });
    }
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
    const sortedFiles = files.sort((a, b) => a.originalname.localeCompare(b.originalname));
    const fileProcessingPromises = sortedFiles.map(async (file) => {
      const content = await fileCache.get(file.buffer, file.mimetype, file.originalname);
      return { filename: file.originalname, content };
    });
    const researchFiles = await Promise.all(fileProcessingPromises);
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

router.post('/:sessionId/regenerate/:viewType', express.json(), async (req, res) => {
  const REGENERATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  req.setTimeout(REGENERATE_TIMEOUT_MS);
  res.setTimeout(REGENERATE_TIMEOUT_MS);

  try {
    const { sessionId, viewType } = req.params;
    const { prompt: newPrompt } = req.body;
    const validViewTypes = ['roadmap', 'slides', 'document', 'research-analysis'];
    if (!validViewTypes.includes(viewType)) {
      return res.status(400).json({
        error: `Invalid view type. Must be one of: ${validViewTypes.join(', ')}`
      });
    }
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        message: 'Please upload files again to regenerate content.'
      });
    }
    if (!session.researchFiles || session.researchFiles.length === 0) {
      return res.status(400).json({
        error: 'Session has no cached research files',
        message: 'Please use the standard regenerate endpoint with file upload.'
      });
    }

    touchSession(sessionId);
    const researchFiles = session.researchFiles;
    const prompt = newPrompt || session.prompt;

    console.log(`[Session Regenerate] ${viewType} using ${researchFiles.length} cached files from session ${sessionId}`);
    const result = await regenerateContent(viewType, prompt, researchFiles);
    const contentKey = viewType === 'research-analysis' ? 'researchAnalysis' : viewType;
    if (result.success) {
      session.content[contentKey] = result;
      session.lastAccessed = Date.now();
    }

    res.json({
      viewType,
      status: result.success ? 'completed' : 'error',
      data: result.data || null,
      error: result.error ? formatUserError(result.error, viewType) : null
    });

  } catch (error) {
    console.error('[Session Regenerate] Error:', error);
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
    const slides = {
      ...slidesResult.data,
      speakerNotes: slidesResult.speakerNotes || null
    };
    const pptxBuffer = await generatePptx(slides, {
      author: 'BIP',
      company: 'BIP'
    });
    const title = slides.title || 'Presentation';
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}.pptx`;
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

router.post('/:sessionId/slides/speaker-notes', async (req, res) => {
  // 20 minutes: covers worst case of 3 API calls (outline + retry + full notes) at 6 min each
  const SPEAKER_NOTES_TIMEOUT_MS = 20 * 60 * 1000;
  req.setTimeout(SPEAKER_NOTES_TIMEOUT_MS);
  res.setTimeout(SPEAKER_NOTES_TIMEOUT_MS);

  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session may have expired. Please generate new content.'
      });
    }

    touchSession(sessionId);
    const slidesResult = session.content.slides;
    if (!slidesResult || !slidesResult.success || !slidesResult.data) {
      return res.status(400).json({
        error: 'Slides not available',
        message: 'Slides must be generated before speaker notes can be created.'
      });
    }
    if (slidesResult.speakerNotes?.slides?.length > 0) {
      console.log(`[Speaker Notes] Returning cached notes for session ${sessionId}`);
      return res.json({
        status: 'completed',
        data: slidesResult.speakerNotes,
        cached: true
      });
    }
    if (!session.researchFiles || session.researchFiles.length === 0) {
      return res.status(400).json({
        error: 'Research files not available',
        message: 'Session research files have expired. Please regenerate content.'
      });
    }

    console.log(`[Speaker Notes] Generating on-demand for session ${sessionId}`);
    const result = await generateSpeakerNotesAsync(
      slidesResult.data,
      session.researchFiles,
      session.prompt
    );

    if (result.success && result.data) {
      session.content.slides.speakerNotes = result.data;
      session.lastAccessed = Date.now();

      res.json({
        status: 'completed',
        data: result.data
      });
    } else {
      res.json({
        status: 'error',
        error: result.error || 'Failed to generate speaker notes'
      });
    }

  } catch (error) {
    console.error('[Speaker Notes] Error:', error);
    res.status(500).json({
      error: 'Failed to generate speaker notes',
      details: error.message
    });
  }
});

/**
 * GET /api/content/:sessionId/document/export
 * Exports document from a session as a Word file (.docx)
 *
 * NOTE: This route MUST be defined before /:sessionId/:viewType to avoid being shadowed
 *
 * URL params:
 * - sessionId: string - Session ID
 *
 * Response: Word document file (.docx) download
 */
router.get('/:sessionId/document/export', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session may have expired. Please generate new content.'
      });
    }

    const documentResult = session.content.document;
    if (!documentResult || !documentResult.success || !documentResult.data) {
      return res.status(404).json({
        error: 'Document not available',
        message: documentResult?.error || 'Document generation failed or not yet complete'
      });
    }

    const documentData = documentResult.data;
    const docxBuffer = await generateDocx(documentData, {
      creator: 'BIP'
    });
    const title = documentData.title || 'Executive_Summary';
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);

    res.send(docxBuffer);

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate Word document',
      details: error.message
    });
  }
});

router.post('/:sessionId/intelligence-brief/generate', express.json(), async (req, res) => {
  const BRIEF_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  req.setTimeout(BRIEF_TIMEOUT_MS);
  res.setTimeout(BRIEF_TIMEOUT_MS);

  try {
    const { sessionId } = req.params;
    const { companyName, meetingAttendees, meetingObjective, keyConcerns } = req.body;
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        message: 'Please generate content first before creating an intelligence brief.'
      });
    }
    if (!companyName?.trim()) {
      return res.status(400).json({
        error: 'Company name is required',
        message: 'Please specify the company name for the meeting.'
      });
    }
    if (!meetingAttendees?.trim()) {
      return res.status(400).json({
        error: 'Meeting attendees are required',
        message: 'Please specify who will be in the meeting.'
      });
    }
    if (!meetingObjective?.trim()) {
      return res.status(400).json({
        error: 'Meeting objective is required',
        message: 'Please specify the objective for this meeting.'
      });
    }

    touchSession(sessionId);
    const sessionData = {
      sources: session.researchFiles || [],
      document: session.content.document?.data || null,
      roadmap: session.content.roadmap?.data || null,
      slides: session.content.slides?.data || null
    };
    const hasData = sessionData.sources.length > 0 ||
                    sessionData.document ||
                    sessionData.roadmap ||
                    sessionData.slides;

    if (!hasData) {
      return res.status(400).json({
        error: 'No analysis data available',
        message: 'Please generate content in at least one view first before creating an intelligence brief.'
      });
    }

    console.log(`[Intelligence Brief] Generating for session ${sessionId}`, {
      sources: sessionData.sources.length,
      hasDocument: !!sessionData.document,
      hasRoadmap: !!sessionData.roadmap,
      hasSlides: !!sessionData.slides
    });

    const meetingContext = {
      companyName: companyName.trim(),
      meetingAttendees: meetingAttendees.trim(),
      meetingObjective: meetingObjective.trim(),
      keyConcerns: keyConcerns?.trim() || ''
    };
    const result = await generateIntelligenceBrief(sessionData, meetingContext);

    if (!result.success) {
      return res.status(500).json({
        error: 'Generation failed',
        message: result.error || 'Failed to generate intelligence brief. Please try again.'
      });
    }
    const buffer = await generateIntelligenceBriefDocx(result.data, meetingContext);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Pre_Meeting_Brief_${timestamp}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    console.log(`[Intelligence Brief] Generated and sending ${buffer.length} bytes`);
    res.send(buffer);

  } catch (error) {
    console.error('[Intelligence Brief] Error:', error);
    res.status(500).json({
      error: 'Failed to generate intelligence brief',
      details: error.message
    });
  }
});

router.get('/:sessionId/:viewType', (req, res) => {
  try {
    const { sessionId, viewType } = req.params;
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session may have expired or does not exist. Please generate new content.',
        hint: 'Sessions expire after 1 hour'
      });
    }
    touchSession(sessionId);
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
    if (contentResult.success && contentResult.data) {
      res.set('Cache-Control', 'private, max-age=300');
      res.set('ETag', `"${sessionId}-${viewType}-${session.lastAccessed}"`);

      // Include speaker notes for slides view
      const responseData = viewType === 'slides' && contentResult.speakerNotes
        ? { ...contentResult.data, speakerNotes: contentResult.speakerNotes }
        : contentResult.data;

      return res.json({
        status: 'completed',
        data: responseData
      });
    } else {
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

router.post('/slides/export', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { slides } = req.body;

    if (!slides || !slides.sections || !Array.isArray(slides.sections)) {
      return res.status(400).json({
        error: 'Invalid slides data',
        message: 'Request must include slides object with sections array'
      });
    }
    const pptxBuffer = await generatePptx(slides, {
      author: 'BIP',
      company: 'BIP'
    });
    const title = slides.title || 'Presentation';
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}.pptx`;
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

router.post('/document/export', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { document } = req.body;

    if (!document || !document.title) {
      return res.status(400).json({
        error: 'Invalid document data',
        message: 'Request must include document object with at least a title'
      });
    }
    const docxBuffer = await generateDocx(document, {
      creator: 'BIP'
    });
    const title = document.title || 'Executive_Summary';
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    const filename = `${safeTitle}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);

    res.send(docxBuffer);

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate Word document',
      details: error.message
    });
  }
});

router.post('/update-task-dates', express.json(), (req, res) => {
  try {
    const { sessionId, taskIndex, newStartCol, newEndCol } = req.body;

    if (!sessionId || taskIndex === undefined) {
      return res.status(400).json({ error: 'sessionId and taskIndex are required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    touchSession(sessionId);
    const roadmapData = session.content.roadmap?.data;
    if (!roadmapData || !roadmapData.data || !roadmapData.data[taskIndex]) {
      return res.status(400).json({ error: 'Task not found in roadmap data' });
    }

    const task = roadmapData.data[taskIndex];
    if (task.bar) {
      if (newStartCol !== undefined) task.bar.startCol = newStartCol;
      if (newEndCol !== undefined) task.bar.endCol = newEndCol;
    }

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task dates', details: error.message });
  }
});

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
router.use(handleUploadErrors);

export default router;
