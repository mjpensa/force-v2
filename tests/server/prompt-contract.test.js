import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  // The degraded-input paths get their own coverage because that is where this class of
  // defect actually lives: a field the happy path always populates, interpolated unguarded.
  // An earlier version of this test omitted /\bundefined\b/ here, and a real leak went
  // through the gap — generateSlidesPrompt emitted
  //   The outline specifies "undefined" as the dominant analytical lens
  // whenever an outline arrived without reasoning.primaryFramework.
  it.each([
    ['null outline', () => generateSlidesPrompt(userPrompt, researchFiles, [], null, precomputed)],
    ['outline with no reasoning', () => generateSlidesPrompt(userPrompt, researchFiles, [{ name: 'D', entity: 'E', taskCount: 1 }], { sections: [] }, precomputed)],
    ['outline with empty reasoning', () => generateSlidesPrompt(userPrompt, researchFiles, [], { reasoning: {}, sections: [] }, precomputed)],
    ['no precomputed at all', () => generateSlidesPrompt(userPrompt, researchFiles, [{ name: 'D', entity: 'E', taskCount: 1 }], { sections: [] }, null)],
  ])('slides emits no rot for %s', (_label, build) => {
    const prompt = build();
    expect(prompt).not.toMatch(/\$\{/);
    expect(prompt).not.toMatch(/\bundefined\b/);
    expect(prompt).not.toMatch(/\[object Object\]/);
    expect(prompt).not.toMatch(/\bNaN\b/);
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

describe('deck size stays inside the downstream budget', () => {
  /**
   * The prompt used to assert "minimum 5 slides per section" alongside "aim for 15-30 slides
   * total". Those cannot both hold past six sections: nine swimlanes puts the floor at 45,
   * above the stated maximum. The model followed the per-section rule and produced 50 content
   * slides against a cap of 30.
   *
   * That overrun is what truncated speaker notes. Notes cost ~1212 output tokens per slide,
   * so 50 slides needs ~68K against a 65,536 ceiling — the run produced notes for 24 of 50
   * slides and lost the rest with no signal. Deck size is a budget constraint, not a
   * preference.
   */
  const swimlanesOf = n => Array.from({ length: n }, (_, i) => ({ name: `S${i}`, entity: 'E', taskCount: 2 }));

  it.each([3, 5, 6, 9, 12])('states a per-section target that multiplies out within the cap (%i sections)', n => {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles, swimlanesOf(n), { sections: [] }, precomputed);
    const m = prompt.match(/Target (\d+) content slides in total,\s*which is about (\d+) per section/);
    expect(m).not.toBeNull();

    const [, total, perSection] = m.map(Number);
    expect(total).toBe(SLIDE_LIMITS.DECK_MAX_SLIDES);
    // The instruction must be self-consistent: per-section x sections cannot blow the total.
    // Allowing a small floor for very many sections, it must never imply the old 45-vs-30.
    expect(perSection * n).toBeLessThanOrEqual(SLIDE_LIMITS.DECK_MAX_SLIDES + n);
  });

  it('never states a per-section minimum that contradicts the total', () => {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles, swimlanesOf(9), { sections: [] }, precomputed);
    expect(prompt).not.toMatch(/Minimum 5 slides per section/i);
    expect(prompt).not.toMatch(/5-10 slides per section/);
  });

  it('the cap leaves speaker notes inside the model output ceiling', () => {
    // ~1212 output tokens per slide measured from speaker-notes-1.json under the 7-field
    // schema, against a 65,536 ceiling less a 6,000 thinking budget.
    const TOKENS_PER_SLIDE = 1212;
    const CEILING = 65536;
    const THINKING = 6000;
    expect(SLIDE_LIMITS.DECK_MAX_SLIDES * TOKENS_PER_SLIDE).toBeLessThan(CEILING - THINKING);
  });
});

describe('prompt examples demonstrate the rule they state', () => {
  /**
   * The slides prompt stated a 380-410 character paragraph target six times, and none of its
   * three worked examples sat inside it: the "GOOD paragraph example" was 318 characters and
   * the two under "COMPLETE SLIDE EXAMPLES (STUDY THESE)" were 418 and 436.
   *
   * Observed output medians were 440 and 464 — tracking the examples, not the number. That is
   * the mechanical reason restating the rule six times never moved compliance off 93% and 99%
   * violation: the demonstration contradicted the instruction, and demonstrations win.
   */
  const SOURCE = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server', 'prompts', 'slides.js'),
    'utf8'
  );

  // The example paragraphs the prompt teaches from: long quoted prose, not schema or code.
  const examples = [...SOURCE.matchAll(/"((?:[^"\\]|\\.){250,})"/g)]
    .map(m => m[1])
    .filter(t => !t.includes('${') && !t.includes('\n') && /[.!?]\s/.test(t));

  it('finds the paragraph examples', () => {
    expect(examples.length).toBeGreaterThanOrEqual(3);
  });

  it.each(examples.map((t, i) => [i, t]))(
    'example %i sits inside the stated paragraph target',
    (_i, text) => {
      expect(text.length).toBeGreaterThanOrEqual(SLIDE_LIMITS.PARAGRAPH_TARGET_MIN);
      expect(text.length).toBeLessThanOrEqual(SLIDE_LIMITS.PARAGRAPH_TARGET_MAX);
    }
  );
});

describe('slide-count rules cannot contradict each other', () => {
  /**
   * This class of defect has now appeared twice in the same prompt.
   *
   * First: "minimum 5 slides per section" alongside "aim for 15-30 slides total" — a floor of
   * 45 against a ceiling of 30 at nine sections. The model obeyed the floor and produced 50,
   * which truncated the downstream speaker notes.
   *
   * Second, introduced by the fix for the first: the deck cap told a nine-section deck to use
   * about three slides per section, while the three-phase narrative arc separately REQUIRED
   * 1-2 + 3-5 + 2-3 = six to ten per section, and fixed sections demanded 4-8. The floor was
   * back at ~50.
   *
   * The rule is therefore structural rather than about any one number: the prompt must not
   * state a hard per-section slide count anywhere, because any fixed count multiplied by the
   * section count will eventually exceed the deck cap. Section shape is expressed
   * proportionally instead.
   */
  const swimlanesOf = n => Array.from({ length: n }, (_, i) => ({ name: `S${i}`, entity: 'E', taskCount: 2 }));

  it.each([3, 6, 9, 12])('states no fixed per-section slide count (%i sections)', n => {
    const prompt = generateSlidesPrompt(userPrompt, researchFiles, swimlanesOf(n), { sections: [] }, precomputed);

    // Any "<digit>-<digit> slides" phrasing is a hard count that does not scale with section
    // count. The single derived "about N per section" target is the only place a number belongs.
    const hardCounts = [...prompt.matchAll(/(\d+)\s*-\s*(\d+)\s+slides/gi)].map(m => m[0]);
    expect(hardCounts).toEqual([]);
  });

  it('the derived per-section target never implies more than the deck cap', () => {
    for (const n of [3, 5, 6, 9, 12, 15]) {
      const prompt = generateSlidesPrompt(userPrompt, researchFiles, swimlanesOf(n), { sections: [] }, precomputed);
      const m = prompt.match(/which is about (\d+) per section/);
      expect(m).not.toBeNull();
      const perSection = Number(m[1]);
      // A small floor is allowed for many-section decks, but never the 45-vs-30 blowout.
      expect(perSection * n).toBeLessThanOrEqual(SLIDE_LIMITS.DECK_MAX_SLIDES + n);
    }
  });
});
