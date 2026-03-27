import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { loadFixture } from '../__helpers__/fixture-loader.js';

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

let sessions, request;

beforeAll(async () => {
  const supertest = await import('supertest');
  const express = await import('express');

  // Import the SSE router and the shared sessions map directly.
  // Mount SSE before content routes so /stream/:sessionId is not shadowed
  // by the content router's /:sessionId/:viewType catch-all.
  const { default: sseContentRoutes } = await import('../../server/routes/sse-content.js');
  const { sessions: sessionMap } = await import('../../server/routes/content.js');

  const app = express.default();
  app.use(express.default.json());
  app.use('/api/content', sseContentRoutes);

  sessions = sessionMap;
  request = supertest.default(app);
});

beforeEach(() => {
  sessions.clear();
});

function parseSSEEvents(text) {
  return text.split('\n\n').filter(Boolean).map(block => {
    const eventMatch = block.match(/^event: (.+)$/m);
    const dataMatch = block.match(/^data: (.+)$/m);
    return {
      event: eventMatch ? eventMatch[1] : null,
      data: dataMatch ? JSON.parse(dataMatch[1]) : null,
    };
  });
}

describe('GET /api/content/stream/:sessionId', () => {
  it('returns text/event-stream Content-Type', async () => {
    const res = await request.get('/api/content/stream/any-id')
      .buffer(true)
      .parse((res, cb) => { let data = ''; res.on('data', c => data += c); res.on('end', () => cb(null, data)); });
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
  });

  it('sends connected then error event for non-existent session', async () => {
    const res = await request.get('/api/content/stream/nonexistent')
      .buffer(true)
      .parse((res, cb) => { let data = ''; res.on('data', c => data += c); res.on('end', () => cb(null, data)); });

    const events = parseSSEEvents(res.body);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].event).toBe('connected');
    expect(events[0].data.sessionId).toBe('nonexistent');
    expect(events[1].event).toBe('error');
    expect(events[1].data.message).toMatch(/Session not found/);
  });

  it('sends connected then complete event for a session with all views ready', async () => {
    sessions.set('ready-sess', {
      prompt: 'Test prompt',
      researchFiles: [{ filename: 'test.txt', content: 'data' }],
      content: {
        roadmap: { success: true, data: loadFixture('roadmap') },
        slides: { success: true, data: loadFixture('slides') },
        document: { success: true, data: loadFixture('document') },
        researchAnalysis: { success: true, data: loadFixture('research-analysis') },
      },
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });

    const res = await request.get('/api/content/stream/ready-sess')
      .buffer(true)
      .parse((res, cb) => { let data = ''; res.on('data', c => data += c); res.on('end', () => cb(null, data)); });

    const events = parseSSEEvents(res.body);
    expect(events[0].event).toBe('connected');
    expect(events[0].data.sessionId).toBe('ready-sess');

    const completeEvent = events.find(e => e.event === 'complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.data.success).toBe(true);
    expect(completeEvent.data.summary).toEqual({
      roadmap: 'ready',
      slides: 'ready',
      document: 'ready',
      researchAnalysis: 'ready',
    });
  });

  it('reports failed views in the complete summary', async () => {
    sessions.set('partial-sess', {
      prompt: 'Test prompt',
      researchFiles: [{ filename: 'test.txt', content: 'data' }],
      content: {
        roadmap: { success: true, data: {} },
        slides: { success: false, error: 'Generation failed' },
        document: { success: true, data: {} },
        researchAnalysis: { success: true, data: {} },
      },
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });

    const res = await request.get('/api/content/stream/partial-sess')
      .buffer(true)
      .parse((res, cb) => { let data = ''; res.on('data', c => data += c); res.on('end', () => cb(null, data)); });

    const completeEvent = parseSSEEvents(res.body).find(e => e.event === 'complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.data.success).toBe(false);
    expect(completeEvent.data.summary.slides).toBe('failed');
    expect(completeEvent.data.summary.roadmap).toBe('ready');
  });

  it('includes timestamp in connected and complete events', async () => {
    sessions.set('ts-sess', {
      prompt: 'Test',
      researchFiles: [],
      content: {
        roadmap: { success: true, data: {} },
        slides: { success: true, data: {} },
        document: { success: true, data: {} },
        researchAnalysis: { success: true, data: {} },
      },
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });

    const res = await request.get('/api/content/stream/ts-sess')
      .buffer(true)
      .parse((res, cb) => { let data = ''; res.on('data', c => data += c); res.on('end', () => cb(null, data)); });

    const events = parseSSEEvents(res.body);
    expect(events[0].data.timestamp).toEqual(expect.any(Number));
    const completeEvent = events.find(e => e.event === 'complete');
    expect(completeEvent.data.timestamp).toEqual(expect.any(Number));
  });
});
