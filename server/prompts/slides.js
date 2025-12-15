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
 * @param {string} userPrompt - The user's request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @param {string} layout - 'twoColumn' (default) or 'threeColumn'
 * @returns {string} Complete prompt for AI
 */
export function generateSlidesPrompt(userPrompt, researchFiles, layout = 'twoColumn') {
  // Convert array to formatted string (consistent with other generators)
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  const isTwoColumn = layout !== 'threeColumn';

  const paragraphRules = isTwoColumn
    ? `PARAGRAPH REQUIREMENTS (CRITICAL):
- paragraph1 and paragraph2 are SEPARATE fields, not combined
- Each paragraph MUST be 380-410 characters (including spaces) - NO EXCEPTIONS
- Each paragraph must be a complete thought ending with a period
- Count characters carefully before finalizing each paragraph`
    : `PARAGRAPH REQUIREMENTS (CRITICAL):
- paragraph1, paragraph2, and paragraph3 are SEPARATE fields (3 columns)
- Each paragraph MUST be 370-390 characters (including spaces) - NO EXCEPTIONS
- Each paragraph must be a complete thought ending with a period
- Count characters carefully before finalizing each paragraph`;

  const slideStructure = isTwoColumn
    ? `SLIDE STRUCTURE - Each slide has exactly 4 fields:
- tagline: 2-word uppercase label, MAX 21 characters. Example: "EXECUTIVE SUMMARY"
- title: EXACTLY 4 lines separated by \\n (see TITLE RULES below)
- paragraph1: First body paragraph, EXACTLY 380-410 characters including spaces
- paragraph2: Second body paragraph, EXACTLY 380-410 characters including spaces`
    : `SLIDE STRUCTURE - Each slide has exactly 5 fields:
- tagline: 2-word uppercase label, MAX 21 characters. Example: "EXECUTIVE SUMMARY"
- title: EXACTLY 4 lines separated by \\n (see TITLE RULES below)
- paragraph1: Column 1 text, EXACTLY 370-390 characters including spaces
- paragraph2: Column 2 text, EXACTLY 370-390 characters including spaces
- paragraph3: Column 3 text, EXACTLY 370-390 characters including spaces`;

  const outputFormat = isTwoColumn
    ? `Generate JSON with "title" (string) and "slides" array. Each slide: {tagline, title, paragraph1, paragraph2}.`
    : `Generate JSON with "title" (string) and "slides" array. Each slide: {layout: "threeColumn", tagline, title, paragraph1, paragraph2, paragraph3}.`;

  return `You are creating presentation slides with STRICT formatting requirements.

${slideStructure}

${paragraphRules}

TITLE RULES (CRITICAL - MUST BE EXACTLY 4 LINES):
- The title MUST contain EXACTLY 4 lines separated by \\n characters
- Pattern: "Line1\\nLine2\\nLine3\\nLine4" - exactly 3 newlines, 4 lines
- Each line should be 1-2 words, MAX 10 characters per line
- Line 1: 1 word
- Line 2: 1-2 words
- Line 3: 1-2 words
- Line 4: 1 word
- AVOID letters g, y, p, q, j on lines 1-3 (descenders overlap next line)
- Line 4 can use any letters
- Example: "Driving\\nModern\\nBusiness\\nForward"

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

${outputFormat}
`;
}
