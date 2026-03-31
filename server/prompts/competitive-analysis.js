import { assembleResearchContent } from './common.js';

export const competitiveAnalysisSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    marketOverview: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-3 sentence market landscape summary" },
        marketSize: { type: "string", nullable: true, description: "Market size if mentioned in research" },
        growthRate: { type: "string", nullable: true, description: "Market growth rate if available" },
        keyTrends: { type: "array", items: { type: "string" } }
      },
      required: ["summary", "marketSize", "growthRate", "keyTrends"]
    },
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", description: "1-2 sentence company/entity description" },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
          marketPosition: { type: "string", enum: ["leader", "challenger", "follower", "niche"] },
          differentiator: { type: "string", description: "Key competitive differentiator" },
          threatLevel: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["name", "description", "strengths", "weaknesses", "marketPosition", "differentiator", "threatLevel"]
      }
    },
    comparisonDimensions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dimension: { type: "string", description: "e.g., Technology, Pricing, Market Share" },
          rankings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                competitor: { type: "string" },
                score: { type: "number", description: "1-5 rating" },
                note: { type: "string" }
              },
              required: ["competitor", "score", "note"]
            }
          }
        },
        required: ["dimension", "rankings"]
      },
      description: "3-6 key dimensions for comparing competitors"
    },
    competitiveAdvantages: {
      type: "array",
      items: { type: "string" },
      description: "Key competitive advantages identified for the subject entity"
    },
    strategicRecommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recommendation: { type: "string" },
          rationale: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["recommendation", "rationale", "priority"]
      }
    }
  },
  required: ["title", "marketOverview", "competitors", "comparisonDimensions", "competitiveAdvantages", "strategicRecommendations"]
};

const competitiveAnalysisPrompt = `You are a competitive intelligence analyst. Analyze the research to produce a structured competitive landscape analysis.

You MUST respond with ONLY a valid JSON object matching the schema.

RULES:
1. Identify ALL competitors/entities mentioned in the research (minimum 3, maximum 8)
2. For each competitor, extract strengths and weaknesses grounded in research evidence
3. Classify market position: leader (dominant share), challenger (strong #2-3), follower (smaller player), niche (specialized segment)
4. Create 3-6 comparison dimensions relevant to the industry/topic
5. Score each competitor 1-5 on each dimension with a brief justification note
6. Extract competitive advantages for the primary subject
7. Generate 3-5 strategic recommendations with clear rationale
8. Include market overview with size/growth data if available in research
9. Be specific — cite data points, percentages, and timeframes from the research
10. If the research doesn't clearly identify competitors, identify key players, approaches, or solutions as the entities to compare`;

export function generateCompetitiveAnalysisPrompt(userPrompt, researchFiles, precomputed = null) {
  const researchContent = precomputed?.researchContent || assembleResearchContent(researchFiles);
  const spineText = precomputed?.narrativeSpineText || '';

  return `${competitiveAnalysisPrompt}

${spineText ? spineText + '\n' : ''}**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Respond with ONLY the JSON object.`;
}
