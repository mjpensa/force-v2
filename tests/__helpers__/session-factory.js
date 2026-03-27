import { loadFixture } from './fixture-loader.js';

export function createMockSession(overrides = {}) {
  const now = Date.now();
  return {
    prompt: 'Test prompt for analysis',
    researchFiles: [{ filename: 'test.txt', content: 'Test research content about market analysis.' }],
    content: {
      roadmap: { success: true, data: loadFixture('roadmap') },
      slides: { success: true, data: loadFixture('slides') },
      document: { success: true, data: loadFixture('document') },
      researchAnalysis: { success: true, data: loadFixture('research-analysis') },
    },
    createdAt: now,
    lastAccessed: now,
    ...overrides,
  };
}

export function seedSession(sessionsMap, sessionId = 'test-session-id', overrides = {}) {
  const session = createMockSession(overrides);
  sessionsMap.set(sessionId, session);
  return session;
}
