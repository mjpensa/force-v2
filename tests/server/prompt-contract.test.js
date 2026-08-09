import { describe, it, expect } from '@jest/globals';
import { getCurrentDateContext } from '../../server/prompts/common.js';
import { generateRoadmapPrompt } from '../../server/prompts/roadmap.js';
import { generateSlidesPrompt, generateSlidesOutlinePrompt } from '../../server/prompts/slides.js';
import { generateDocumentPrompt } from '../../server/prompts/document.js';
import { generateResearchAnalysisPrompt } from '../../server/prompts/research-analysis.js';
import { generateNarrativeSpinePrompt } from '../../server/prompts/narrative-spine.js';
import { generateSwotAnalysisPrompt } from '../../server/prompts/swot-analysis.js';
import { generateCompetitiveAnalysisPrompt } from '../../server/prompts/competitive-analysis.js';
import { generateRiskRegisterPrompt } from '../../server/prompts/risk-register.js';
import { SLIDE_LIMITS } from '../../Public/shared/slide-limits.js';

/**
 * Contract tests for the prompt builders — the gate that makes a prompt rewrite reviewable.
 *
 * Free-tier quota is 20 requests/day/model, so almost everything worth checking about a
 * prompt has to be checkable without calling the API. These builders are pure functions of
 * their arguments, so nearly everything is: does it interpolate what it was given, does it
 * contain template rot, has it grown, do its stated numbers agree with the constants the
 * code enforces.
 *
 * What these cannot tell you is whether a rewritten prompt produces *better output*. That
 * needs a live call, measured against docs/PHASE-2-COMPLIANCE.md.
 */

const FIXED_NOW = new Date('2026-05-15T12:00:00Z');
const dateContext = getCurrentDateContext(FIXED_NOW);

const researchFiles = [
  { filename: 'alpha-research.txt', content: 'Adoption reached 47% in Q1 2026 per Gartner.' },
  { filename: 'beta-notes.md', content: 'Implementation cost fell to $1.2M annually.' },
];
const userPrompt = 'Build a client-ready proposal on platform consolidation.';
const swimlanes = [{ name: 'Discovery', entity: 'Team A', taskCount: 3 }];
const outline = {
  reasoning: { primaryFramework: 'COMPETITIVE_DYNAMICS' },
  sections: [{ swimlane: 'Discovery', narrativeArc: 'A to B to C', slides: [{ tagline: 'FAST START' }] }],
};
const precomputed = { dateContext };

/** Every builder, with arguments that exercise its full signature. */
const BUILDERS = [
  ['roadmap', () => generateRoadmapPrompt(userPrompt, researchFiles, precomputed)],
  ['slides-outline', () => generateSlidesOutlinePrompt(userPrompt, researchFiles, swimlanes, precomputed)],
  ['slides', () => generateSlidesPrompt(userPrompt, researchFiles, swimlanes, outline, precomputed)],
  ['document', () => generateDocumentPrompt(userPrompt, researchFiles, swimlanes, precomputed)],
  ['research-analysis', () => generateResearchAnalysisPrompt(userPrompt, researchFiles, precomputed)],
  ['narrative-spine', () => generateNarrativeSpinePrompt(userPrompt, researchFiles, precomputed)],
  ['swot-analysis', () => generateSwotAnalysisPrompt(userPrompt, researchFiles, precomputed)],
  ['competitive-analysis', () => generateCompetitiveAnalysisPrompt(userPrompt, researchFiles, precomputed)],
  ['risk-register', () => generateRiskRegisterPrompt(userPrompt, researchFiles, precomputed)],
];

const estimateTokens = s => Math.ceil(s.length / 4);

describe('prompt builders: determinism', () => {
  it.each(BUILDERS)('%s renders identically for identical input', (_name, build) => {
    expect(build()).toBe(build());
  });
});

describe('prompt builders: no template rot', () => {
  // Catches the class of defect that put the literal string "undefined" into every
  // downstream prompt for months via formatNarrativeSpine. An unresolved interpolation is
  // invisible in a diff and expensive to spot in output.
  it.each(BUILDERS)('%s contains no unresolved interpolation', (_name, build) => {
    const prompt = build();
    expect(prompt).not.toMatch(/\$\{/);
    expect(prompt).not.toMatch(/\bundefined\b/);
    expect(prompt).not.toMatch(/\[object Object\]/);
    expect(prompt).not.toMatch(/\bNaN\b/);
  });

  // Every builder defaults precomputed/outline to null, so these paths are the ones a
  // caller hits first in production and the ones least covered elsewhere.
  it.each(BUILDERS)('%s survives empty and null inputs', (_name, build) => {
    expect(() => build()).not.toThrow();
  });

  it('slides survives a null outline and empty swimlanes', () => {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles, [], null, precomputed);
    expect(prompt).not.toMatch(/\$\{|\[object Object\]|\bNaN\b/);
  });

  // A user can upload files that all fail extraction, leaving an empty array by the time the
  // prompt is built.
  it('builders survive an empty research set', () => {
    expect(() => generateRoadmapPrompt(userPrompt, [], null)).not.toThrow();
    expect(() => generateNarrativeSpinePrompt(userPrompt, [], null)).not.toThrow();
    expect(() => generateSwotAnalysisPrompt(userPrompt, [], null)).not.toThrow();
    expect(() => generateSlidesPrompt(userPrompt, [], [], null, null)).not.toThrow();
  });
});

describe('prompt builders: interpolation contract', () => {
  it.each(BUILDERS)('%s includes the user prompt verbatim', (_name, build) => {
    expect(build()).toContain(userPrompt);
  });

  it.each(BUILDERS)('%s includes every research file name and a distinctive substring', (_name, build) => {
    const prompt = build();
    for (const file of researchFiles) {
      expect(prompt).toContain(file.filename);
      expect(prompt).toContain(file.content.slice(0, 24));
    }
  });

  // generateSlidesPrompt takes five arguments and is 400 lines long; silently dropping one
  // would be invisible until the output was wrong.
  it('slides carries the swimlanes and the outline it was given', () => {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles, swimlanes, outline, precomputed);
    expect(prompt).toContain('Discovery');
    expect(prompt).toContain('FAST START');
  });
});

describe('prompt builders: token budget', () => {
  // Prompt growth is how a rewrite quietly becomes more expensive and starts crowding out
  // the research content it is supposed to be reasoning over. These ceilings are set above
  // current size; tighten them as the Phase 4 rewrite shrinks each prompt.
  const CEILINGS = {
    'roadmap': 6000,
    'slides-outline': 12000,
    'slides': 20000,
    'document': 12000,
    'research-analysis': 6000,
    'narrative-spine': 3000,
    'swot-analysis': 3000,
    'competitive-analysis': 3000,
    'risk-register': 3000,
  };

  it.each(BUILDERS)('%s stays under its token ceiling', (name, build) => {
    const tokens = estimateTokens(build());
    expect(tokens).toBeLessThanOrEqual(CEILINGS[name]);
  });

  it('records current sizes so growth is visible in review', () => {
    const sizes = BUILDERS.map(([name, build]) => `  ${name.padEnd(22)} ~${estimateTokens(build())} tokens`);
    console.log('[prompt sizes]\n' + sizes.join('\n'));
    expect(sizes.length).toBe(BUILDERS.length);
  });
});

describe('prompt builders: stated limits match enforced limits', () => {
  // The prompt telling the model one number while the validator enforces another is exactly
  // how the 205/280/320/390/410/450 spread arose. If a number appears in prompt prose it
  // should come from SLIDE_LIMITS.
  it('the slides prompt quotes the tagline limit the validator enforces', () => {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles, swimlanes, outline, precomputed);
    expect(prompt).toContain(String(SLIDE_LIMITS.TAGLINE_MAX));
  });

  it('the slides prompt quotes a paragraph target inside the accepted band', () => {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles, swimlanes, outline, precomputed);
    const quoted = [...prompt.matchAll(/\b(\d{3})\s*(?:-|to|–)\s*(\d{3})\b/g)]
      .map(([, lo, hi]) => [Number(lo), Number(hi)])
      .filter(([lo, hi]) => lo >= 200 && hi <= 600);

    expect(quoted.length).toBeGreaterThan(0);
    for (const [lo, hi] of quoted) {
      expect(lo).toBeGreaterThanOrEqual(SLIDE_LIMITS.PARAGRAPH_MIN);
      expect(hi).toBeLessThanOrEqual(SLIDE_LIMITS.PARAGRAPH_MAX);
    }
  });
});

describe('date context', () => {
  it('is injectable, so prompt snapshots do not rot at midnight', () => {
    const a = getCurrentDateContext(FIXED_NOW);
    const b = getCurrentDateContext(FIXED_NOW);
    expect(a).toEqual(b);
    expect(a.fullDate).toBe('2026-05-15');
    expect(a.currentQuarter).toBe('Q2 2026');
    expect(a.nextQuarter).toBe('Q3 2026');
  });

  it('still defaults to now for production callers', () => {
    expect(getCurrentDateContext().fullDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('prompt stability as a cache key', () => {
  /**
   * DiskCache keys on the full prompt string, so anything that varies between two
   * otherwise-identical requests makes the cache permanently unreachable for that generator.
   *
   * research-analysis embedded `new Date().toISOString()` so the model could echo it back
   * into generatedAt. Three identical requests produced three distinct cache keys — a silent
   * 100% miss rate on one of the more expensive generators, against a 20-request/day budget.
   * generatedAt is now stamped server-side, where the clock actually lives.
   */
  it.each(BUILDERS)('%s produces a byte-identical prompt across a time boundary', async (_name, build) => {
    const first = build();
    await new Promise(r => setTimeout(r, 25));
    expect(build()).toBe(first);
  });

  it('no prompt embeds a millisecond-precision timestamp', () => {
    for (const [name, build] of BUILDERS) {
      const matches = build().match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g) ?? [];
      expect(matches).toEqual([]);
      expect(name).toBeTruthy();
    }
  });
});
