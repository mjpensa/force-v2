/**
 * Slide Schema - Two layouts supported:
 * - twoColumn: tagline + title (left), 2 paragraphs (right)
 * - threeColumn: tagline + title (left), 3 columns below
 */
export const slidesSchema = {
  description: "Presentation slides with layout options",
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Title of the presentation",
      nullable: false
    },
    slides: {
      type: "array",
      description: "Array of slides",
      items: {
        type: "object",
        properties: {
          layout: {
            type: "string",
            enum: ["twoColumn", "threeColumn"],
            description: "Slide layout: 'twoColumn' (2 paragraphs right) or 'threeColumn' (3 columns below)"
          },
          tagline: {
            type: "string",
            description: "2-word uppercase tagline, max 21 characters (e.g. 'EXECUTIVE SUMMARY')",
            nullable: false
          },
          title: {
            type: "string",
            description: "EXACTLY 4 lines separated by \\n. Format: 'Line1\\nLine2\\nLine3\\nLine4'. Each line max 10 chars. MUST have exactly 3 newline characters.",
            nullable: false
          },
          paragraph1: {
            type: "string",
            description: "First paragraph. 380-410 chars for twoColumn, 370-390 chars for threeColumn.",
            nullable: false
          },
          paragraph2: {
            type: "string",
            description: "Second paragraph. 380-410 chars for twoColumn, 370-390 chars for threeColumn.",
            nullable: false
          },
          paragraph3: {
            type: "string",
            description: "Third paragraph (threeColumn only). 370-390 characters.",
            nullable: true
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
 * AI automatically chooses the best layout (twoColumn or threeColumn) for each slide
 * @param {string} userPrompt - The user's request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @returns {string} Complete prompt for AI
 */
export function generateSlidesPrompt(userPrompt, researchFiles) {
  // Convert array to formatted string (consistent with other generators)
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `You are creating presentation slides with STRICT formatting requirements.

TWO LAYOUT OPTIONS - Choose the best layout for each slide:

LAYOUT 1: "twoColumn" (default) - Use for focused topics, executive summaries, key findings
- Fields: tagline, title, paragraph1, paragraph2
- paragraph1 and paragraph2: EXACTLY 380-410 characters each
- Omit the "layout" field (defaults to twoColumn)

LAYOUT 2: "threeColumn" - Use for comparisons, multiple related points, detailed breakdowns
- Fields: layout, tagline, title, paragraph1, paragraph2, paragraph3
- MUST include: layout: "threeColumn"
- paragraph1, paragraph2, paragraph3: EXACTLY 370-390 characters each

WHEN TO USE EACH LAYOUT:
- twoColumn: Introduction, conclusion, single-topic deep dives, executive summaries
- threeColumn: Comparing options, listing multiple benefits/features, process steps, before/during/after

COMMON RULES FOR ALL SLIDES:

TAGLINE: 2-word uppercase label, MAX 21 characters. Example: "EXECUTIVE SUMMARY"

TITLE RULES (CRITICAL - MUST BE EXACTLY 4 LINES):
- Pattern: "Line1\\nLine2\\nLine3\\nLine4" - exactly 3 newlines, 4 lines
- Each line: 1-2 words, MAX 10 characters per line
- AVOID letters g, y, p, q, j on lines 1-3 (descenders overlap next line)
- Line 4 can use any letters
- Example: "Driving\\nModern\\nBusiness\\nForward"

PARAGRAPH REQUIREMENTS (CRITICAL):
- Each paragraph must be a complete thought ending with a period
- Count characters carefully before finalizing each paragraph
- twoColumn paragraphs: 380-410 characters each
- threeColumn paragraphs: 370-390 characters each

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

Generate JSON with "title" (string) and "slides" array. Mix layouts as appropriate:
- twoColumn slide: {tagline, title, paragraph1, paragraph2}
- threeColumn slide: {layout: "threeColumn", tagline, title, paragraph1, paragraph2, paragraph3}
`;
}
