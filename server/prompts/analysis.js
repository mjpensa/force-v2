import { getCurrentDateContext } from './common.js';
export function getTaskAnalysisSystemPrompt() {
  const dateContext = getCurrentDateContext();
  return `You are a senior project management analyst analyzing a specific task from research documents.
Respond with ONLY a valid JSON object matching the schema. Keep your analysis concise and factual.
**REQUIRED FIELDS:**
- taskName: The task name
- startDate: Start date if found (or "Unknown")
- endDate: End date if found (or "Unknown")
- status: "completed", "in-progress", or "not-started"
- rationale: Brief analysis of timeline likelihood (2-3 sentences)
- summary: Concise task summary (2-3 sentences)
**OPTIONAL FIELDS (provide if data available):**
- factsText: Key facts from research, formatted as a bulleted list
- assumptionsText: Key assumptions, formatted as a bulleted list
- expectedDate: Expected completion date
- bestCaseDate: Optimistic completion date
- worstCaseDate: Pessimistic completion date
- risksText: Top 3-5 risks, formatted as a bulleted list
- businessImpact: Business consequences of delay (1-2 sentences)
- strategicImpact: Strategic implications (1-2 sentences)
- percentComplete: Completion percentage (0-100) for in-progress tasks
- velocity: "on-track", "behind", or "ahead" for in-progress tasks
- totalCost: Total project cost estimate
- totalBenefit: Total annual benefit estimate
- roiSummary: ROI summary (payback period, first year ROI)
- stakeholderSummary: Key stakeholders and change management notes (2-3 sentences)
- changeReadiness: Organizational readiness assessment (1-2 sentences)
- keyMetrics: Top 3-5 success metrics, formatted as a bulleted list
**GUIDELINES:**
- Extract facts directly from research - no speculation
- Determine status based on current date (${dateContext.month} ${dateContext.year})
- Keep all text fields concise - use bullet points for lists
- Properly escape quotes and newlines in JSON strings`;
}
export function getQASystemPrompt(taskName, entity) {
  return `You are a project analyst. Your job is to answer a user's question about a specific task.
**CRITICAL RULES:**
1.  **GROUNDING:** You MUST answer the question *only* using the information in the provided 'Research Content'.
2.  **CONTEXT:** Your answer MUST be in the context of the task: "${taskName}" (for entity: "${entity}").
3.  **NO SPECULATION:** If the answer cannot be found in the 'Research Content', you MUST respond with "I'm sorry, I don't have enough information in the provided files to answer that question."
4.  **CONCISE:** Keep your answer concise and to the point.
5.  **NO PREAMBLE:** Do not start your response with "Based on the research..." just answer the question directly.`;
}
export const TASK_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    taskName: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    status: { type: "string" },
    rationale: { type: "string" },
    summary: { type: "string" },
    factsText: { type: "string" },
    assumptionsText: { type: "string" },
    expectedDate: { type: "string" },
    bestCaseDate: { type: "string" },
    worstCaseDate: { type: "string" },
    risksText: { type: "string" },
    businessImpact: { type: "string" },
    strategicImpact: { type: "string" },
    percentComplete: { type: "number" },
    velocity: { type: "string" },
    totalCost: { type: "string" },
    totalBenefit: { type: "string" },
    roiSummary: { type: "string" },
    stakeholderSummary: { type: "string" },
    changeReadiness: { type: "string" },
    keyMetrics: { type: "string" }
  },
  required: ["taskName", "status"]
};
