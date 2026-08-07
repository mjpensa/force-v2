import { jest, describe, it, expect, beforeAll } from '@jest/globals';

/**
 * The session sweeper is a module-level setInterval. Referenced, it keeps the Node event
 * loop alive for as long as the process runs.
 *
 * Every test file importing the content routes inherited that timer, so the suite could
 * never exit on its own and every run needed --forceExit. That flag is not free: it also
 * hides a genuinely hung test, so a real deadlock and this timer looked identical from the
 * outside.
 *
 * unref() is the fix rather than clearing the interval, because in production the HTTP
 * server keeps the process alive anyway — a sweeper over an in-memory Map has no business
 * doing so itself.
 */

// content.js imports the export services, which pull in pptxgenjs and docx. Stub the
// services rather than the libraries — mocking `docx` means enumerating every symbol its
// consumer imports, which breaks the moment that list changes.
await jest.unstable_mockModule('../../server/templates/ppt-export-service-v2.js', () => ({
  generatePptx: async () => Buffer.from('pptx'),
}));
await jest.unstable_mockModule('../../server/templates/docx-export-service.js', () => ({
  generateDocx: async () => Buffer.from('docx'),
  generateIntelligenceBriefDocx: async () => Buffer.from('docx'),
}));

let sessionSweeper;
let stopSessionSweeper;

beforeAll(async () => {
  ({ sessionSweeper, stopSessionSweeper } = await import('../../server/routes/content.js'));
});

describe('session sweeper', () => {
  it('does not hold the event loop open', () => {
    // hasRef() is Node's own answer to "would this timer keep the process alive?"
    expect(typeof sessionSweeper.hasRef).toBe('function');
    expect(sessionSweeper.hasRef()).toBe(false);
  });

  it('exposes a way to stop it for graceful shutdown', () => {
    expect(typeof stopSessionSweeper).toBe('function');
  });
});
