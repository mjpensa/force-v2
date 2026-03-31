import { assembleResearchContent } from './common.js';

export const swotAnalysisSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Title for the SWOT analysis" },
    subject: { type: "string", description: "The entity or initiative being analyzed" },
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string", description: "The strength" },
          evidence: { type: "string", description: "Supporting evidence from research" },
          impact: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["point", "evidence", "impact"]
      }
    },
    weaknesses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string", description: "The weakness" },
          evidence: { type: "string", description: "Supporting evidence from research" },
          impact: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["point", "evidence", "impact"]
      }
    },
    opportunities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string", description: "The opportunity" },
          evidence: { type: "string", description: "Supporting evidence from research" },
          timeframe: { type: "string", description: "When this opportunity is actionable" },
          impact: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["point", "evidence", "timeframe", "impact"]
      }
    },
    threats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string", description: "The threat" },
          evidence: { type: "string", description: "Supporting evidence from research" },
          likelihood: { type: "string", enum: ["high", "medium", "low"] },
          impact: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["point", "evidence", "likelihood", "impact"]
      }
    },
    strategicImplications: {
      type: "array",
      items: { type: "string" },
      description: "3-5 strategic implications derived from the SWOT matrix"
    },
    priorityActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          rationale: { type: "string" },
          quadrant: { type: "string", enum: ["strength-opportunity", "strength-threat", "weakness-opportunity", "weakness-threat"] }
        },
        required: ["action", "rationale", "quadrant"]
      },
      description: "Priority actions from cross-quadrant analysis (SO, ST, WO, WT strategies)"
    }
  },
  required: ["title", "subject", "strengths", "weaknesses", "opportunities", "threats", "strategicImplications", "priorityActions"]
};

const swotPrompt = `You are a senior strategy analyst. Analyze the research to produce a comprehensive SWOT analysis.

You MUST respond with ONLY a valid JSON object matching the schema.

RULES:
1. Extract 4-8 items per quadrant (Strengths, Weaknesses, Opportunities, Threats)
2. Every item MUST have evidence grounded in the research — no speculation
3. Rate each item's impact (high/medium/low). For threats, also rate likelihood
4. Opportunities must include a timeframe for when they are actionable
5. Generate 3-5 strategic implications that synthesize cross-quadrant insights
6. Generate 4-6 priority actions using TOWS matrix logic:
   - SO strategies: Use strengths to capture opportunities
   - ST strategies: Use strengths to mitigate threats
   - WO strategies: Address weaknesses to unlock opportunities
   - WT strategies: Address weaknesses to reduce threat exposure
7. Be specific and quantitative where the research supports it
8. The subject should be clearly identified from the user prompt and research context`;

export function generateSwotAnalysisPrompt(userPrompt, researchFiles, precomputed = null) {
  const researchContent = precomputed?.researchContent || assembleResearchContent(researchFiles);
  const spineText = precomputed?.narrativeSpineText || '';

  return `${swotPrompt}

${spineText ? spineText + '\n' : ''}**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Respond with ONLY the JSON object.`;
}
