/**
 * Document Generation Prompt - MVP
 * Simplified for fast generation
 */

/**
 * Minimal Document Schema - Just title and sections with paragraphs
 */
export const documentSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Document title"
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: {
            type: "string",
            description: "Section heading"
          },
          paragraphs: {
            type: "array",
            items: { type: "string" },
            description: "Section paragraphs"
          }
        },
        required: ["heading", "paragraphs"]
      },
      description: "Document sections"
    }
  },
  required: ["title", "sections"]
};

/**
 * Minimal System Prompt - Direct and fast
 */
export const documentPrompt = `You are an expert analyst. Write a clear executive summary.

RULES:
- Use ONLY facts from the provided research
- Be concise and direct
- 4-6 sections maximum
- 2-4 paragraphs per section

OUTPUT: JSON with title and sections array. Each section has heading and paragraphs array.`;

/**
 * Generate prompt with research content
 */
export function generateDocumentPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  return `${documentPrompt}

REQUEST: ${userPrompt}

RESEARCH:
${researchContent}

Write the executive summary JSON now.`;
}
