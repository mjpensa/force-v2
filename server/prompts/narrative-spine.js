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
- analyticalFramework: Choose the best lens for this research. Options: SECOND_ORDER_EFFECTS, CONTRARIAN, COMPETITIVE_DYNAMICS, TEMPORAL_ARBITRAGE, RISK_ASYMMETRY.`;

export function generateNarrativeSpinePrompt(userPrompt, researchFiles, precomputed = null) {
  const researchContent = precomputed?.researchContent || assembleResearchContent(researchFiles);

  return `${narrativeSpinePrompt}

**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}`;
}

/**
 * Render the narrative spine for injection into every downstream prompt.
 *
 * Every field here is optional at runtime despite narrativeSpineSchema marking them
 * required. Captured production responses omit `evidence`, `stake`, `tensionPair`,
 * `analyticalFramework`, and `recommendedAction` — both captures, four months apart, and
 * confirmed by tests/server/golden-conformance.test.js. Gemini's responseSchema does not
 * enforce `required`.
 *
 * Before this guard, the template interpolated those absent fields directly and emitted the
 * literal string "undefined" six times per run — including
 * `Central tension: "undefined" vs "undefined"` — under a header telling the model the text
 * was AUTHORITATIVE and to align all content to it. Every slide, document, SWOT and risk
 * register generated since has been steered by that.
 *
 * A missing field now drops its line entirely: partial guidance is useful, guidance that
 * says "undefined" is worse than silence. Restoring the fields themselves is a prompt fix,
 * scheduled for Phase 4.
 */
export function formatNarrativeSpine(spine) {
  if (!spine) return '';

  const lines = ['**NARRATIVE SPINE (AUTHORITATIVE — align all content to this):**'];

  if (spine.coreThesis) lines.push(`Core thesis: "${spine.coreThesis}"`);

  const claims = (spine.keyClaims ?? [])
    .filter(c => c?.claim)
    .map((c, i) => {
      const parts = [`${i + 1}. ${c.claim}`];
      if (c.evidence) parts.push(`[Evidence: ${c.evidence}]`);
      if (c.stake) parts.push(`[Stake: ${c.stake}]`);
      return parts.join(' ');
    });
  if (claims.length) lines.push('Key claims:', ...claims);

  if (spine.tensionPair?.force1 && spine.tensionPair?.force2) {
    lines.push(`Central tension: "${spine.tensionPair.force1}" vs "${spine.tensionPair.force2}"`);
  }
  if (spine.analyticalFramework) lines.push(`Analytical framework: ${spine.analyticalFramework}`);
  if (spine.recommendedAction) lines.push(`Recommended action: "${spine.recommendedAction}"`);

  // Only the header survived — nothing to align to, so send nothing rather than an empty
  // directive that still consumes prompt budget and implies guidance that isn't there.
  if (lines.length === 1) return '';

  return lines.join('\n');
}
