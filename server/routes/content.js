import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { generateAllContent, generateIntelligenceBrief, generateSpeakerNotesAsync, regenerateContent } from '../generators.js';
import { uploadMiddleware } from '../middleware.js';
import { generatePptx } from '../templates/ppt-export-service-v2.js';
import { generateDocx, generateIntelligenceBriefDocx } from '../templates/docx-export-service.js';
import { fileCache } from '../cache/FileCache.js';

const router = express.Router();

const generationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many generation requests. Please wait before trying again.' }
});

// --- Constants ---

const VIEW_TYPE_MAP = {
  'roadmap': 'roadmap',
  'slides': 'slides',
  'document': 'document',
  'research-analysis': 'researchAnalysis',
  'swot-analysis': 'swotAnalysis',
  'competitive-analysis': 'competitiveAnalysis',
  'risk-register': 'riskRegister'
};
const VALID_VIEW_TYPES = Object.keys(VIEW_TYPE_MAP);

// --- Route helpers ---

async function processUploadedFiles(files) {
  const sortedFiles = files.sort((a, b) => a.originalname.localeCompare(b.originalname));
  return Promise.all(sortedFiles.map(async (file) => {
    const content = await fileCache.get(file.buffer, file.mimetype, file.originalname);
    return { filename: file.originalname, content };
  }));
}

function sanitizeFilename(title) {
  return title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
}

function getSessionOrFail(req, res, message) {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({
      error: 'Session not found',
      message: message || 'Session may have expired. Please generate new content.'
    });
    return null;
  }
  session.lastAccessed = Date.now(); // auto-touch
  return session;
}

function handleGenerationError(error, res, context = 'process request') {
  console.error(`[${context}] Error:`, error.message);
  res.status(500).json({ error: `Failed to ${context}. Please try again.` });
}

function exportFile(res, buffer, filename, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}

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
  const truncated = String(rawError).substring(0, 150);
  return `Failed to generate ${viewType}: ${truncated}${rawError.length > 150 ? '...' : ''}`;
}

export function emitSessionEvent(sessionId, event) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (!session.progress) session.progress = [];
  session.progress.push(event);
  if (session._listeners) {
    for (const listener of session._listeners) {
      try { listener(event); } catch (_) {}
    }
  }
}

router.post('/generate', generationLimiter, uploadMiddleware.array('researchFiles'), async (req, res) => {
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
    const researchFiles = await processUploadedFiles(files);
    const viewsParam = req.query.views;
    const requestedViews = viewsParam
      ? viewsParam.split(',').map(v => v.trim()).filter(v => VALID_VIEW_TYPES.includes(v))
      : null;

    const sessionId = generateSessionId();
    const now = Date.now();
    sessions.set(sessionId, {
      prompt,
      researchFiles,
      status: 'generating',
      content: {
        roadmap: { status: 'pending' },
        slides: { status: 'pending' },
        document: { status: 'pending' },
        researchAnalysis: { status: 'pending' },
        swotAnalysis: { status: 'pending' },
        competitiveAnalysis: { status: 'pending' },
        riskRegister: { status: 'pending' }
      },
      progress: [],
      _listeners: new Set(),
      createdAt: now,
      lastAccessed: now
    });
    enforceSessionLimit();

    res.status(202).json({ status: 'accepted', sessionId });

    // Fire-and-forget background generation
    runGenerationPipeline(sessionId, prompt, researchFiles, requestedViews).catch(err => {
      console.error(`[Generate] Pipeline error for ${sessionId}:`, err.message);
    });

  } catch (error) {
    handleGenerationError(error, res, 'generate content');
  }
});

async function runGenerationPipeline(sessionId, prompt, researchFiles, requestedViews) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const onProgress = (event) => {
    const ts = { ...event, timestamp: Date.now() };
    emitSessionEvent(sessionId, ts);

    if (event.type === 'view:completed' && event.result) {
      const keyMap = VIEW_TYPE_MAP;
      const contentKey = keyMap[event.view];
      if (contentKey && session.content) {
        session.content[contentKey] = event.result;
      }
    }
    if (event.type === 'view:failed' && event.view) {
      const keyMap = VIEW_TYPE_MAP;
      const contentKey = keyMap[event.view];
      if (contentKey && session.content) {
        session.content[contentKey] = { success: false, error: event.error };
      }
    }
  };

  try {
    await generateAllContent(prompt, researchFiles, requestedViews, onProgress);
  } catch (err) {
    emitSessionEvent(sessionId, { type: 'pipeline:failed', error: err.message, timestamp: Date.now() });
  }

  session.status = 'completed';
  session.lastAccessed = Date.now();
  emitSessionEvent(sessionId, { type: 'pipeline:completed', timestamp: Date.now() });
}

// GET /:sessionId/slides/export — MUST be before /:sessionId/:viewType
router.get('/:sessionId/slides/export', async (req, res) => {
  try {
    const session = getSessionOrFail(req, res);
    if (!session) return;

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
    const safeTitle = sanitizeFilename(title);
    exportFile(res, pptxBuffer, `${safeTitle}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

  } catch (error) {
    handleGenerationError(error, res, 'generate PowerPoint file');
  }
});

router.post('/:sessionId/slides/speaker-notes', generationLimiter, async (req, res) => {
  // 20 minutes: covers worst case of 3 API calls (outline + retry + full notes) at 6 min each
  const SPEAKER_NOTES_TIMEOUT_MS = 20 * 60 * 1000;
  req.setTimeout(SPEAKER_NOTES_TIMEOUT_MS);
  res.setTimeout(SPEAKER_NOTES_TIMEOUT_MS);

  try {
    const session = getSessionOrFail(req, res);
    if (!session) return;

    const slidesResult = session.content.slides;
    if (!slidesResult || !slidesResult.success || !slidesResult.data) {
      return res.status(400).json({
        error: 'Slides not available',
        message: 'Slides must be generated before speaker notes can be created.'
      });
    }
    if (slidesResult.speakerNotes?.slides?.length > 0) {
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
    handleGenerationError(error, res, 'generate speaker notes');
  }
});

// GET /:sessionId/document/export — MUST be before /:sessionId/:viewType
router.get('/:sessionId/document/export', async (req, res) => {
  try {
    const session = getSessionOrFail(req, res);
    if (!session) return;

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
    const safeTitle = sanitizeFilename(title);
    exportFile(res, docxBuffer, `${safeTitle}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  } catch (error) {
    handleGenerationError(error, res, 'generate Word document');
  }
});

router.post('/:sessionId/intelligence-brief/generate', generationLimiter, express.json(), async (req, res) => {
  const BRIEF_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  req.setTimeout(BRIEF_TIMEOUT_MS);
  res.setTimeout(BRIEF_TIMEOUT_MS);

  try {
    const { companyName, meetingAttendees, meetingObjective, keyConcerns } = req.body;
    const session = getSessionOrFail(req, res, 'Please generate content first before creating an intelligence brief.');
    if (!session) return;
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
    exportFile(res, buffer, `Pre_Meeting_Brief_${timestamp}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  } catch (error) {
    handleGenerationError(error, res, 'generate intelligence brief');
  }
});

router.post('/:sessionId/update-slide-field', express.json(), (req, res) => {
  try {
    const session = getSessionOrFail(req, res);
    if (!session) return;

    const { slideIndex, field, value } = req.body;
    const idx = Number(slideIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: 'Invalid slideIndex' });
    }
    const validFields = ['tagline', 'title', 'paragraph1', 'paragraph2', 'paragraph3', 'sectionTitle'];
    if (!validFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid field' });
    }
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'Invalid value' });
    }

    const slidesData = session.content.slides?.data;
    if (!slidesData?.sections) {
      return res.status(400).json({ error: 'No slides data found' });
    }

    // Flatten sections to find the slide at the given index
    let flatIdx = 0;
    for (const section of slidesData.sections) {
      // Account for section title slide (index flatIdx is the section title)
      if (flatIdx === idx) {
        // Editing the section title slide
        if (field === 'sectionTitle') section.sectionTitle = value;
        return res.json({ success: true });
      }
      flatIdx++;
      for (const slide of (section.slides || [])) {
        if (flatIdx === idx) {
          slide[field] = value;
          return res.json({ success: true });
        }
        flatIdx++;
      }
    }

    return res.status(400).json({ error: 'Slide not found at given index' });
  } catch (error) {
    handleGenerationError(error, res, 'update slide field');
  }
});

router.post('/:sessionId/:viewType/regenerate', generationLimiter, async (req, res) => {
  const REGEN_TIMEOUT_MS = 10 * 60 * 1000;
  req.setTimeout(REGEN_TIMEOUT_MS);
  res.setTimeout(REGEN_TIMEOUT_MS);
  try {
    const { viewType } = req.params;
    const contentKey = VIEW_TYPE_MAP[viewType];
    if (!contentKey) {
      return res.status(400).json({
        error: 'Invalid view type',
        message: `View type must be one of: ${VALID_VIEW_TYPES.join(', ')}`
      });
    }
    const session = getSessionOrFail(req, res);
    if (!session) return;
    if (!session.researchFiles || session.researchFiles.length === 0) {
      return res.status(400).json({
        error: 'Research files not available',
        message: 'Session research files have expired. Please generate new content.'
      });
    }
    const result = await regenerateContent(viewType, session.prompt, session.researchFiles, session.content);
    if (result.success) {
      session.content[contentKey] = result;
      session.lastAccessed = Date.now();
      return res.json({ status: 'completed', data: result.data });
    } else {
      session.content[contentKey] = result;
      return res.json({ status: 'error', error: formatUserError(result.error, viewType) });
    }
  } catch (error) {
    handleGenerationError(error, res, `regenerate ${req.params.viewType}`);
  }
});

router.get('/:sessionId/:viewType', (req, res) => {
  try {
    const { sessionId, viewType } = req.params;
    const session = getSessionOrFail(req, res, 'Session may have expired or does not exist. Please generate new content.');
    if (!session) return;
    const contentKey = VIEW_TYPE_MAP[viewType];
    if (!contentKey) {
      return res.status(400).json({
        error: 'Invalid view type',
        message: `View type must be one of: ${VALID_VIEW_TYPES.join(', ')}`
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
    handleGenerationError(error, res, 'retrieve content');
  }
});

router.post('/update-task-dates', express.json(), (req, res) => {
  try {
    const { sessionId } = req.body;

    const taskIndex = Number(req.body.taskIndex);
    if (!Number.isInteger(taskIndex) || taskIndex < 0) {
      return res.status(400).json({ error: 'Invalid taskIndex' });
    }
    const newStartCol = Number(req.body.newStartCol);
    const newEndCol = Number(req.body.newEndCol);
    if (!Number.isInteger(newStartCol) || !Number.isInteger(newEndCol) || newStartCol < 0 || newEndCol < 0) {
      return res.status(400).json({ error: 'Invalid column values' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    req.params.sessionId = sessionId;
    const session = getSessionOrFail(req, res);
    if (!session) return;

    const roadmapData = session.content.roadmap?.data;
    if (!roadmapData || !roadmapData.data || !roadmapData.data[taskIndex]) {
      return res.status(400).json({ error: 'Task not found in roadmap data' });
    }

    const task = roadmapData.data[taskIndex];
    if (task.bar) {
      task.bar.startCol = newStartCol;
      task.bar.endCol = newEndCol;
    }
    res.json({ success: true, task });
  } catch (error) {
    handleGenerationError(error, res, 'update task dates');
  }
});

router.post('/update-task-color', express.json(), (req, res) => {
  try {
    const { sessionId } = req.body;

    const taskIndex = Number(req.body.taskIndex);
    if (!Number.isInteger(taskIndex) || taskIndex < 0) {
      return res.status(400).json({ error: 'Invalid taskIndex' });
    }
    const { color } = req.body;
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Invalid color format' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    req.params.sessionId = sessionId;
    const session = getSessionOrFail(req, res);
    if (!session) return;

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
    handleGenerationError(error, res, 'update task color');
  }
});
router.post('/update-task-title', express.json(), (req, res) => {
  try {
    const { sessionId, newTitle } = req.body;

    const taskIndex = Number(req.body.taskIndex);
    if (!Number.isInteger(taskIndex) || taskIndex < 0) {
      return res.status(400).json({ error: 'Invalid taskIndex' });
    }
    if (typeof newTitle !== 'string' || newTitle.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid title' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    req.params.sessionId = sessionId;
    const session = getSessionOrFail(req, res);
    if (!session) return;

    const roadmapData = session.content.roadmap?.data;
    if (!roadmapData || !roadmapData.data || !roadmapData.data[taskIndex]) {
      return res.status(400).json({ error: 'Task not found in roadmap data' });
    }

    roadmapData.data[taskIndex].title = newTitle.trim();
    res.json({ success: true, task: roadmapData.data[taskIndex] });
  } catch (error) {
    handleGenerationError(error, res, 'update task title');
  }
});

export default router;
