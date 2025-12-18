/**
 * Pre-Meeting Intelligence Brief
 * Synthesizes session research and analysis into a concise meeting prep document
 */

/**
 * Intelligence Brief Schema
 * Designed for one-page output focused on meeting preparation
 */
export const intelligenceBriefSchema = {
  type: "object",
  properties: {
    meetingContext: {
      type: "object",
      properties: {
        objective: { type: "string", description: "What we aim to achieve" },
        attendees: { type: "string", description: "Who will be in the room" },
        duration: { type: "string", description: "Suggested meeting duration" }
      },
      required: ["objective", "attendees"]
    },
    keyInsights: {
      type: "array",
      items: { type: "string" },
      description: "3-4 most important insights from the analysis to communicate"
    },
    talkingPoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string", description: "The key point to make" },
          supporting: { type: "string", description: "Evidence or data supporting this point" }
        },
        required: ["point"]
      },
      description: "4-6 structured talking points with supporting evidence"
    },
    anticipatedQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          suggestedResponse: { type: "string" }
        },
        required: ["question", "suggestedResponse"]
      },
      description: "3-4 questions the client may ask and how to respond"
    },
    roadmapHighlights: {
      type: "array",
      items: { type: "string" },
      description: "2-3 key phases or milestones from the roadmap to emphasize"
    },
    recommendedNextSteps: {
      type: "array",
      items: { type: "string" },
      description: "2-3 concrete next steps to propose at end of meeting"
    },
    cautionAreas: {
      type: "array",
      items: { type: "string" },
      description: "1-2 sensitive topics or areas to handle carefully"
    }
  },
  required: ["keyInsights", "talkingPoints", "anticipatedQuestions", "recommendedNextSteps"]
};

/**
 * System prompt for intelligence brief generation
 */
export const INTELLIGENCE_BRIEF_SYSTEM_PROMPT = `You are a senior management consultant preparing a pre-meeting intelligence brief. Your role is to synthesize research and analysis into actionable meeting preparation.

## Your Task
Create a one-page meeting brief that helps the presenter walk into the meeting fully prepared. The brief synthesizes:
1. The original research/source documents
2. The strategic roadmap analysis
3. The slide deck messaging
4. The executive document analysis

## Content Guidelines

### Key Insights (3-4)
- The most critical findings that must be communicated
- Prioritize insights that align with the meeting objective
- Each insight should be a complete, standalone statement

### Talking Points (4-6)
- Structured points with supporting evidence
- Pull specific data, quotes, or findings from the research
- Order by importance or logical flow

### Anticipated Questions
- What will the client likely ask?
- Prepare concise, confident responses
- Reference specific analysis when possible

### Roadmap Highlights
- Which phases or milestones are most relevant to this meeting?
- Connect roadmap items to client priorities

### Recommended Next Steps
- Concrete, actionable proposals
- Include ownership and timing suggestions

### Caution Areas
- Sensitive topics to handle carefully
- Potential objections to anticipate

## Tone
- Confident and well-prepared
- Consultant speaking to consultant
- Direct and actionable`;

/**
 * Generate the full prompt with session data context
 * @param {Object} sessionData - Contains sources, document, roadmap, slides
 * @param {Object} meetingContext - Contains meetingAttendees, meetingObjective, keyConcerns
 * @returns {string} Complete prompt for Gemini
 */
export function generateIntelligenceBriefPrompt(sessionData, meetingContext) {
  const { meetingAttendees, meetingObjective, keyConcerns } = meetingContext;

  // Build context from session data
  let sessionContext = '## Session Analysis Data\n\n';

  // Source research
  if (sessionData.sources?.length > 0) {
    sessionContext += '### Source Research\n';
    sessionData.sources.forEach((source, i) => {
      sessionContext += `${i + 1}. ${source.title || source.url || 'Document ' + (i + 1)}\n`;
      if (source.summary) sessionContext += `   Summary: ${source.summary}\n`;
      if (source.content) {
        // Include first 500 chars of content for context
        const preview = source.content.substring(0, 500).replace(/\n/g, ' ');
        sessionContext += `   Preview: ${preview}...\n`;
      }
    });
    sessionContext += '\n';
  }

  // Document/Executive summary
  if (sessionData.document) {
    sessionContext += '### Executive Analysis\n';
    if (sessionData.document.title) {
      sessionContext += `Title: ${sessionData.document.title}\n`;
    }
    if (sessionData.document.executiveSummary) {
      const es = sessionData.document.executiveSummary;
      if (es.situation || es.stakes) {
        sessionContext += `- Situation: ${es.situation || es.stakes}\n`;
      }
      if (es.insight || es.keyFinding) {
        sessionContext += `- Key Insight: ${es.insight || es.keyFinding}\n`;
      }
      if (es.action || es.recommendation) {
        sessionContext += `- Recommended Action: ${es.action || es.recommendation}\n`;
      }
    }
    if (sessionData.document.analysisOverview?.narrative) {
      sessionContext += `- Narrative: ${sessionData.document.analysisOverview.narrative.substring(0, 300)}...\n`;
    }
    if (sessionData.document.analysisOverview?.criticalFindings?.length > 0) {
      sessionContext += '- Critical Findings:\n';
      sessionData.document.analysisOverview.criticalFindings.forEach(f => {
        sessionContext += `  * ${f}\n`;
      });
    }
    if (sessionData.document.sections?.length > 0) {
      sessionContext += '- Section Topics:\n';
      sessionData.document.sections.slice(0, 5).forEach(s => {
        sessionContext += `  * ${s.swimlaneTopic || s.heading}: ${s.keyInsight || ''}\n`;
      });
    }
    sessionContext += '\n';
  }

  // Roadmap
  if (sessionData.roadmap?.phases?.length > 0) {
    sessionContext += '### Strategic Roadmap\n';
    sessionData.roadmap.phases.forEach(phase => {
      sessionContext += `- **${phase.name}** (${phase.timeframe || 'TBD'}): ${phase.description || ''}\n`;
      if (phase.milestones?.length > 0) {
        phase.milestones.slice(0, 3).forEach(m => {
          sessionContext += `  * ${m.title || m.name || m}\n`;
        });
      }
    });
    sessionContext += '\n';
  }

  // Slides
  if (sessionData.slides?.slides?.length > 0) {
    sessionContext += '### Slide Deck Messaging\n';
    sessionData.slides.slides.slice(0, 8).forEach((slide, i) => {
      sessionContext += `${i + 1}. **${slide.title}**: ${slide.keyMessage || slide.narrative || ''}\n`;
      if (slide.bullets?.length > 0) {
        slide.bullets.slice(0, 3).forEach(b => {
          sessionContext += `   - ${typeof b === 'string' ? b : b.text || b.point || ''}\n`;
        });
      }
    });
    sessionContext += '\n';
  }

  return `${INTELLIGENCE_BRIEF_SYSTEM_PROMPT}

## Meeting Details
- **Attendees**: ${meetingAttendees}
- **Objective**: ${meetingObjective}
${keyConcerns ? `- **Key Concerns to Address**: ${keyConcerns}` : ''}

${sessionContext}

Generate a concise, one-page intelligence brief optimized for this specific meeting. Focus on the insights and talking points most relevant to the stated objective and attendees. Pull specific data and evidence from the session analysis above.`;
}

export default {
  intelligenceBriefSchema,
  INTELLIGENCE_BRIEF_SYSTEM_PROMPT,
  generateIntelligenceBriefPrompt
};
