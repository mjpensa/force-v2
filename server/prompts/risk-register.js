import { assembleResearchContent } from './common.js';

export const riskRegisterSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string", description: "Executive summary of overall risk landscape (2-3 sentences)" },
    riskAppetite: {
      type: "string",
      enum: ["aggressive", "moderate", "conservative"],
      description: "Recommended risk appetite based on research context"
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Risk ID (e.g., R-001)" },
          title: { type: "string" },
          description: { type: "string", description: "Detailed risk description" },
          category: {
            type: "string",
            enum: ["strategic", "operational", "financial", "regulatory", "technology", "market", "reputational"]
          },
          likelihood: { type: "number", description: "1-5 scale (1=rare, 5=almost certain)" },
          impact: { type: "number", description: "1-5 scale (1=negligible, 5=catastrophic)" },
          riskScore: { type: "number", description: "likelihood * impact (1-25)" },
          status: { type: "string", enum: ["open", "mitigating", "accepted", "closed"] },
          owner: { type: "string", nullable: true, description: "Suggested risk owner role" },
          mitigations: {
            type: "array",
            items: { type: "string" },
            description: "Mitigation strategies"
          },
          evidence: { type: "string", description: "Research evidence supporting this risk" },
          timeHorizon: { type: "string", enum: ["immediate", "short-term", "medium-term", "long-term"] },
          relatedRisks: {
            type: "array",
            items: { type: "string" },
            description: "IDs of related/dependent risks"
          }
        },
        required: ["id", "title", "description", "category", "likelihood", "impact", "riskScore", "status", "owner", "mitigations", "evidence", "timeHorizon", "relatedRisks"]
      }
    },
    categoryBreakdown: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          count: { type: "number" },
          avgScore: { type: "number" },
          topRisk: { type: "string", description: "ID of highest-scoring risk in category" }
        },
        required: ["category", "count", "avgScore", "topRisk"]
      }
    },
    keyInsights: {
      type: "array",
      items: { type: "string" },
      description: "3-5 key risk insights that cut across categories"
    }
  },
  required: ["title", "summary", "riskAppetite", "risks", "categoryBreakdown", "keyInsights"]
};

const riskRegisterPrompt = `You are a risk management specialist. Analyze the research to produce a comprehensive risk register.

You MUST respond with ONLY a valid JSON object matching the schema.

RULES:
1. Identify 8-15 distinct risks from the research content
2. Each risk MUST be grounded in specific evidence from the research — no generic risks
3. Use the 5x5 risk scoring matrix: likelihood (1-5) x impact (1-5) = riskScore (1-25)
   - Critical risks: score 15-25 (red zone)
   - High risks: score 10-14 (orange zone)
   - Medium risks: score 5-9 (yellow zone)
   - Low risks: score 1-4 (green zone)
4. For each risk, provide 2-4 specific mitigation strategies
5. Assign a time horizon: immediate (<1 month), short-term (1-6 months), medium-term (6-18 months), long-term (>18 months)
6. Identify risk dependencies — which risks compound or trigger others
7. Assign risk owners by role (e.g., "CTO", "Legal Counsel", "VP Operations")
8. Generate category breakdown with count, average score, and highest-scoring risk per category
9. Generate 3-5 key cross-category insights
10. Recommend overall risk appetite based on the landscape`;

export function generateRiskRegisterPrompt(userPrompt, researchFiles, precomputed = null) {
  const researchContent = precomputed?.researchContent || assembleResearchContent(researchFiles);
  const spineText = precomputed?.narrativeSpineText || '';

  return `${riskRegisterPrompt}

${spineText ? spineText + '\n' : ''}**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Respond with ONLY the JSON object.`;
}
