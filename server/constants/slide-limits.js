/**
 * Slide text limits.
 *
 * These numbers currently exist in at least six places that disagree with each other. This
 * module is the beginning of collapsing them into one; right now it holds exactly what
 * validateSlideOutput enforced before extraction, so this file introduces no behavior
 * change on its own.
 *
 * The disagreement, for whoever finishes the unification:
 *
 *   prompt asks the model for      380-410 chars per paragraph  (server/prompts/slides.js)
 *   validator accepts              300-450                      (this file, below)
 *   viewer twoColumn truncates at  320                          (SlidesView.js:199-202)
 *   viewer threeColumn             280                          (SlidesView.js:264-266)
 *   PPTX twoColumn                 205 per paragraph            (formatBody halves 410)
 *   PPTX threeColumn               390                          (ppt-export-service-v2.js:523)
 *
 * So the model is asked to write 380-410 characters that the tightest renderer cuts at 205.
 * Roughly half of every two-column paragraph is generated, paid for in output tokens, and
 * thrown away before anyone reads it — and the on-screen deck does not match the exported
 * one in either direction.
 *
 * Resolving it means deriving the real limits from the PPTX text-box geometry at the
 * configured font size, setting the render constants from that, and then setting the
 * prompt's stated target from the same source — not the other way around. Until that
 * happens, do not "fix" the mismatch by loosening one number to match another.
 */
export const SLIDE_LIMITS = Object.freeze({
  /** Max tagline length. Stated in the prompt, the schema description, and the validator. */
  TAGLINE_MAX: 21,

  /** Max newline-separated lines in a slide title. */
  TITLE_MAX_LINES: 4,

  /** Band the validator will accept without flagging a paragraph. */
  PARAGRAPH_MIN: 300,
  PARAGRAPH_MAX: 450,

  /** The narrower range the prompt actually asks for, quoted back in validator messages. */
  PARAGRAPH_TARGET_MIN: 380,
  PARAGRAPH_TARGET_MAX: 410,
});
