import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { loadFixture } from '../__helpers__/fixture-loader.js';
import { sampleResearchFiles, samplePrompt } from '../__helpers__/sample-research.js';

let generators;
let generateContentMock;

function resetMock() {
  generateContentMock = jest.fn().mockResolvedValue({ response: { text: () => '{}' } });
}

function setupMock(fixture) {
  generateContentMock = jest.fn().mockResolvedValue({
    response: { text: () => JSON.stringify(fixture) }
  });
}

function setupSequence(fixtures) {
  let i = 0;
  generateContentMock = jest.fn().mockImplementation(async () => {
    const f = fixtures[i] || fixtures[fixtures.length - 1];
    i++;
    return { response: { text: () => JSON.stringify(f) } };
  });
}

function setupError(message) {
  generateContentMock = jest.fn().mockRejectedValue(new Error(message));
}

beforeAll(async () => {
  resetMock();

  await jest.unstable_mockModule('@google/generative-ai', () => ({
    GoogleGenerativeAI: function () {
      return {
        getGenerativeModel() {
          return { generateContent: (...args) => generateContentMock(...args) };
        }
      };
    }
  }));

  await jest.unstable_mockModule('../../server/cache/DiskCache.js', () => ({
    DiskCache: function () {
      return { get: async () => null, set: async () => {} };
    },
    diskCache: { get: async () => null, set: async () => {} },
  }));

  generators = await import('../../server/generators.js');
});

beforeEach(() => {
  resetMock();
});

// Load fixtures once
const roadmapFixture = loadFixture('roadmap');
const slidesOutlineFixture = loadFixture('slides-outline');
const slidesFixture = loadFixture('slides');
const documentFixture = loadFixture('document');
const researchAnalysisFixture = loadFixture('research-analysis');
const narrativeSpineFixture = loadFixture('narrative-spine');

describe('generateAllContent', () => {
  it('returns all content types when Gemini returns valid data', async () => {
    // Sequence: Phase 0 (narrative-spine + research-analysis in parallel),
    // Phase 1 (roadmap + slides-outline), Phase 2 (slides + document).
    setupSequence([
      narrativeSpineFixture,
      researchAnalysisFixture,
      roadmapFixture,
      slidesOutlineFixture,
      slidesFixture,
      documentFixture,
    ]);

    const result = await generators.generateAllContent(samplePrompt, sampleResearchFiles);

    expect(result.roadmap.success).toBe(true);
    expect(result.roadmap.data).toBeDefined();
    expect(result.slides.success).toBe(true);
    expect(result.slides.data).toBeDefined();
    expect(result.document.success).toBe(true);
    expect(result.document.data).toBeDefined();
    expect(result.researchAnalysis.success).toBe(true);
    expect(result.researchAnalysis.data).toBeDefined();
    // Speaker notes are deferred
    expect(result.speakerNotes.deferred).toBe(true);
  });

  it('handles individual view failure gracefully (one fails, others succeed)', async () => {
    let callIndex = 0;
    const fixtures = [
      narrativeSpineFixture,
      researchAnalysisFixture,
      roadmapFixture,
      slidesOutlineFixture,
      slidesFixture,
      documentFixture,
    ];
    generateContentMock = jest.fn().mockImplementation(async () => {
      callIndex++;
      // Fail the 5th call (slides from outline — after spine, research-analysis, roadmap, slides-outline)
      if (callIndex === 5) throw new Error('Slides generation failed');
      return { response: { text: () => JSON.stringify(fixtures[callIndex - 1]) } };
    });

    const result = await generators.generateAllContent(samplePrompt, sampleResearchFiles);

    // Roadmap should still succeed
    expect(result.roadmap.success).toBe(true);
    // Slides should fail
    expect(result.slides.success).toBe(false);
    expect(result.slides.error).toBeDefined();
    // Document should still succeed
    expect(result.document.success).toBe(true);
    expect(result.researchAnalysis.success).toBe(true);
  });

  it('with requestedViews=[roadmap] only generates roadmap', async () => {
    setupSequence([narrativeSpineFixture, roadmapFixture]);

    const result = await generators.generateAllContent(samplePrompt, sampleResearchFiles, ['roadmap']);

    expect(result.roadmap.success).toBe(true);
    expect(result.roadmap.data).toBeDefined();
    // Others should be skipped
    expect(result.slides.skipped).toBe(true);
    expect(result.document.skipped).toBe(true);
    expect(result.researchAnalysis.skipped).toBe(true);
  });

  it('with requestedViews=[document] only generates document', async () => {
    setupSequence([narrativeSpineFixture, documentFixture]);

    const result = await generators.generateAllContent(samplePrompt, sampleResearchFiles, ['document']);

    expect(result.document.success).toBe(true);
    expect(result.roadmap.skipped).toBe(true);
    expect(result.slides.skipped).toBe(true);
  });

  it('with requestedViews=[research-analysis] only generates research analysis', async () => {
    setupSequence([narrativeSpineFixture, researchAnalysisFixture]);

    const result = await generators.generateAllContent(samplePrompt, sampleResearchFiles, ['research-analysis']);

    expect(result.researchAnalysis.success).toBe(true);
    expect(result.roadmap.skipped).toBe(true);
    expect(result.slides.skipped).toBe(true);
    expect(result.document.skipped).toBe(true);
  });
});

describe('generateRoadmap (via generateAllContent with requestedViews)', () => {
  it('returns { success: true, data } with valid fixture', async () => {
    setupSequence([narrativeSpineFixture, roadmapFixture]);
    const result = await generators.generateAllContent(samplePrompt, sampleResearchFiles, ['roadmap']);
    expect(result.roadmap.success).toBe(true);
    expect(result.roadmap.data.title).toBeDefined();
    expect(result.roadmap.data.data).toBeInstanceOf(Array);
  });

  it('returns { success: false, error } on Gemini error', async () => {
    setupError('Gemini API unavailable');
    const result = await generators.generateAllContent(samplePrompt, sampleResearchFiles, ['roadmap']);
    expect(result.roadmap.success).toBe(false);
    expect(result.roadmap.error).toContain('Gemini API unavailable');
  });
});

describe('generateDocument (via generateAllContent)', () => {
  it('retries on validation failure then returns result', async () => {
    // First call: document with weak executive summary
    const weakDoc = {
      ...documentFixture,
      executiveSummary: {
        situation: 'This report discusses cloud migration topics.',
        insight: 'Some things are happening.',
        action: 'We should do something.',
        source: 'research.md',
      },
      reasoning: documentFixture.reasoning,
    };
    // Sequence: spine (Phase 0), then weak doc, then good doc (retry)
    setupSequence([narrativeSpineFixture, weakDoc, documentFixture]);

    const result = await generators.generateAllContent(samplePrompt, sampleResearchFiles, ['document']);

    // Should succeed (either the retry produced a valid doc, or returns with validationIssues)
    expect(result.document.success).toBe(true);
    expect(result.document.data).toBeDefined();
  });
});

describe('APIQueue', () => {
  it('respects maxConcurrent (tasks queue when limit is reached)', async () => {
    const { APIQueue } = generators;
    const queue = new APIQueue(1);
    const order = [];

    const task1 = queue.add(async () => {
      order.push('start-1');
      await new Promise(r => setTimeout(r, 20));
      order.push('end-1');
      return 'a';
    }, 'task1');

    const task2 = queue.add(async () => {
      order.push('start-2');
      return 'b';
    }, 'task2');

    const [r1, r2] = await Promise.all([task1, task2]);
    expect(r1).toBe('a');
    expect(r2).toBe('b');
    // task2 should not start until task1 ends (maxConcurrent=1)
    expect(order.indexOf('start-2')).toBeGreaterThan(order.indexOf('end-1'));
  });

  it('allows concurrent tasks up to maxConcurrent', async () => {
    const { APIQueue } = generators;
    const queue = new APIQueue(2);
    const order = [];

    const task1 = queue.add(async () => {
      order.push('start-1');
      await new Promise(r => setTimeout(r, 30));
      order.push('end-1');
    }, 't1');

    const task2 = queue.add(async () => {
      order.push('start-2');
      await new Promise(r => setTimeout(r, 30));
      order.push('end-2');
    }, 't2');

    await Promise.all([task1, task2]);
    // Both should start before either ends (maxConcurrent=2)
    expect(order.indexOf('start-2')).toBeLessThan(order.indexOf('end-1'));
  });

  it('runAll executes all tasks and returns results', async () => {
    const { APIQueue } = generators;
    const queue = new APIQueue(2);
    const results = await queue.runAll([
      { task: async () => 'alpha', name: 'a' },
      { task: async () => 'beta', name: 'b' },
      { task: async () => 'gamma', name: 'c' },
    ]);
    expect(results).toEqual(['alpha', 'beta', 'gamma']);
  });
});

describe('regenerateContent', () => {
  it('dispatches to roadmap generator', async () => {
    setupMock(roadmapFixture);
    const result = await generators.regenerateContent('roadmap', samplePrompt, sampleResearchFiles);
    expect(result.success).toBe(true);
    expect(result.data.title).toBeDefined();
  });

  it('dispatches to research-analysis generator', async () => {
    setupMock(researchAnalysisFixture);
    const result = await generators.regenerateContent('research-analysis', samplePrompt, sampleResearchFiles);
    expect(result.success).toBe(true);
  });

  it('dispatches to document generator', async () => {
    setupSequence([documentFixture, documentFixture]);
    const result = await generators.regenerateContent('document', samplePrompt, sampleResearchFiles);
    expect(result.success).toBe(true);
  });

  it('dispatches to slides generator', async () => {
    // Slides requires outline + full slides (2 calls)
    setupSequence([slidesOutlineFixture, slidesFixture]);
    const result = await generators.regenerateContent('slides', samplePrompt, sampleResearchFiles);
    expect(result.success).toBe(true);
  });

  it('throws for invalid viewType', async () => {
    await expect(
      generators.regenerateContent('invalid-type', samplePrompt, sampleResearchFiles)
    ).rejects.toThrow('Invalid view type: invalid-type');
  });
});
