import { assembleResearchContent, extractKeyStats } from './common.js';

export const narrativeSpineSchema = {
  type: "object",
  properties: {
    coreThesis: {
      type: "string",
      description: "One sentence: the single most important claim this research supports. All views must align to this."
    },
    keyClaims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string", description: "A specific, falsifiable assertion" },
          evidence: { type: "string", description: "The data point that supports it, with source" },
          stake: { type: "string", description: "What is at risk if this claim is ignored (quantified)" }
        },
        required: ["claim", "evidence", "stake"]
      },
      description: "The 3-5 pillars of the argument. Every view must reference at least 3 of these."
    },
    tensionPair: {
      type: "object",
      properties: {
        force1: { type: "string", description: "The driving force (e.g., competitor adoption)" },
        force2: { type: "string", description: "The resisting force (e.g., implementation cost)" }
      },
      required: ["force1", "force2"],
      description: "The central tension that creates urgency"
    },
    recommendedAction: {
      type: "string",
      description: "The single action all views should converge toward. Format: [Role] [verb] [object] by [date]"
    },
    analyticalFramework: {
      type: "string",
      enum: ["SECOND_ORDER_EFFECTS", "CONTRARIAN", "COMPETITIVE_DYNAMICS", "TEMPORAL_ARBITRAGE", "RISK_ASYMMETRY"],
      description: "The dominant analytical lens for the slides."
    }
  },
  required: ["coreThesis", "keyClaims", "tensionPair", "recommendedAction", "analyticalFramework"]
};

const narrativeSpinePrompt = `You are a senior strategy analyst. Analyze the research below and extract the narrative spine — the core argument that should drive ALL deliverables (roadmap, slides, document).

This spine will be injected into every downstream prompt as an authoritative anchor. Be precise and evidence-based.

RULES:
- coreThesis: One sentence that changes how the reader should act. Not a summary.
- keyClaims: 3-5 specific claims with concrete evidence and quantified stakes. These are the pillars.
- tensionPair: The central conflict that creates urgency (e.g., "competitive pressure" vs "resource constraints").
- recommendedAction: Format as "[Role] [verb] [object] by [date]". Be specific.
- analyticalFramework: Choose the best lens for this research. Options: SECOND_ORDER_EFFECTS, CONTRARIAN, COMPETITIVE_DYNAMICS, TEMPORAL_ARBITRAGE, RISK_ASYMMETRY.

Respond with ONLY a valid JSON object matching the schema.`;

export function generateNarrativeSpinePrompt(userPrompt, researchFiles, precomputed = null) {
  const researchContent = precomputed?.researchContent || assembleResearchContent(researchFiles);

  return `${narrativeSpinePrompt}

**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Respond with ONLY the JSON object.`;
}

export function formatNarrativeSpine(spine) {
  if (!spine) return '';
  const claims = spine.keyClaims?.map((c, i) => `${i + 1}. ${c.claim} [Evidence: ${c.evidence}] [Stake: ${c.stake}]`).join('\n') || '';
  return `**NARRATIVE SPINE (AUTHORITATIVE — align all content to this):**
Core thesis: "${spine.coreThesis}"
Key claims:
${claims}
Central tension: "${spine.tensionPair?.force1}" vs "${spine.tensionPair?.force2}"
Analytical framework: ${spine.analyticalFramework}
Recommended action: "${spine.recommendedAction}"`;
}
