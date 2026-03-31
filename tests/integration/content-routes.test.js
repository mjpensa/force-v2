import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { loadFixture } from '../__helpers__/fixture-loader.js';

// --- Mock control ---
let generateContentFn = async () => ({ response: { text: () => '{}' } });

// Disable rate limiting in tests
await jest.unstable_mockModule('express-rate-limit', () => ({
  default: () => (req, res, next) => next()
}));

// Register Gemini mock BEFORE any server imports
await jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: function () {
    return {
      getGenerativeModel() {
        return { generateContent: (...args) => generateContentFn(...args) };
      }
    };
  }
}));

await jest.unstable_mockModule('../../server/cache/DiskCache.js', () => ({
  DiskCache: class { constructor() {} async get() { return null; } async set() {} async wrap(p, c, fn) { return fn(); } },
  diskCache: { get: async () => null, set: async () => {}, wrap: async (p, c, fn) => fn() }
}));

await jest.unstable_mockModule('../../server/cache/FileCache.js', () => ({
  fileCache: { get: async (buffer, mimetype, filename) => `Parsed content of ${filename}` }
}));

await jest.unstable_mockModule('../../server/templates/ppt-export-service-v2.js', () => ({
  generatePptx: async () => Buffer.from('fake-pptx')
}));

await jest.unstable_mockModule('../../server/templates/docx-export-service.js', () => ({
  generateDocx: async () => Buffer.from('fake-docx'),
  generateIntelligenceBriefDocx: async () => Buffer.from('fake-docx')
}));

// --- Fixtures ---
const roadmapFixture = loadFixture('roadmap');
const slidesFixture = loadFixture('slides');
const documentFixture = loadFixture('document');
const researchAnalysisFixture = loadFixture('research-analysis');
const slidesOutlineFixture = loadFixture('slides-outline');
const narrativeSpineFixture = loadFixture('narrative-spine');

// --- App bootstrap ---
let app, sessions, request;

beforeAll(async () => {
  const supertest = await import('supertest');
  const { createTestApp } = await import('../__helpers__/supertest-app.js');
  const testApp = await createTestApp();
  app = testApp.app;
  sessions = testApp.sessions;
  request = supertest.default(app);
});

const { seedSession } = await import('../__helpers__/session-factory.js');

beforeEach(() => {
  sessions.clear();
  generateContentFn = async () => ({ response: { text: () => '{}' } });
});

// --- Helpers ---
function setupSequence(fixtures) {
  let i = 0;
  generateContentFn = async () => {
    const f = fixtures[i] || fixtures[fixtures.length - 1];
    i++;
    return { response: { text: () => JSON.stringify(f) } };
  };
}

// ============================================================
// POST /api/content/generate
// ============================================================
describe('POST /api/content/generate', () => {
  it('returns 400 when prompt is missing', async () => {
    const res = await request
      .post('/api/content/generate')
      .attach('researchFiles', Buffer.from('data'), 'file.txt');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prompt/i);
  });

  it('returns 400 when no files are attached', async () => {
    const res = await request
      .post('/api/content/generate')
      .field('prompt', 'Analyze this');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file/i);
  });

  it('returns 200 with sessionId on valid request', async () => {
    setupSequence([
      narrativeSpineFixture,
      researchAnalysisFixture,
      roadmapFixture,
      slidesOutlineFixture,
      slidesFixture,
      documentFixture,
    ]);

    const res = await request
      .post('/api/content/generate')
      .field('prompt', 'Analyze the market research')
      .attach('researchFiles', Buffer.from('research data'), 'research.txt');

    expect(res.status).toBe(202);
    expect(res.body.sessionId).toBeDefined();
    expect(typeof res.body.sessionId).toBe('string');
    expect(res.body.status).toBe('accepted');
  });

  it('response includes sessionId for async generation', async () => {
    const res = await request
      .post('/api/content/generate')
      .field('prompt', 'Analyze the market research')
      .attach('researchFiles', Buffer.from('research data'), 'research.txt');

    expect(res.status).toBe(202);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.status).toBe('accepted');
  });
});

// ============================================================
// GET /api/content/:sessionId/:viewType
// ============================================================
describe('GET /api/content/:sessionId/:viewType', () => {
  it('returns 404 for non-existent session', async () => {
    const res = await request.get('/api/content/no-such-session/roadmap');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it('returns completed data for a valid session', async () => {
    seedSession(sessions, 'sess-1');

    const res = await request.get('/api/content/sess-1/roadmap');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.data).toBeDefined();
    expect(res.body.data.title).toBe(roadmapFixture.title);
  });

  it('returns error status for a failed view', async () => {
    seedSession(sessions, 'sess-err', {
      content: {
        roadmap: { success: false, error: 'Gemini unavailable' },
        slides: { success: true, data: slidesFixture },
        document: { success: true, data: documentFixture },
        researchAnalysis: { success: true, data: researchAnalysisFixture },
      }
    });

    const res = await request.get('/api/content/sess-err/roadmap');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('error');
    expect(res.body.error).toMatch(/Gemini unavailable/);
  });

  it('returns 400 for invalid view type', async () => {
    seedSession(sessions, 'sess-inv');

    const res = await request.get('/api/content/sess-inv/nonsense');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid view type/i);
  });

  it('returns slides data for slides view type', async () => {
    seedSession(sessions, 'sess-slides');

    const res = await request.get('/api/content/sess-slides/slides');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.data).toBeDefined();
  });

  it('returns document data via document view type', async () => {
    seedSession(sessions, 'sess-doc');

    const res = await request.get('/api/content/sess-doc/document');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.data).toBeDefined();
  });

  it('returns research-analysis data via research-analysis view type', async () => {
    seedSession(sessions, 'sess-ra');

    const res = await request.get('/api/content/sess-ra/research-analysis');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.data).toBeDefined();
  });
});

// ============================================================
// POST /api/content/update-task-dates
// ============================================================
describe('POST /api/content/update-task-dates', () => {
  it('returns 400 for string taskIndex', async () => {
    seedSession(sessions, 'sess-dates');

    const res = await request
      .post('/api/content/update-task-dates')
      .send({ sessionId: 'sess-dates', taskIndex: 'abc', newStartCol: 1, newEndCol: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/taskIndex/i);
  });

  it('returns 400 for negative taskIndex', async () => {
    seedSession(sessions, 'sess-dates2');

    const res = await request
      .post('/api/content/update-task-dates')
      .send({ sessionId: 'sess-dates2', taskIndex: -1, newStartCol: 1, newEndCol: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/taskIndex/i);
  });

  it('returns 404 for non-existent session', async () => {
    const res = await request
      .post('/api/content/update-task-dates')
      .send({ sessionId: 'ghost', taskIndex: 1, newStartCol: 1, newEndCol: 3 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it('updates task bar values on valid request', async () => {
    seedSession(sessions, 'sess-update');

    // taskIndex 1 is the first non-swimlane row with a bar
    const res = await request
      .post('/api/content/update-task-dates')
      .send({ sessionId: 'sess-update', taskIndex: 1, newStartCol: 2, newEndCol: 6 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.task.bar.startCol).toBe(2);
    expect(res.body.task.bar.endCol).toBe(6);
  });

  it('returns 400 for invalid column values', async () => {
    seedSession(sessions, 'sess-badcol');

    const res = await request
      .post('/api/content/update-task-dates')
      .send({ sessionId: 'sess-badcol', taskIndex: 1, newStartCol: -1, newEndCol: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/column/i);
  });
});

// ============================================================
// POST /api/content/update-task-color
// ============================================================
describe('POST /api/content/update-task-color', () => {
  it('returns 400 for invalid color (not hex)', async () => {
    seedSession(sessions, 'sess-color');

    const res = await request
      .post('/api/content/update-task-color')
      .send({ sessionId: 'sess-color', taskIndex: 1, color: 'red' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/color/i);
  });

  it('returns 400 for short hex color', async () => {
    seedSession(sessions, 'sess-color2');

    const res = await request
      .post('/api/content/update-task-color')
      .send({ sessionId: 'sess-color2', taskIndex: 1, color: '#FFF' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/color/i);
  });

  it('updates color on valid request', async () => {
    seedSession(sessions, 'sess-color3');

    const res = await request
      .post('/api/content/update-task-color')
      .send({ sessionId: 'sess-color3', taskIndex: 1, color: '#FF5733' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.task.bar.color).toBe('#FF5733');
  });

  it('returns 404 for non-existent session', async () => {
    const res = await request
      .post('/api/content/update-task-color')
      .send({ sessionId: 'missing', taskIndex: 1, color: '#FF5733' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });
});
