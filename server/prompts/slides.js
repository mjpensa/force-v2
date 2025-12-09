/**
 * Slides Generation - MVP
 */

export const slidesSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          section: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
          columns: { type: "array", items: { type: "string" } },
          content: { type: "string" },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" }
              },
              required: ["title"]
            }
          }
        },
        required: ["type", "title"]
      }
    }
  },
  required: ["title", "slides"]
};

export function generateSlidesPrompt(userPrompt, researchFiles) {
  // Take only first 1500 chars from first file
  const source = researchFiles[0]?.content?.substring(0, 1500) || '';

  return `Create 6 slides as JSON.

Topic: ${userPrompt}

Slide types:
- textTwoColumn: {type,title,section,paragraphs:["p1","p2"]}
- textThreeColumn: {type,title,section,columns:["c1","c2","c3"]}
- textWithCards: {type,title,section,content,cards:[{title,content},...]}

Source: ${source}

Return: {"title":"...","slides":[...]}`;
}

export default { slidesSchema, generateSlidesPrompt };
