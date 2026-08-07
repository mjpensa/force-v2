import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

/**
 * Pins the failure path from generators.js through to what the client receives.
 *
 * The contract had been broken on both ends of one event: generators.js emits
 *   emit({ type: 'view:failed', view, result })          // payload on `result`
 * while runGenerationPipeline's onProgress read
 *   session.content[key] = { success: false, error: event.error }   // always undefined
 *
 * So every failed view stored `error: undefined`, formatUserError fell through to its
 * generic "Please try again", and the actual Gemini error never reached the user, the SSE
 * stream, or the logs. On a 20-request/day free tier, re-running a generation to discover
 * what the first one would have told you is a direct quota cost.
 *
 * The existing sse-routes test hand-writes a top-level `error`, which is the shape the
 * consumer expected but the producer never sent — so it passed throughout. These tests use
 * the real emit shape.
 */

await jest.unstable_mockModule('express-rate-limit', () => ({
  default: () => (req, res, next) => next(),
}));

await jest.unstable_mockModule('../../server/cache/DiskCache.js', () => ({
  hashSchema: () => 'test-schema-hash',
  DiskCache: class { constructor() {} async get() { return null; } async set() {} async wrap(p, c, fn) { return fn(); } },
  diskCache: { get: async () => null, set: async () => {}, wrap: async (p, c, fn) => fn() },
}));

await jest.unstable_mockModule('../../server/cache/FileCache.js', () => ({
  fileCache: { get: async (buffer, mimetype, filename) => `Parsed content of ${filename}` },
}));

// The pipeline is replaced wholesale: this test is about how a failure event is handled,
// not about how one is produced.
const REAL_ERROR = 'Failed to generate Slides: [429] Quota exceeded for gemini-2.5-flash';
let emitPlan = [];
await jest.unstable_mockModule('../../server/generators.js', () => ({
  generateAllContent: async (prompt, files, views, onProgress) => {
    for (const event of emitPlan) onProgress(event);
    return {};
  },
  generateIntelligenceBrief: async () => ({ success: true, data: {} }),
  generateSpeakerNotesAsync: async () => ({ success: true, data: {} }),
  regenerateContent: async () => ({ success: true, data: {} }),
}));

await jest.unstable_mockModule('../../server/templates/ppt-export-service-v2.js', () => ({
  generatePptx: async () => Buffer.from('fake-pptx'),
}));
await jest.unstable_mockModule('../../server/templates/docx-export-service.js', () => ({
  generateDocx: async () => Buffer.from('fake-docx'),
  generateIntelligenceBriefDocx: async () => Buffer.from('fake-docx'),
}));

let sessions;
let runPipeline;

beforeAll(async () => {
  const contentModule = await import('../../server/routes/content.js');
  sessions = contentModule.sessions;
  runPipeline = contentModule.runGenerationPipeline;
});

beforeEach(() => {
  sessions.clear();
  emitPlan = [];
});

function seedSession(id = 'test-session') {
  sessions.set(id, {
    status: 'processing',
    content: {},
    progress: [],
    createdAt: Date.now(),
    lastAccessed: Date.now(),
  });
  return id;
}

describe('failed view error propagation', () => {
  it('stores the real error from the result payload, not undefined', async () => {
    const id = seedSession();
    emitPlan = [{ type: 'view:failed', view: 'slides', result: { success: false, error: REAL_ERROR } }];

    await runPipeline(id, 'prompt', [], null);

    const stored = sessions.get(id).content.slides;
    expect(stored.success).toBe(false);
    expect(stored.error).toBe(REAL_ERROR);
    expect(stored.error).toBeDefined();
  });

  it('never stores undefined, even when the payload carries no detail', async () => {
    const id = seedSession();
    emitPlan = [{ type: 'view:failed', view: 'slides', result: { success: false } }];

    await runPipeline(id, 'prompt', [], null);

    const stored = sessions.get(id).content.slides;
    expect(stored.error).toBeDefined();
    expect(String(stored.error)).not.toBe('undefined');
  });

  it('still accepts a top-level error, for hand-built events', async () => {
    const id = seedSession();
    emitPlan = [{ type: 'view:failed', view: 'slides', error: 'legacy shape' }];

    await runPipeline(id, 'prompt', [], null);

    expect(sessions.get(id).content.slides.error).toBe('legacy shape');
  });

  it('leaves successful views untouched', async () => {
    const id = seedSession();
    emitPlan = [
      { type: 'view:completed', view: 'slides', result: { success: true, data: { title: 'Deck' } } },
      { type: 'view:failed', view: 'roadmap', result: { success: false, error: REAL_ERROR } },
    ];

    await runPipeline(id, 'prompt', [], null);

    const content = sessions.get(id).content;
    expect(content.slides.success).toBe(true);
    expect(content.slides.data.title).toBe('Deck');
    expect(content.roadmap.error).toBe(REAL_ERROR);
  });
});
