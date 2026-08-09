/**
 * Bind speaker notes to slides.
 *
 * This replaces two independent fuzzy matchers that both failed:
 *
 *   SpeakerNotesManager  five cascading strategies on a 21-char tagline
 *   ppt-export-service   the first three of those five, reimplemented
 *
 * Measured against the golden corpus before this module existed, on the deck the notes were
 * actually generated from:
 *
 *   viewer  0 of 50 slides matched by strategies 1-3; the best capture reached 28 fuzzy
 *           substring matches, 20 low-confidence positional guesses, 2 nothing at all
 *   PPTX    0 of 50, both captures — every exported deck shipped 59 empty notesSlide parts
 *
 * The matchers were not subtly miscalibrated. They were asking the model to reproduce two
 * identifying strings verbatim, and it reproduces neither:
 *
 *   - `slideTagline` comes back as the whole reference line, not the quoted tagline:
 *     the deck says "MARKET INFLECTION", the notes say "MARKET INFLECTION - Unprecedented
 *     Rivalry". An older capture returned the pipe-joined `Title:` line instead.
 *   - `slideIndex` was specified as "position within its section (0-based)", so it is not
 *     unique across a deck. One capture had 27 notes carrying 3 distinct values.
 *
 * String similarity cannot be made reliable against a field the model rewrites. So nothing
 * here compares slide text. Notes bind by position, under two deterministic rules:
 *
 *   'index'    every note carries a valid, distinct, in-range global slide index -> use it
 *   'section'  otherwise, group notes by their declared section name and pair them with that
 *              section's content slides in order
 *
 * `sectionName` is the one identifier the model does echo exactly — it appears verbatim in
 * the reference as `Section N: "Hardware & Infrastructure"` and came back byte-identical in
 * both captures. Rule 'section' is what makes the corpus bind today; rule 'index' is what
 * the reference format now asks for and takes over once notes carry global indices.
 *
 * A note that resolves to no section, and a slide with no note, stay unbound. Guessing is
 * what produced "Index fallback — verify correct notes" badges on 20 of 50 slides.
 */

const norm = (s) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * @param {Array} noteSlides  speakerNotes.slides as returned by the model
 * @param {Array} flatSlides  flattenSlideDeck(sections).slides
 * @returns {{byIndex: Map<number, object>, method: string, bound: number,
 *            contentSlides: number, unusedNotes: number}}
 */
export function alignSpeakerNotes(noteSlides, flatSlides) {
  const notes = Array.isArray(noteSlides) ? noteSlides.filter(Boolean) : [];
  const slides = Array.isArray(flatSlides) ? flatSlides : [];
  const byIndex = new Map();

  const contentIndices = [];
  slides.forEach((slide, i) => {
    if (slide && slide.layout !== 'sectionTitle') contentIndices.push(i);
  });

  const empty = {
    byIndex, method: 'none', bound: 0,
    contentSlides: contentIndices.length, unusedNotes: notes.length,
  };
  if (!notes.length || !contentIndices.length) return empty;

  // Rule 'index': the model echoed the [slide N] token from the reference.
  const claimed = notes.map(n => n.slideIndex);
  const allValid = claimed.every(v => Number.isInteger(v) && contentIndices.includes(v));
  if (allValid && new Set(claimed).size === claimed.length) {
    notes.forEach((note, i) => byIndex.set(claimed[i], note));
    return {
      byIndex, method: 'index', bound: byIndex.size,
      contentSlides: contentIndices.length, unusedNotes: notes.length - byIndex.size,
    };
  }

  // Rule 'section': pair within each section, in emission order.
  const slidesBySection = new Map();
  for (const i of contentIndices) {
    const key = norm(slides[i]._sectionLabel);
    if (!slidesBySection.has(key)) slidesBySection.set(key, []);
    slidesBySection.get(key).push(i);
  }

  const cursor = new Map();
  let unused = 0;
  for (const note of notes) {
    const key = norm(note.sectionName);
    const bucket = slidesBySection.get(key);
    if (!bucket) { unused++; continue; }
    const at = cursor.get(key) ?? 0;
    if (at >= bucket.length) { unused++; continue; }
    cursor.set(key, at + 1);
    byIndex.set(bucket[at], note);
  }

  return {
    byIndex, method: byIndex.size ? 'section' : 'none', bound: byIndex.size,
    contentSlides: contentIndices.length, unusedNotes: unused,
  };
}
