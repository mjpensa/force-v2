/**
 * The single definition of "flatten sections into a linear slide list".
 *
 * Lives under Public/shared/ because both the browser view and the server-side PPTX
 * exporter need it; ppt-export-service-v2.js already imports Public/shared/text-utils.js
 * the same way.
 *
 * It replaces three implementations that disagreed:
 *
 *   SlidesView._flattenSections     started at index 2, and threw a TypeError on a section
 *                                   with no swimlane (`section.swimlane.toLowerCase()`)
 *   ppt-export-service flattenSections  silently skipped swimlane-less sections entirely
 *   content.js update-slide-field    counted everything, starting at 0
 *
 * On the captured decks every section has a swimlane, so two of the three agreed by luck.
 * The divergence is latent, not fixed: a prompt change that yields one swimlane-less
 * section crashes the viewer, drops that section from the export, and shifts every
 * subsequent index so an inline edit writes to the wrong slide.
 *
 * Unified behavior:
 *   - Indices start at 0 and count every entry. Position N here is position N everywhere.
 *   - A section missing a swimlane is KEPT. Dropping it loses content the user paid for;
 *     throwing takes down the whole view. It gets a synthetic id instead.
 *   - Nothing is prepended. The viewer's two hardcoded lorem-ipsum slides were the reason
 *     its indices began at 2, and they are gone.
 */

/** Stable, collision-resistant id for a section, tolerant of a missing swimlane. */
function sectionIdFor(section, position) {
  const label = section?.swimlane || section?.sectionTitle;
  if (!label) return `section-${position}`;
  const slug = String(label).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return slug || `section-${position}`;
}

/**
 * Flatten a deck.
 *
 * Returns `slides` (the linear list — an entry's position in this array is THE index used
 * everywhere), plus three lookup Maps the viewer's table of contents needs:
 * `sectionStartIndices` (sectionId to index), `sectionSlides` (sectionId to slide summaries)
 * and `slideIndices` (slideId to index).
 *
 * @param {Array} sections slidesData.sections
 */
export function flattenSlideDeck(sections) {
  const slides = [];
  const sectionStartIndices = new Map();
  const sectionSlides = new Map();
  const slideIndices = new Map();

  (Array.isArray(sections) ? sections : []).forEach((section, position) => {
    if (!section) return;
    const sectionId = sectionIdFor(section, position);

    sectionStartIndices.set(sectionId, slides.length);
    sectionSlides.set(sectionId, []);

    slides.push({
      layout: 'sectionTitle',
      swimlane: section.swimlane || section.sectionTitle || '',
      sectionTitle: section.sectionTitle || section.swimlane || '',
      _sectionId: sectionId,
    });

    (section.slides ?? []).forEach((slide, slideIdx) => {
      const slideId = `${sectionId}-slide-${slideIdx}`;
      const subTopic = slide.subTopic || slide.tagline || `Slide ${slideIdx + 1}`;
      const index = slides.length;

      slideIndices.set(slideId, index);
      sectionSlides.get(sectionId).push({ slideId, subTopic, index });

      slides.push({ ...slide, _sectionId: sectionId, _slideId: slideId, _subTopic: subTopic });
    });
  });

  return { slides, sectionStartIndices, sectionSlides, slideIndices };
}

/**
 * Locate the section/slide at a flat index, for in-place edits.
 * Returns null when the index is out of range.
 */
export function resolveSlideAt(sections, targetIndex) {
  let idx = 0;
  for (const section of Array.isArray(sections) ? sections : []) {
    if (!section) continue;
    if (idx === targetIndex) return { kind: 'sectionTitle', section, slide: null };
    idx++;
    for (const slide of section.slides ?? []) {
      if (idx === targetIndex) return { kind: 'slide', section, slide };
      idx++;
    }
  }
  return null;
}
