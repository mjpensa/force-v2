import express from 'express';
import cors from 'cors';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

export async function createTestApp() {
  // Dynamic imports so Gemini mock can be registered first
  const { default: contentRoutes, sessions } = await import('../../server/routes/content.js');
  const { default: analysisRoutes } = await import('../../server/routes/analysis.js');
  const { default: sseContentRoutes } = await import('../../server/routes/sse-content.js');
  const { configureHelmet, configureCacheControl, configureTimeout, handleUploadErrors } = await import('../../server/middleware.js');

  const app = express();
  app.use(configureHelmet());
  app.use(cors({ origin: 'http://localhost:3000' }));
  app.use(configureCacheControl);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.static(join(PROJECT_ROOT, 'Public'), { maxAge: 0 }));
  app.use(configureTimeout);

  app.use('/', analysisRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/content', sseContentRoutes);
  app.use(handleUploadErrors);

  return { app, sessions };
}
