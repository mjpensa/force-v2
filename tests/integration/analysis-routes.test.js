import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

let generateContentFn = async () => ({ response: { text: () => '{}' } });

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

await jest.unstable_mockModule('pptxgenjs', () => ({ default: class {} }));
await jest.unstable_mockModule('docx', () => ({
  Document: class {}, Packer: { toBuffer: async () => Buffer.alloc(0) },
  Paragraph: class {}, TextRun: class {}, HeadingLevel: {}, AlignmentType: {},
  BorderStyle: {}, Table: class {}, TableRow: class {}, TableCell: class {},
  WidthType: {}, ShadingType: {}, VerticalAlign: {}, TableLayoutType: {},
  convertInchesToTwip: () => 0, LevelFormat: {},
}));
await jest.unstable_mockModule('mammoth', () => ({ default: { extractRawText: async () => ({ value: '' }) } }));

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
  generateContentFn = async () => ({ response: { text: () => '{}' } });
});

function seedSession(id = 'sess-1') {
  sessions.set(id, {
    prompt: 'Test prompt',
    researchFiles: [{ filename: 'report.txt', content: 'Market analysis data for Acme Corp.' }],
    content: {},
    createdAt: Date.now(),
    lastAccessed: Date.now(),
  });
}

describe('POST /get-task-analysis', () => {
  it('returns 400 when taskName is missing', async () => {
    const res = await request.post('/get-task-analysis')
      .send({ entity: 'Acme Corp', researchText: 'some data' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing taskName or entity');
  });

  it('returns 400 when entity is missing', async () => {
    const res = await request.post('/get-task-analysis')
      .send({ taskName: 'Revenue Growth', researchText: 'some data' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing taskName or entity');
  });

  it('returns JSON analysis on valid request with sessionId', async () => {
    seedSession('analysis-sess');
    const mockAnalysis = { summary: 'Growth outlook positive', score: 85 };
    generateContentFn = async () => ({
      response: { text: () => JSON.stringify(mockAnalysis) }
    });

    const res = await request.post('/get-task-analysis')
      .send({ taskName: 'Revenue Growth', entity: 'Acme Corp', sessionId: 'analysis-sess' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockAnalysis);
  });

  it('returns JSON analysis on valid request with direct researchText', async () => {
    const mockAnalysis = { finding: 'Competitive advantage identified' };
    generateContentFn = async () => ({
      response: { text: () => JSON.stringify(mockAnalysis) }
    });

    const res = await request.post('/get-task-analysis')
      .send({ taskName: 'Market Position', entity: 'Acme Corp', researchText: 'Direct research text input.' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockAnalysis);
  });

  it('returns 404 when sessionId does not exist', async () => {
    const res = await request.post('/get-task-analysis')
      .send({ taskName: 'Revenue Growth', entity: 'Acme Corp', sessionId: 'nonexistent' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Session not found/);
  });
});

describe('POST /ask-question', () => {
  it('returns 400 when question is missing', async () => {
    const res = await request.post('/ask-question')
      .send({ taskName: 'Growth', entity: 'Acme', researchText: 'data' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Question is required and must be non-empty');
  });

  it('returns 400 when question exceeds max length', async () => {
    const longQuestion = 'x'.repeat(1001);
    const res = await request.post('/ask-question')
      .send({ taskName: 'Growth', entity: 'Acme', question: longQuestion, researchText: 'data' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Question too long/);
  });

  it('returns 400 when entity is missing', async () => {
    const res = await request.post('/ask-question')
      .send({ taskName: 'Growth', question: 'What is the outlook?', researchText: 'data' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Entity is required');
  });

  it('returns answer on valid request', async () => {
    seedSession('qa-sess');
    generateContentFn = async () => ({
      response: { text: () => 'Revenue grew 15% year-over-year.' }
    });

    const res = await request.post('/ask-question')
      .send({ taskName: 'Growth', entity: 'Acme', question: 'What is revenue growth?', sessionId: 'qa-sess' });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('Revenue grew 15% year-over-year.');
  });
});
