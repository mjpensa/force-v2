import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { flattenSlideDeck } from '../../Public/shared/flatten-slides.js';
import { alignSpeakerNotes } from '../../Public/shared/speaker-notes-align.js';
import { generatePptx } from '../../server/templates/ppt-export-service-v2.js';
import { generateSpeakerNotesPrompt } from '../../server/prompts/slides.js';
import { SpeakerNotesManager } from '../../Public/components/views/SpeakerNotesManager.js';
import { loadResearchFiles } from '../__helpers__/fixture-loader.js';

/**
 * Speaker notes used to be bound to slides by string similarity, in two places that
 * disagreed. Measured against the golden corpus before the change:
 *
 *   viewer  0 of 50 slides matched by the first three strategies; the best capture reached
 *           28 fuzzy substring matches, 20 low-confidence positional guesses, 2 nothing
 *   PPTX    0 of 50 on both captures — every export shipped empty notesSlide parts
 *
 * The model does not echo the strings the matchers keyed on: it returns the whole reference
 * line as `slideTagline` ("MARKET INFLECTION - Unprecedented Rivalry" for a slide tagged
 * "MARKET INFLECTION"), and `slideIndex` was specified per-section so it is not unique.
 *
 * These tests pin the two positional binding rules and, most importantly, the export
 * regression: the number that must never return to zero.
 */

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'golden');
const golden = name => JSON.parse(readFileSync(join(GOLDEN_DIR, `${name}.json`), 'utf8')).data;

// A three-section deck: 2 + 2 + 1 content slides at flat indices 1,2 / 4,5 / 7.
const deck = {
  sections: [
    { swimlane: 'Overview', slides: [{ tagline: 'ALPHA' }, { tagline: 'BETA' }] },
    { swimlane: 'Hardware & Infrastructure', slides: [{ tagline: 'GAMMA' }, { tagline: 'DELTA' }] },
    { swimlane: 'Outlook', slides: [{ tagline: 'EPSILON' }] },
  ],
};
const flat = () => flattenSlideDeck(deck.sections).slides;

describe('alignSpeakerNotes', () => {
  describe('rule: index', () => {
    it('binds notes that carry valid, distinct global indices', () => {
      const notes = [
        { slideIndex: 1, sectionName: 'Overview', id: 'a' },
        { slideIndex: 5, sectionName: 'Hardware & Infrastructure', id: 'b' },
        { slideIndex: 7, sectionName: 'Outlook', id: 'c' },
      ];
      const r = alignSpeakerNotes(notes, flat());
      expect(r.method).toBe('index');
      expect(r.byIndex.get(1).id).toBe('a');
      expect(r.byIndex.get(5).id).toBe('b');
      expect(r.byIndex.get(7).id).toBe('c');
    });

    it('refuses index binding when a claimed index is a section title slide', () => {
      // Index 3 is the "Hardware & Infrastructure" title slide, which gets no notes.
      const notes = [
        { slideIndex: 1, sectionName: 'Overview' },
        { slideIndex: 3, sectionName: 'Hardware & Infrastructure' },
      ];
      expect(alignSpeakerNotes(notes, flat()).method).toBe('section');
    });

    it('refuses index binding when two notes claim the same index', () => {
      const notes = [
        { slideIndex: 1, sectionName: 'Overview' },
        { slideIndex: 1, sectionName: 'Hardware & Infrastructure' },
      ];
      expect(alignSpeakerNotes(notes, flat()).method).toBe('section');
    });
  });

  describe('rule: section', () => {
    it('pairs per-section indices with that section’s slides in order', () => {
      // The shape the model actually produced: 0,1 restarting in every section.
      const notes = [
        { slideIndex: 0, sectionName: 'Overview', id: 'a' },
        { slideIndex: 1, sectionName: 'Overview', id: 'b' },
        { slideIndex: 0, sectionName: 'Hardware & Infrastructure', id: 'c' },
        { slideIndex: 1, sectionName: 'Hardware & Infrastructure', id: 'd' },
        { slideIndex: 0, sectionName: 'Outlook', id: 'e' },
      ];
      const r = alignSpeakerNotes(notes, flat());
      expect(r.method).toBe('section');
      expect([...r.byIndex].map(([i, n]) => [i, n.id]))
        .toEqual([[1, 'a'], [2, 'b'], [4, 'c'], [5, 'd'], [7, 'e']]);
    });

    it('matches section names case- and whitespace-insensitively', () => {
      const notes = [{ slideIndex: 0, sectionName: '  hardware &   infrastructure ', id: 'c' }];
      expect(alignSpeakerNotes(notes, flat()).byIndex.get(4).id).toBe('c');
    });

    it('leaves a note unbound rather than guessing when its section is unknown', () => {
      const notes = [
        { slideIndex: 0, sectionName: 'Overview', id: 'a' },
        { slideIndex: 0, sectionName: 'A Section That Is Not In The Deck', id: 'x' },
      ];
      const r = alignSpeakerNotes(notes, flat());
      expect(r.bound).toBe(1);
      expect(r.unusedNotes).toBe(1);
      expect([...r.byIndex.values()].map(n => n.id)).toEqual(['a']);
    });

    it('drops surplus notes instead of spilling them into the next section', () => {
      const notes = [
        { slideIndex: 0, sectionName: 'Overview', id: 'a' },
        { slideIndex: 1, sectionName: 'Overview', id: 'b' },
        { slideIndex: 2, sectionName: 'Overview', id: 'surplus' },
      ];
      const r = alignSpeakerNotes(notes, flat());
      expect(r.bound).toBe(2);
      expect(r.unusedNotes).toBe(1);
      expect(r.byIndex.has(4)).toBe(false); // the next section's first slide stays empty
    });

    it('never binds a note to a section title slide', () => {
      const notes = deck.sections.flatMap(s =>
        s.slides.map((_, i) => ({ slideIndex: i, sectionName: s.swimlane })));
      const slides = flat();
      for (const i of alignSpeakerNotes(notes, slides).byIndex.keys()) {
        expect(slides[i].layout).not.toBe('sectionTitle');
      }
    });
  });

  describe('degenerate input', () => {
    it.each([
      ['no notes', [], flat()],
      ['null notes', null, flat()],
      ['no slides', [{ slideIndex: 0, sectionName: 'Overview' }], []],
      ['null slides', [{ slideIndex: 0, sectionName: 'Overview' }], null],
    ])('returns an empty binding for %s', (_label, notes, slides) => {
      const r = alignSpeakerNotes(notes, slides);
      expect(r.method).toBe('none');
      expect(r.byIndex.size).toBe(0);
    });

    it('ignores null entries in the notes array', () => {
      const notes = [null, { slideIndex: 0, sectionName: 'Overview', id: 'a' }];
      expect(alignSpeakerNotes(notes, flat()).byIndex.get(1).id).toBe('a');
    });
  });
});

describe('alignSpeakerNotes against the golden corpus', () => {
  // Both captures were generated from the slides-1 deck.
  const slides = flattenSlideDeck(golden('slides-1').sections).slides;

  it.each(['speaker-notes-1', 'speaker-notes-2'])('binds every note in %s', name => {
    const notes = golden(name).slides;
    const r = alignSpeakerNotes(notes, slides);

    expect(r.bound).toBe(notes.length);
    expect(r.unusedNotes).toBe(0);
  });

  it.each(['speaker-notes-1', 'speaker-notes-2'])(
    'puts every %s note in the section it claims', name => {
      const r = alignSpeakerNotes(golden(name).slides, slides);
      const norm = s => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');

      for (const [index, note] of r.byIndex) {
        expect(norm(slides[index]._sectionLabel)).toBe(norm(note.sectionName));
      }
    });
});

describe('PPTX export carries speaker notes', () => {
  // The regression this guards: 59 notesSlide parts, 0 with any text.
  it.each([
    ['speaker-notes-1', 24],
    ['speaker-notes-2', 27],
  ])('writes %s notes into the deck', async (name, expected) => {
    const slidesData = { ...golden('slides-1'), speakerNotes: golden(name) };
    const zip = await JSZip.loadAsync(await generatePptx(slidesData));

    const parts = Object.keys(zip.files).filter(f => /notesSlide\d+\.xml$/.test(f));
    const texts = await Promise.all(parts.map(async f =>
      (await zip.file(f).async('string')).replace(/<[^>]+>/g, '').trim()));

    expect(texts.filter(t => t.length > 3)).toHaveLength(expected);
  }, 60000);
});

describe('the viewer resolves notes through the same binding', () => {
  // Drives the real SpeakerNotesManager against a bare view object, the same technique
  // flatten-parity.test.js uses: no DOM, no class construction ceremony, real production
  // method. Only the lookup is exercised — _renderNotesHTML needs document.createElement.
  const slides = flattenSlideDeck(golden('slides-1').sections).slides;
  const managerFor = notes => {
    const view = { speakerNotes: notes, slides, index: 0 };
    return { view, mgr: new SpeakerNotesManager(view) };
  };

  it('gives every section title slide no notes, and never throws', () => {
    const { view, mgr } = managerFor(golden('speaker-notes-2'));
    let titles = 0;
    slides.forEach((slide, i) => {
      view.index = i;
      const notes = mgr._getNotesForCurrentSlide();
      if (slide.layout === 'sectionTitle') { titles++; expect(notes).toBeNull(); }
    });
    expect(titles).toBe(golden('slides-1').sections.length);
  });

  it('resolves the same notes the exporter would, slide for slide', () => {
    const noteData = golden('speaker-notes-2');
    const { view, mgr } = managerFor(noteData);
    const exporterBinding = alignSpeakerNotes(noteData.slides, slides).byIndex;

    let matched = 0;
    slides.forEach((_slide, i) => {
      view.index = i;
      expect(mgr._getNotesForCurrentSlide()).toBe(exporterBinding.get(i) ?? null);
      if (exporterBinding.has(i)) matched++;
    });
    expect(matched).toBe(noteData.slides.length);
  });

  it('reuses one alignment instead of recomputing per slide', () => {
    const { view, mgr } = managerFor(golden('speaker-notes-2'));
    const first = mgr._alignment();
    view.index = 12;
    expect(mgr._alignment()).toBe(first);

    // ...but recomputes when the notes payload is replaced, as regeneration does.
    view.speakerNotes = golden('speaker-notes-1');
    expect(mgr._alignment()).not.toBe(first);
  });
});

describe('the speaker notes prompt hands the model the indices it must copy', () => {
  const slidesData = golden('slides-1');
  const prompt = generateSpeakerNotesPrompt(slidesData, loadResearchFiles(), 'Brief the board');
  const flatSlides = flattenSlideDeck(slidesData.sections).slides;

  it('marks every content slide with its flat deck index', () => {
    const marked = [...prompt.matchAll(/\[slide (\d+)\]/g)].map(m => Number(m[1]));
    const contentIndices = flatSlides
      .map((s, i) => (s.layout === 'sectionTitle' ? null : i))
      .filter(i => i !== null);

    expect(marked).toEqual(contentIndices);
  });

  it('marks no section title slide', () => {
    const marked = new Set([...prompt.matchAll(/\[slide (\d+)\]/g)].map(m => Number(m[1])));
    flatSlides.forEach((slide, i) => {
      if (slide.layout === 'sectionTitle') expect(marked.has(i)).toBe(false);
    });
  });

  it('does not tell the model to number within a section', () => {
    // The instruction that produced 27 notes with 3 distinct slideIndex values.
    expect(prompt).not.toMatch(/position within (its|the) section/i);
    expect(prompt).not.toMatch(/0-based within section/i);
  });
});
