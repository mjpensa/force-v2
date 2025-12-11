/**
 * Single Template Slide Schema
 * Every slide uses the SAME layout: tagline + title (left), body (right)
 * No variations. No options. No grid. No bullets. No layouts.
 */
export const slidesSchema = {
  description: "Presentation slides - single two-column template only",
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Title of the presentation",
      nullable: false
    },
    slides: {
      type: "array",
      description: "Array of slides - all use identical two-column layout",
      items: {
        type: "object",
        properties: {
          tagline: {
            type: "string",
            description: "2-word uppercase tagline, max 21 characters (e.g. 'EXECUTIVE SUMMARY')",
            nullable: false
          },
          title: {
            type: "string",
            description: "4-line title, each line max 10 chars, separated by newlines",
            nullable: false
          },
          paragraph1: {
            type: "string",
            description: "First body paragraph. MUST be 380-410 characters including spaces. Complete sentences only.",
            nullable: false
          },
          paragraph2: {
            type: "string",
            description: "Second body paragraph. MUST be 380-410 characters including spaces. Complete sentences only.",
            nullable: false
          }
        },
        required: ["tagline", "title", "paragraph1", "paragraph2"]
      }
    }
  },
  required: ["title", "slides"]
};

/**
 * Generate prompt for slides with research content
 * @param {string} userPrompt - The user's request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @returns {string} Complete prompt for AI
 */
export function generateSlidesPrompt(userPrompt, researchFiles) {
  // Convert array to formatted string (consistent with other generators)
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `You are creating presentation slides with STRICT character limits.

SLIDE STRUCTURE - Each slide has exactly 4 fields:
- tagline: 2-word uppercase label, MAX 21 characters. Example: "EXECUTIVE SUMMARY"
- title: 4 lines separated by \\n, each line MAX 10 characters
- paragraph1: First body paragraph, EXACTLY 380-410 characters including spaces
- paragraph2: Second body paragraph, EXACTLY 380-410 characters including spaces

PARAGRAPH REQUIREMENTS (CRITICAL):
- paragraph1 and paragraph2 are SEPARATE fields, not combined
- Each paragraph MUST be 380-410 characters (including spaces) - NO EXCEPTIONS
- Each paragraph must be a complete thought ending with a period
- Count characters carefully before finalizing each paragraph

TITLE RULES:
- 4 lines separated by \\n
- Each line MAX 10 characters
- AVOID letters g, y, p, q, j on lines 1-3 (they have descenders that overlap)
- Line 4 can use any letters

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

Generate JSON with "title" (string) and "slides" array. Each slide: {tagline, title, paragraph1, paragraph2}.
`;
}
