import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

let generateContentFn = async () => ({ response: { text: () => '{}' } });

await jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: function () {
    return { getGenerativeModel: () => ({ generateContent: (...args) => generateContentFn(...args) }) };
  }
}));

await jest.unstable_mockModule('../../server/cache/DiskCache.js', () => ({
  DiskCache: class { constructor() {} async get() { return null; } async set() {} async wrap(p, c, fn) { return fn(); } },
  diskCache: { get: async () => null, set: async () => {}, wrap: async (p, c, fn) => fn() }
}));

await jest.unstable_mockModule('../../server/cache/FileCache.js', () => ({
  fileCache: { get: async () => 'parsed content' }
}));

const pptxBuffer = Buffer.from('fake-pptx-content');
const docxBuffer = Buffer.from('fake-docx-content');

await jest.unstable_mockModule('../../server/templates/ppt-export-service-v2.js', () => ({
  generatePptx: async () => pptxBuffer
}));

await jest.unstable_mockModule('../../server/templates/docx-export-service.js', () => ({
  generateDocx: async () => docxBuffer,
  generateIntelligenceBriefDocx: async () => docxBuffer
}));

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
});

const { seedSession } = await import('../__helpers__/session-factory.js');

describe('GET /api/content/:sessionId/slides/export', () => {
  it('returns 404 for non-existent session', async () => {
    const res = await request.get('/api/content/no-such-session/slides/export');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it('returns 404 when slides failed', async () => {
    seedSession(sessions, 'fail-slides', {
      content: { slides: { success: false, error: 'Generation failed' }, document: { success: true, data: {} }, roadmap: { success: true, data: {} }, researchAnalysis: { success: true, data: {} } }
    });
    const res = await request.get('/api/content/fail-slides/slides/export');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/slides not available/i);
  });

  it('returns PPTX buffer with correct Content-Type on success', async () => {
    seedSession(sessions, 'good-slides');
    const res = await request.get('/api/content/good-slides/slides/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application');
    expect(res.headers['content-disposition']).toContain('.pptx');
    expect(res.body).toBeDefined();
  });
});

describe('GET /api/content/:sessionId/document/export', () => {
  it('returns 404 for non-existent session', async () => {
    const res = await request.get('/api/content/no-such-session/document/export');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it('returns 404 when document failed', async () => {
    seedSession(sessions, 'fail-doc', {
      content: { document: { success: false, error: 'Generation failed' }, slides: { success: true, data: {} }, roadmap: { success: true, data: {} }, researchAnalysis: { success: true, data: {} } }
    });
    const res = await request.get('/api/content/fail-doc/document/export');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/document not available/i);
  });

  it('returns DOCX buffer with correct Content-Type on success', async () => {
    seedSession(sessions, 'good-doc');
    const res = await request.get('/api/content/good-doc/document/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application');
    expect(res.headers['content-disposition']).toContain('.docx');
    expect(res.body).toBeDefined();
  });
});
