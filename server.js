import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import cors from 'cors';

import { CONFIG } from './server/config.js';

import {
  configureHelmet,
  configureCacheControl,
  configureTimeout,
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
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

app.use(configureHelmet());

app.disable('x-powered-by');

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

app.use(configureTimeout);
let serverStartTime = null;
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    startedAt: serverStartTime,
    uptime: serverStartTime ? Math.floor((Date.now() - new Date(serverStartTime).getTime()) / 1000) : 0
  });
});
app.use('/', analysisRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/content', sseContentRoutes); // SSE streaming for real-time progress
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

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: shutting down gracefully');
  process.exit(0);
});
serverStartTime = new Date().toISOString();
app.listen(port, () => {
  console.log('Proposal Studio Server');
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server started at: ${serverStartTime}`);
  console.log('All modules loaded successfully');
  console.log('No persistence - content generated on demand');
});
