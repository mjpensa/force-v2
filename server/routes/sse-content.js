import express from 'express';
import { sessions } from './content.js';

const router = express.Router();

router.get('/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection event
  sendEvent(res, 'connected', {
    sessionId,
    timestamp: Date.now(),
    message: 'SSE connection established'
  });
  const session = sessions.get(sessionId);
  if (!session) {
    sendEvent(res, 'error', {
      message: 'Session not found',
      sessionId
    });
    res.end();
    return;
  }

  const interval = setInterval(() => {
    const currentSession = sessions.get(sessionId);

    if (!currentSession) {
      sendEvent(res, 'error', { message: 'Session expired' });
      cleanup();
      return;
    }
    const status = {
      type: 'progress',
      timestamp: Date.now(),
      content: {
        roadmap: getContentStatus(currentSession, 'roadmap'),
        slides: getContentStatus(currentSession, 'slides'),
        document: getContentStatus(currentSession, 'document'),
        researchAnalysis: getContentStatus(currentSession, 'researchAnalysis')
      }
    };

    sendEvent(res, 'progress', status);
    const allComplete = ['roadmap', 'slides', 'document', 'researchAnalysis']
      .every(view => {
        const content = currentSession.content[view];
        return content && (content.success || content.error);
      });

    if (allComplete) {
      const allSuccess = ['roadmap', 'slides', 'document', 'researchAnalysis']
        .every(view => currentSession.content[view]?.success);

      sendEvent(res, 'complete', {
        timestamp: Date.now(),
        success: allSuccess,
        summary: {
          roadmap: currentSession.content.roadmap?.success ? 'ready' : 'failed',
          slides: currentSession.content.slides?.success ? 'ready' : 'failed',
          document: currentSession.content.document?.success ? 'ready' : 'failed',
          researchAnalysis: currentSession.content.researchAnalysis?.success ? 'ready' : 'failed'
        }
      });

      cleanup();
    }
  }, 2000);

  // Cleanup function
  const cleanup = () => {
    clearInterval(interval);
    res.end();
  };

  // Handle client disconnect
  req.on('close', cleanup);
  req.on('error', cleanup);
});

function getContentStatus(session, viewName) {
  const content = session.content[viewName];

  if (!content) {
    return { status: 'pending', ready: false };
  }

  if (content.success) {
    return {
      status: 'completed',
      ready: true,
      hasData: !!content.data
    };
  }

  if (content.error) {
    return {
      status: 'error',
      ready: false,
      error: content.error
    };
  }

  return { status: 'generating', ready: false };
}

function sendEvent(res, eventType, data) {
  try {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    console.error('[SSE] Error sending event:', error.message);
  }
}

export default router;
