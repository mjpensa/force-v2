import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SlidesView } from "../../Public/components/views/SlidesView.js";
import { flattenSlideDeck, resolveSlideAt } from "../../Public/shared/flatten-slides.js";

/**
 * Parity tests for "flatten sections into a linear slide list".
 *
 * There used to be three independent implementations, and they disagreed:
 *
 *   SlidesView._flattenSections        started at index 2 (two hardcoded demo slides),
 *                                      and threw a TypeError on a swimlane-less section
 *   ppt-export-service flattenSections silently skipped swimlane-less sections
 *   content.js update-slide-field      counted everything, starting at 0
 *
 * So editing slide N in the viewer wrote to slide N-2 on the server. It "worked" only
 * because _persistSlideEdit subtracted 2 to compensate — two errors cancelling.
 *
 * All three now call Public/shared/flatten-slides.js. These assertions were first written
 * against the old behavior and passed, then updated to assert convergence, so the refactor
 * is shown to have changed only what it intended to.
 *
 * The viewer's method is invoked via .call() on a bare object carrying the three Maps it
 * populates: that exercises the real production method without constructing the class or
 * needing a DOM.
 */

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'golden');
const golden = name => JSON.parse(readFileSync(join(GOLDEN_DIR, `${name}.json`), 'utf8')).data;

function viewerFlatten(sections) {
  const ctx = {
    sectionStartIndices: new Map(),
    sectionSlides: new Map(),
    slideIndices: new Map(),
  };
  const slides = SlidesView.prototype._flattenSections.call(ctx, sections);
  return { slides, ctx };
}

// All three call sites now go through the same module, so the test drives it directly
// rather than mirroring three separate copies.
const exporterFlatten = sections => flattenSlideDeck(sections).slides;
const routeIndexOf = (sections, targetIdx) => resolveSlideAt(sections, targetIdx);

const withSwimlanes = golden('slides-1');

describe('flatten: real decks', () => {
  it.each(['slides-1', 'slides-2'])('viewer and exporter produce the same sequence for %s', name => {
    const data = golden(name);
    const { slides: viewer } = viewerFlatten(data.sections);
    const exporter = exporterFlatten(data.sections);

    expect(viewer.length).toBe(exporter.length);
    expect(viewer.map(s => s.layout)).toEqual(exporter.map(s => s.layout));
    expect(viewer.map(s => s.tagline ?? s.sectionTitle)).toEqual(
      exporter.map(s => s.tagline ?? s.sectionTitle)
    );
  });

  it('viewer indices start at 0 — the demo-slide offset is gone', () => {
    const { ctx } = viewerFlatten(withSwimlanes.sections);
    expect([...ctx.sectionStartIndices.values()][0]).toBe(0);
  });

  // The user-visible form of the old bug: editing slide N in the viewer wrote to slide N-2
  // on the server, so an inline edit landed on a different slide than the one on screen.
  it('viewer index N resolves to the same slide the route resolves', () => {
    const { slides: viewer } = viewerFlatten(withSwimlanes.sections);

    for (const idx of [0, 1, 5, 12, viewer.length - 1]) {
      const resolved = routeIndexOf(withSwimlanes.sections, idx);
      expect(resolved).not.toBeNull();
      if (viewer[idx].layout === 'sectionTitle') {
        expect(resolved.kind).toBe('sectionTitle');
        expect(resolved.section.sectionTitle || resolved.section.swimlane).toBe(viewer[idx].sectionTitle);
      } else {
        expect(resolved.kind).toBe('slide');
        expect(resolved.slide.tagline).toBe(viewer[idx].tagline);
      }
    }
  });

  it('the exported deck has exactly the slides the viewer shows', () => {
    const { slides: viewer } = viewerFlatten(withSwimlanes.sections);
    expect(exporterFlatten(withSwimlanes.sections).length).toBe(viewer.length);
  });
});

describe('flatten: the swimlane-less section, where the three used to diverge', () => {
  const pathological = {
    sections: [
      { swimlane: 'Alpha', sectionTitle: 'A', slides: [{ tagline: 'a1' }] },
      { sectionTitle: 'No swimlane', slides: [{ tagline: 'b1' }] }, // swimlane absent
      { swimlane: 'Gamma', sectionTitle: 'C', slides: [{ tagline: 'c1' }] },
    ],
  };

  // Not hypothetical: any prompt change that yields a section without a swimlane hits this,
  // and Phases 4-5 rewrite the prompts that produce it. Previously the viewer threw a
  // TypeError, the exporter silently dropped the section, and the route counted it — three
  // behaviors from one input.
  it('viewer no longer throws', () => {
    expect(() => viewerFlatten(pathological.sections)).not.toThrow();
  });

  it('keeps the section rather than silently dropping its content', () => {
    const flat = exporterFlatten(pathological.sections);
    expect(flat.map(s => s.tagline ?? s.sectionTitle)).toEqual(['A', 'a1', 'No swimlane', 'b1', 'C', 'c1']);
  });

  it('all three agree on what lives at each index', () => {
    const { slides: viewer } = viewerFlatten(pathological.sections);
    const exporter = exporterFlatten(pathological.sections);
    expect(exporter.length).toBe(viewer.length);

    // Index 4 is Gamma's section title in every one of them.
    expect(viewer[4].sectionTitle).toBe('C');
    expect(exporter[4].sectionTitle).toBe('C');
    expect(routeIndexOf(pathological.sections, 4)).toMatchObject({ kind: 'sectionTitle' });
    expect(routeIndexOf(pathological.sections, 4).section.swimlane).toBe('Gamma');
  });

  it('gives the swimlane-less section a usable id instead of crashing on it', () => {
    const { ctx } = viewerFlatten(pathological.sections);
    const ids = [...ctx.sectionStartIndices.keys()];
    expect(ids).toHaveLength(3);
    expect(ids.every(id => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });
});
