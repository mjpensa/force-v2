import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { loadFixture } from '../__helpers__/fixture-loader.js';

// --- Mock control ---
let generateContentFn;
let callCount;

function resetMock() {
  callCount = 0;
  generateContentFn = async () => {
    callCount++;
    return { response: { text: () => '{}' } };
  };
}

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
  fileCache: { get: async () => 'parsed content' }
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
const slidesOutlineFixture = loadFixture('slides-outline');
const slidesFixture = loadFixture('slides');
const documentFixture = loadFixture('document');
const researchAnalysisFixture = loadFixture('research-analysis');

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

beforeEach(() => {
  sessions.clear();
  resetMock();
});

function setupSequence(fixtures) {
  let i = 0;
  generateContentFn = async () => {
    callCount++;
    const f = fixtures[i] || fixtures[fixtures.length - 1];
    i++;
    return { response: { text: () => JSON.stringify(f) } };
  };
}

function sendGenerate(viewsParam) {
  const url = viewsParam
    ? `/api/content/generate?views=${viewsParam}`
    : '/api/content/generate';
  return request
    .post(url)
    .field('prompt', 'Analyze the market research')
    .attach('researchFiles', Buffer.from('research data'), 'research.txt');
}

// ============================================================
// ?views= query parameter
// ============================================================
describe('POST /api/content/generate with ?views= filter', () => {
  it('views=roadmap generates only roadmap (few Gemini calls)', async () => {
    setupSequence([roadmapFixture]);

    const res = await sendGenerate('roadmap');

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeDefined();
    // Only roadmap should succeed; others skipped
    expect(res.body.views.roadmap).toBe(true);
    expect(res.body.views.slides).toBe(false);
    expect(res.body.views.document).toBe(false);
    expect(res.body.views.researchAnalysis).toBe(false);
    // Should use very few Gemini calls (just 1 for roadmap)
    expect(callCount).toBeLessThanOrEqual(2);
  });

  it('views=roadmap,document generates both', async () => {
    setupSequence([roadmapFixture, documentFixture, documentFixture]);

    const res = await sendGenerate('roadmap,document');

    expect(res.status).toBe(200);
    expect(res.body.views.roadmap).toBe(true);
    expect(res.body.views.document).toBe(true);
    // Slides and research-analysis should be skipped
    expect(res.body.views.slides).toBe(false);
    expect(res.body.views.researchAnalysis).toBe(false);
  });

  it('views=invalid generates nothing (all views skipped)', async () => {
    const res = await sendGenerate('invalid');

    expect(res.status).toBe(200);
    expect(res.body.views.roadmap).toBe(false);
    expect(res.body.views.slides).toBe(false);
    expect(res.body.views.document).toBe(false);
    expect(res.body.views.researchAnalysis).toBe(false);
    // No Gemini calls should be made
    expect(callCount).toBe(0);
  });

  it('no views param generates all views', async () => {
    setupSequence([
      researchAnalysisFixture,
      roadmapFixture,
      slidesOutlineFixture,
      slidesFixture,
      documentFixture,
    ]);

    const res = await sendGenerate(null);

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeDefined();
    // All views should be attempted
    expect(res.body.views).toBeDefined();
    // At least some Gemini calls should have been made
    expect(callCount).toBeGreaterThanOrEqual(3);
  });
});
