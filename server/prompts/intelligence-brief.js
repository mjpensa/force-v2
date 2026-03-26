export const intelligenceBriefSchema = {
  type: "object",
  properties: {
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

const INTELLIGENCE_BRIEF_SYSTEM_PROMPT = `You are a senior management consultant preparing a pre-meeting intelligence brief. Your role is to synthesize research and analysis into actionable meeting preparation.

## Your Task
Create a one-page meeting brief that helps the presenter walk into the meeting fully prepared. The brief synthesizes:
1. The original research/source documents
2. The strategic roadmap analysis
3. The slide deck messaging
4. The executive document analysis

## Tone
- Confident and well-prepared
- Consultant speaking to consultant
- Direct and actionable`;

export function generateIntelligenceBriefPrompt(sessionData, meetingContext) {
  const { companyName, meetingAttendees, meetingObjective, keyConcerns } = meetingContext;
  let sessionContext = '## Session Analysis Data\n\n';

  // Source research (stored as { filename, content } from upload)
  if (sessionData.sources?.length > 0) {
    sessionContext += '### Source Research\n';
    sessionData.sources.forEach((source, i) => {
      sessionContext += `${i + 1}. ${source.filename || 'Document ' + (i + 1)}\n`;
      if (source.content) {
        // Include first 800 chars of content for context
        const preview = source.content.substring(0, 800).replace(/\n+/g, ' ').trim();
        sessionContext += `   Content: ${preview}...\n`;
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

  // Roadmap - data structure is { data: [{ title, entity, isSwimlane, bar }] }
  if (sessionData.roadmap?.data?.length > 0) {
    sessionContext += '### Strategic Roadmap\n';
    // Extract swimlanes and their tasks
    let currentSwimlane = null;
    sessionData.roadmap.data.forEach(item => {
      if (item.isSwimlane) {
        currentSwimlane = item.title;
        sessionContext += `\n**${item.title}** (${item.entity || 'Initiative'}):\n`;
      } else if (currentSwimlane && item.title) {
        sessionContext += `  - ${item.title}\n`;
      }
    });
    sessionContext += '\n';
  }

  // Slides - data structure is { sections: [{ swimlane, slides: [...] }] }
  if (sessionData.slides?.sections?.length > 0) {
    sessionContext += '### Slide Deck Messaging\n';
    let slideNum = 0;
    sessionData.slides.sections.forEach(section => {
      if (section.swimlane) {
        sessionContext += `\n**${section.swimlane}**:\n`;
      }
      if (section.slides?.length > 0) {
        section.slides.slice(0, 3).forEach(slide => {
          slideNum++;
          const title = slide.title?.replace(/\n/g, ' ') || slide.tagline || 'Slide';
          sessionContext += `${slideNum}. ${title}\n`;
          // Include key content from paragraphs
          if (slide.paragraph1) {
            sessionContext += `   - ${slide.paragraph1.substring(0, 150)}...\n`;
          }
        });
      }
    });
    sessionContext += '\n';
  }

  return `${INTELLIGENCE_BRIEF_SYSTEM_PROMPT}

## Meeting Details
- **Company**: ${companyName}
- **Attendees**: ${meetingAttendees}
- **Objective**: ${meetingObjective}
${keyConcerns ? `- **Key Concerns to Address**: ${keyConcerns}` : ''}

${sessionContext}

Generate a concise, one-page intelligence brief optimized for this specific meeting. Focus on the insights and talking points most relevant to the stated objective and attendees. Pull specific data and evidence from the session analysis above.`;
}

