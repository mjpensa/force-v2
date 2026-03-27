import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { loadFixture } from '../__helpers__/fixture-loader.js';

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

await jest.unstable_mockModule('../../server/templates/ppt-export-service-v2.js', () => ({
  generatePptx: async () => Buffer.from('fake-pptx')
}));

await jest.unstable_mockModule('../../server/templates/docx-export-service.js', () => ({
  generateDocx: async () => Buffer.from('fake-docx'),
  generateIntelligenceBriefDocx: async () => Buffer.from('fake-docx')
}));

let app, sessions, request;
beforeAll(async () => {
  const supertest = await import('supertest');
  const { createTestApp } = await import('../__helpers__/supertest-app.js');
  const testApp = await createTestApp();
  app = testApp.app;
  app.set('trust proxy', true);
  sessions = testApp.sessions;
  request = supertest.default(app);
});

beforeEach(() => {
  sessions.clear();
  generateContentFn = async () => ({ response: { text: () => '{}' } });
});

const { seedSession } = await import('../__helpers__/session-factory.js');
const speakerNotesFixture = loadFixture('speaker-notes');

describe('POST /api/content/:sessionId/slides/speaker-notes', () => {
  it('returns 404 for non-existent session', async () => {
    const res = await request.post('/api/content/no-such-session/slides/speaker-notes')
      .set('X-Forwarded-For', '10.0.0.1');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it('returns 400 when slides not available', async () => {
    seedSession(sessions, 'no-slides', {
      content: { slides: { success: false, error: 'Failed' }, document: { success: true, data: {} }, roadmap: { success: true, data: {} }, researchAnalysis: { success: true, data: {} } }
    });
    const res = await request.post('/api/content/no-slides/slides/speaker-notes')
      .set('X-Forwarded-For', '10.0.0.2');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/slides not available/i);
  });

  it('returns cached notes if already present', async () => {
    const slidesData = loadFixture('slides');
    seedSession(sessions, 'cached-notes', {
      content: {
        slides: { success: true, data: slidesData, speakerNotes: speakerNotesFixture },
        document: { success: true, data: {} },
        roadmap: { success: true, data: {} },
        researchAnalysis: { success: true, data: {} }
      }
    });
    const res = await request.post('/api/content/cached-notes/slides/speaker-notes')
      .set('X-Forwarded-For', '10.0.0.3');
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('generates and returns notes on success', async () => {
    generateContentFn = async () => ({
      response: { text: () => JSON.stringify(speakerNotesFixture) }
    });
    seedSession(sessions, 'gen-notes');
    const res = await request.post('/api/content/gen-notes/slides/speaker-notes')
      .set('X-Forwarded-For', '10.0.0.4');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.data).toBeDefined();
  });

  it('returns error status when generation fails', async () => {
    generateContentFn = async () => { throw new Error('Gemini down'); };
    seedSession(sessions, 'fail-notes');
    const res = await request.post('/api/content/fail-notes/slides/speaker-notes')
      .set('X-Forwarded-For', '10.0.0.5');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('error');
    expect(res.body.error).toBeDefined();
  });
});
