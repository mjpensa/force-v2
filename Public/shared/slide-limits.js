/**
 * Slide text limits — the single source for prompt, validator, viewer and PPTX exporter.
 *
 * These numbers used to exist in six places that disagreed:
 *
 *   prompt asked the model for     380-410 chars per paragraph
 *   validator accepted             300-450
 *   viewer twoColumn truncated at  320
 *   viewer threeColumn             280
 *   PPTX twoColumn                 205 per paragraph  (formatBody halves its 410 budget)
 *   PPTX threeColumn               390
 *
 * The model was asked for 380-410 characters that the tightest renderer cut at 205, so
 * roughly half of every two-column paragraph was generated, billed as output tokens, and
 * discarded before anyone read it — and the on-screen deck matched the exported deck in
 * neither direction.
 *
 * WHY THE LIMITS GO UP RATHER THAN THE ASK GOING DOWN
 *
 * The obvious fix is to ask the model for less. Checking the PPTX geometry first shows that
 * would be the wrong direction: the text boxes are roughly three times larger than the
 * truncation limits, so the boxes were never the constraint.
 *
 * From LAYOUTS in ppt-export-service-v2.js, on a 13.33 x 7.5in slide at 10.5pt Work Sans:
 *
 *   twoColumn body box    5.91 x 2.77in   ~1260 chars  (holds BOTH paragraphs)
 *   threeColumn column    2.64 x 3.52in   ~700 chars   (per column)
 *
 * Character capacity is estimated (~0.48em average advance, 1.25em line height) because the
 * font is not bundled and cannot be measured here. It does not need to be precise: it only
 * has to establish that 450 fits, and it does with roughly 40% headroom even under
 * pessimistic assumptions. Two 450-char paragraphs is ~900 against ~1260 available.
 *
 * So the rule is: NEVER TRUNCATE TEXT THE VALIDATOR ACCEPTS. Render limits equal
 * PARAGRAPH_MAX. Anything longer is a generation defect that validateSlideOutput reports,
 * not something to silently trim at render time.
 *
 * If a future layout change genuinely shrinks a box below this, lower PARAGRAPH_MAX here
 * and let the validator start reporting — do not reintroduce a render-only cap, which
 * discards content with no signal anywhere.
 */
export const SLIDE_LIMITS = Object.freeze({
  /** Max tagline length. Stated in the prompt, the schema description, and the validator. */
  TAGLINE_MAX: 21,

  /** Max newline-separated lines in a slide title. */
  TITLE_MAX_LINES: 4,

  /** Band the validator accepts without flagging a paragraph. */
  PARAGRAPH_MIN: 300,
  PARAGRAPH_MAX: 450,

  /** The narrower range the prompt asks for, quoted back in validator messages. */
  PARAGRAPH_TARGET_MIN: 380,
  PARAGRAPH_TARGET_MAX: 410,

  /**
   * Maximum content slides in a deck.
   *
   * Not a style preference — it is what keeps the downstream speaker-notes generation inside
   * the model's output ceiling. Notes cost roughly 1,212 output tokens per slide under the
   * current 7-field schema, so with a 6,000-token thinking budget against a 65,536 ceiling
   * about 42 slides fit. 30 leaves real headroom and matches what the slides prompt has
   * always claimed to target.
   *
   * A 50-slide deck is what produced notes for only 24 of its slides, silently.
   */
  DECK_MAX_SLIDES: 30,

  /**
   * Render-time truncation. Equal to PARAGRAPH_MAX by the rule above — these exist as named
   * constants so a call site reads as "render limit" rather than a bare number, and so a
   * future divergence has to be deliberate.
   */
  RENDER_TWO_COLUMN: 450,
  RENDER_THREE_COLUMN: 450,
});
