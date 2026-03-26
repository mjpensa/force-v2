import express from 'express';
import { sessions } from './content.js';

const router = express.Router();
const VIEWS = ['roadmap', 'slides', 'document', 'researchAnalysis'];

router.get('/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');

  sendEvent(res, 'connected', { sessionId, timestamp: Date.now() });

  const session = sessions.get(sessionId);
  if (!session) {
    sendEvent(res, 'error', { message: 'Session not found', sessionId });
    res.end();
    return;
  }

  // Content is generated atomically before SSE connects, so check immediately
  if (emitIfComplete(session, res)) return;

  // Fallback: poll for edge cases where client connects mid-generation
  const interval = setInterval(() => {
    const current = sessions.get(sessionId);
    if (!current) {
      sendEvent(res, 'error', { message: 'Session expired' });
      cleanup();
      return;
    }
    if (emitIfComplete(current, res)) cleanup();
  }, 2000);

  const cleanup = () => { clearInterval(interval); res.end(); };
  req.on('close', cleanup);
  req.on('error', cleanup);
});

function emitIfComplete(session, res) {
  const allDone = VIEWS.every(v => {
    const c = session.content[v];
    return c && (c.success || c.error);
  });
  if (!allDone) return false;

  const allSuccess = VIEWS.every(v => session.content[v]?.success);
  const summary = Object.fromEntries(
    VIEWS.map(v => [v, session.content[v]?.success ? 'ready' : 'failed'])
  );
  sendEvent(res, 'complete', { timestamp: Date.now(), success: allSuccess, summary });
  res.end();
  return true;
}

function sendEvent(res, eventType, data) {
  try {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    console.error('[SSE] Error sending event:', error.message);
  }
}

export default router;
