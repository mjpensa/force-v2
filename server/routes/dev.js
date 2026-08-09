import express from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessions } from './content.js';

/**
 * Dev-only: build a fully populated session from the golden corpus, with no API calls.
 *
 * Sessions live in an in-memory Map, so a server restart leaves nothing to look at, and the
 * only other way to fill one is a full generation run — 10-12 requests against a 20-per-day
 * free tier. That made reviewing any viewer or export change cost a meaningful fraction of a
 * day's quota, which in practice meant viewer changes went unreviewed.
 *
 * The captures below are one coherent generation run (2026-08-07 16:08-16:13, all seven views
 * from the same research), plus the speaker notes generated from that deck.
 *
 * Mounted only when NODE_ENV !== 'production' — see server.js.
 */

const router = express.Router();

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tests', 'golden');
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tests', 'fixtures');

const load = name => {
  const parsed = JSON.parse(readFileSync(join(GOLDEN_DIR, `${name}.json`), 'utf8'));
  return parsed.data ?? parsed;
};

// content key -> golden capture
const SEED_VIEWS = {
  roadmap: 'roadmap-1',
  slides: 'slides-1',
  document: 'document-2',
  researchAnalysis: 'research-analysis-1',
  swotAnalysis: 'swot-analysis-2',
  competitiveAnalysis: 'competitive-analysis-2',
  riskRegister: 'risk-register-1',
};

router.post('/seed-session', (req, res) => {
  try {
    const content = {};
    for (const [key, capture] of Object.entries(SEED_VIEWS)) {
      content[key] = { success: true, data: load(capture) };
    }
    // Speaker notes hang off the slides result, which is where the export route reads them.
    content.slides.speakerNotes = load('speaker-notes-2');

    const sessionId = `golden-${Date.now().toString(36)}`;
    const now = Date.now();
    sessions.set(sessionId, {
      prompt: 'Seeded from the golden corpus — no API calls were made.',
      researchFiles: ['sample-research-1.txt', 'sample-research-2.txt'].map(filename => ({
        filename,
        content: readFileSync(join(FIXTURES_DIR, filename), 'utf8'),
      })),
      status: 'completed',
      content,
      progress: [],
      _listeners: new Set(),
      createdAt: now,
      lastAccessed: now,
    });

    // The viewer reads `sessionId`, not `session` — see Public/viewer.js _getSessionIdFromURL.
    res.json({ sessionId, url: `/viewer.html?sessionId=${sessionId}#roadmap`, views: Object.keys(content) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to seed session', message: error.message });
  }
});

export default router;
