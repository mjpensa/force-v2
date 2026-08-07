import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import cors from 'cors';

import { CONFIG } from './server/config.js';

import {
  configureHelmet,
  configureCacheControl,
  handleUploadErrors
} from './server/middleware.js';

import analysisRoutes from './server/routes/analysis.js';
import contentRoutes from './server/routes/content.js';
import sseContentRoutes from './server/routes/sse-content.js';
const app = express();
const port = CONFIG.SERVER.PORT;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.set('trust proxy', CONFIG.SERVER.TRUST_PROXY_HOPS);
app.use(compression());

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

app.use(configureHelmet());

app.use(configureCacheControl);

app.use(express.json({ limit: '50mb' }));

app.use(express.static(join(__dirname, 'Public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true
}));

if (process.env.NODE_ENV === 'production') {
  app.use('/dist', express.static(join(__dirname, 'Public', 'dist'), {
    maxAge: '7d',
    immutable: true
  }));
}

let serverStartTime = null;
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    startedAt: serverStartTime,
    uptime: serverStartTime ? Math.floor((Date.now() - new Date(serverStartTime).getTime()) / 1000) : 0
  });
});
app.use('/', analysisRoutes);
app.use('/api/content', sseContentRoutes); // SSE streaming — must be before contentRoutes so /stream/:sessionId isn't caught by /:sessionId/:viewType
app.use('/api/content', contentRoutes);
app.use(handleUploadErrors);
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  console.error('Server will exit due to uncaught exception');
  process.exit(1);
});

// Railway restarts the process on every deploy. Generation is fire-and-forget after a 202
// (routes/content.js), sessions live only in this process's memory, and a full pipeline is
// 10-12 sequential model calls — so an abrupt exit drops in-flight work whose quota is
// already spent and leaves the client polling a session that will never complete.
//
// This drains connections rather than severing them. It does NOT persist in-flight
// generations; surviving a restart mid-pipeline needs durable session state, which is a
// larger change than this.
const SHUTDOWN_GRACE_MS = 10000;
let server = null;
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: draining connections (up to ${SHUTDOWN_GRACE_MS / 1000}s)`);

  if (!server) {
    process.exit(0);
  }

  // Don't let a slow or hung connection hold the process open forever.
  const forceExit = setTimeout(() => {
    console.error(`Drain did not finish within ${SHUTDOWN_GRACE_MS / 1000}s; exiting anyway`);
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forceExit.unref();

  server.close((err) => {
    if (err) {
      console.error('Error while closing HTTP server:', err.message);
      process.exit(1);
    }
    console.log('HTTP server closed cleanly');
    process.exit(0);
  });
  server.closeIdleConnections?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
serverStartTime = new Date().toISOString();
server = app.listen(port, () => {
  console.log('Proposal Studio Server');
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server started at: ${serverStartTime}`);
  console.log('All modules loaded successfully');
  console.log('No persistence - content generated on demand');
});
