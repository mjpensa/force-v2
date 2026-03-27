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

const briefDocxBuffer = Buffer.from('fake-brief-docx');

await jest.unstable_mockModule('../../server/templates/docx-export-service.js', () => ({
  generateDocx: async () => Buffer.from('fake-docx'),
  generateIntelligenceBriefDocx: async () => briefDocxBuffer
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
const intelBriefFixture = loadFixture('intelligence-brief');

const validBody = {
  companyName: 'Acme Corp',
  meetingAttendees: 'John Doe (CTO), Jane Smith (VP Eng)',
  meetingObjective: 'Discuss cloud migration strategy'
};

describe('POST /api/content/:sessionId/intelligence-brief/generate', () => {
  it('returns 404 for non-existent session', async () => {
    const res = await request
      .post('/api/content/no-such-session/intelligence-brief/generate')
      .set('X-Forwarded-For', '10.1.0.1')
      .send(validBody);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/session not found/i);
  });

  it('returns 400 on missing companyName', async () => {
    seedSession(sessions, 'no-company');
    const res = await request
      .post('/api/content/no-company/intelligence-brief/generate')
      .set('X-Forwarded-For', '10.1.0.2')
      .send({ meetingAttendees: 'Someone', meetingObjective: 'Something' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/company name/i);
  });

  it('returns 400 on missing attendees', async () => {
    seedSession(sessions, 'no-attendees');
    const res = await request
      .post('/api/content/no-attendees/intelligence-brief/generate')
      .set('X-Forwarded-For', '10.1.0.3')
      .send({ companyName: 'Acme', meetingObjective: 'Something' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/attendees/i);
  });

  it('returns 400 on missing meetingObjective', async () => {
    seedSession(sessions, 'no-objective');
    const res = await request
      .post('/api/content/no-objective/intelligence-brief/generate')
      .set('X-Forwarded-For', '10.1.0.4')
      .send({ companyName: 'Acme', meetingAttendees: 'Someone' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/objective/i);
  });

  it('returns 400 when no analysis data available', async () => {
    seedSession(sessions, 'empty-session', {
      researchFiles: [],
      content: {
        slides: { success: false },
        document: { success: false },
        roadmap: { success: false },
        researchAnalysis: { success: false }
      }
    });
    const res = await request
      .post('/api/content/empty-session/intelligence-brief/generate')
      .set('X-Forwarded-For', '10.1.0.5')
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no analysis data/i);
  });

  it('returns DOCX buffer on success', async () => {
    generateContentFn = async () => ({
      response: { text: () => JSON.stringify(intelBriefFixture) }
    });
    seedSession(sessions, 'good-brief');
    const res = await request
      .post('/api/content/good-brief/intelligence-brief/generate')
      .set('X-Forwarded-For', '10.1.0.6')
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application');
    expect(res.headers['content-disposition']).toContain('.docx');
  });
});
