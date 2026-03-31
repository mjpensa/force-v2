import express from 'express';
import rateLimit from 'express-rate-limit';
import { sessions } from './content.js';

const router = express.Router();

const sseLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

router.get('/stream/:sessionId', sseLimiter, (req, res) => {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  sendEvent(res, 'connected', { sessionId, timestamp: Date.now() });

  const session = sessions.get(sessionId);
  if (!session) {
    sendEvent(res, 'error', { message: 'Session not found', sessionId });
    res.end();
    return;
  }

  // Replay any events that happened before this client connected
  if (session.progress?.length > 0) {
    for (const event of session.progress) {
      sendEvent(res, event.type, event);
    }
  }

  // If pipeline already completed, send final event and close
  if (session.status === 'completed') {
    sendEvent(res, 'pipeline:completed', { timestamp: Date.now() });
    res.end();
    return;
  }

  // Subscribe to future events
  const listener = (event) => {
    sendEvent(res, event.type, event);
    if (event.type === 'pipeline:completed' || event.type === 'pipeline:failed') {
      cleanup();
    }
  };

  if (!session._listeners) session._listeners = new Set();
  session._listeners.add(listener);

  // Heartbeat every 15s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { cleanup(); }
  }, 15000);

  const cleanup = () => {
    clearInterval(heartbeat);
    session._listeners?.delete(listener);
    res.end();
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
});

function sendEvent(res, eventType, data) {
  try {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    // Client disconnected
  }
}

export default router;
