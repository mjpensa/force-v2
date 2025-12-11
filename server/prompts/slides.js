import { SchemaType } from '@google/generative-ai';

/**
 * Single Template Slide Schema
 * Every slide uses the SAME layout: tagline + title (left), body (right)
 * No variations. No options. No grid. No bullets. No layouts.
 */
export const slidesSchema = {
  description: "Presentation slides - single two-column template only",
  type: SchemaType.OBJECT,
  properties: {
    title: {
      type: SchemaType.STRING,
      description: "Title of the presentation",
      nullable: false
    },
    slides: {
      type: SchemaType.ARRAY,
      description: "Array of slides - all use identical two-column layout",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          tagline: {
            type: SchemaType.STRING,
            description: "Small uppercase tagline in red (top-left, e.g. 'EXECUTIVE SUMMARY')",
            nullable: false
          },
          title: {
            type: SchemaType.STRING,
            description: "Large title text (left column, thin font weight)",
            nullable: false
          },
          body: {
            type: SchemaType.STRING,
            description: "Body paragraphs (right column). Use newlines to separate paragraphs.",
            nullable: false
          }
        },
        required: ["tagline", "title", "body"]
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

  return `You are creating presentation slides. Every slide MUST use this EXACT layout:
- LEFT SIDE: Small red uppercase tagline + Large navy title (thin font)
- RIGHT SIDE: Body text paragraphs

Each slide object must have exactly three fields:
- tagline: Short uppercase label - MUST be EXACTLY 2 words with a MAXIMUM of 21 characters total (including the space). Example: "EXECUTIVE SUMMARY" (17 chars), "KEY FINDINGS" (12 chars)
- title: Multi-line title text that can wrap (this is the main headline)
- body: EXACTLY 2 paragraphs of body text. Separate paragraphs with a blank line (\\n\\n).

BODY PARAGRAPH FORMAT REQUIREMENT:
- The body MUST contain EXACTLY 2 paragraphs separated by a double newline (\\n\\n)
- Each paragraph MUST be between 150-250 characters (roughly 25-40 words)
- This ensures the text fits properly in the slide layout
- Focus on the most impactful insights, not comprehensive coverage

CRITICAL TITLE TYPOGRAPHY RULES:
The slide title uses very tight line spacing (70% line-height) and sentence case. To prevent letter overlap, you MUST:

**AVOID these letters in title words: g, y, p, q, j**
These letters have descenders that hang below the baseline and will overlap with the next line.

Instead of words containing g, y, p, q, j, use synonyms:
- "Leading" -> "Driving", "Pioneering" -> "First in", "Strategy" -> "Plan", "Approach"
- "Technology" -> "Tech", "Innovation" -> "New Ideas", "Digital" -> "Modern"
- "Growing" -> "Expanding", "Building" -> "Creating", "Developing" -> "Advancing"
- "Company" -> "Firm", "Organization" -> "Enterprise"
- "Quality" -> "Excellence", "Efficiency" -> "Performance"
- "Supply" -> "Source", "Delivery" -> "Distribution"

EXCEPTION: The LAST LINE (line 4) of the title may contain these letters since there's no line below it.

Example rewrites:
- "Leading Through Digital Transformation" -> "Driving Modern Transformation"
- "Building Strong Partnerships" -> "Creating Enduring Alliances"
- "Technology Strategy" -> "Tech Roadmap"

TITLE FORMAT REQUIREMENT:
- Each title MUST be EXACTLY 4 lines separated by newline characters (\\n)
- Each line MUST NOT EXCEED 10 characters (including spaces)
- The TOTAL character count across ALL 4 lines MUST NOT EXCEED 40 characters (including spaces, excluding newlines)
- Example: "Driving\\nModern\\nBusiness\\nForward" = 7+6+8+7 = 28 chars, each line <=10
- Example: "Transformation\\nIdeas" = 14 chars on line 1 (exceeds 10 per line)
- COUNT CAREFULLY: Each line <=10 chars AND total <=40 chars

USER REQUEST: "${userPrompt}"

RESEARCH CONTENT:
${researchContent}

Generate JSON with "title" and "slides" array. Every slide must have tagline, title, body.
`;
}
