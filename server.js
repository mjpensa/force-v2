/**
 * AI Roadmap Generator - Main Server
 *
 * This file serves as a lightweight orchestrator, coordinating between modules:
 * - server/config.js - Configuration and environment validation
 * - server/middleware.js - Security, rate limiting, file upload
 * - server/gemini.js - Gemini API integration
 * - server/prompts.js - AI prompts and schemas
 * - server/routes/charts.js - Chart generation endpoints
 * - server/routes/analysis.js - Task analysis and Q&A endpoints
 * - server/utils.js - Utility functions
 *
 * Note: No persistence - all content is generated and returned directly
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import cors from 'cors';

// Import configuration (validates environment on load)
import { CONFIG } from './server/config.js';

// Import middleware
import {
  configureHelmet,
  configureCacheControl,
  configureTimeout,
  handleUploadErrors
} from './server/middleware.js';

// Import routes
import chartRoutes from './server/routes/charts.js';
import analysisRoutes from './server/routes/analysis.js';
import contentRoutes from './server/routes/content.js';

// --- Server Setup ---
const app = express();
const port = CONFIG.SERVER.PORT;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure trust proxy for Railway deployment
app.set('trust proxy', CONFIG.SERVER.TRUST_PROXY_HOPS);

// --- Apply Middleware ---
// Compression middleware (gzip/deflate)
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Security headers
app.use(configureHelmet());

// Remove X-Powered-By header
app.disable('x-powered-by');

// Cache control
app.use(configureCacheControl);

// JSON parsing with size limit
app.use(express.json({ limit: '50mb' }));

// Static file serving with optimized options
app.use(express.static(join(__dirname, 'Public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true
}));

// Serve minified JS in production
if (process.env.NODE_ENV === 'production') {
  app.use('/dist', express.static(join(__dirname, 'Public', 'dist'), {
    maxAge: '7d',
    immutable: true
  }));
}

// Request timeout
app.use(configureTimeout);

// --- Health Check Endpoint ---
let serverStartTime = null;
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    startedAt: serverStartTime,
    uptime: serverStartTime ? Math.floor((Date.now() - new Date(serverStartTime).getTime()) / 1000) : 0
  });
});

// --- Mount Routes ---
app.use('/', chartRoutes);
app.use('/', analysisRoutes);
app.use('/api/content', contentRoutes);

// --- Error Handling ---
app.use(handleUploadErrors);

// --- Global Error Handlers ---
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  console.error('Server will exit due to uncaught exception');
  process.exit(1);
});

// Handle SIGTERM gracefully (for deployment platforms like Railway)
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server gracefully');
  process.exit(0);
});

// Handle SIGINT gracefully (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: shutting down gracefully');
  process.exit(0);
});

// --- Start Server ---
serverStartTime = new Date().toISOString();
app.listen(port, () => {
  console.log('AI Roadmap Generator Server');
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server started at: ${serverStartTime}`);
  console.log('All modules loaded successfully');
  console.log('No persistence - content generated on demand');
});
