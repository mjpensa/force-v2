import { assembleResearchContent } from './common.js';

const themeAnalysisSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Theme/topic name" },
    description: { type: "string", description: "Brief theme description" },
    fitnessScore: { type: "number", description: "1-10 Gantt fitness score" },
    eventDataQuality: {
      type: "string",
      enum: ["excellent", "good", "adequate", "poor", "inadequate"],
      description: "Event-level data quality (dates, milestones, deadlines)"
    },
    datesCounted: { type: "number", description: "Count of date/time references found" },
    tasksPotential: { type: "number", description: "Estimated extractable Gantt tasks" },
    includeableInGantt: { type: "boolean", description: "Has enough data for a swimlane (3+ tasks)" },
    strengths: { type: "array", items: { type: "string" }, description: "Research strengths for this theme" },
    gaps: { type: "array", items: { type: "string" }, description: "Missing information or gaps" },
    recommendations: { type: "array", items: { type: "string" }, description: "Actionable improvement suggestions" },
    sampleEvents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          event: { type: "string", description: "Event/milestone name" },
          dateInfo: { type: "string", description: "Date info found (or 'Not specified')" },
          quality: { type: "string", enum: ["specific", "approximate", "vague", "missing"] }
        },
        required: ["event", "dateInfo", "quality"]
      },
      description: "Sample events with date quality assessment"
    }
  },
  required: ["name", "description", "fitnessScore", "eventDataQuality", "datesCounted", "tasksPotential", "includeableInGantt", "strengths", "gaps", "recommendations", "sampleEvents"]
};

const dataCompletenessSchema = {
  type: "object",
  properties: {
    totalDatesFound: { type: "number", description: "Total specific dates across all research" },
    totalEventsIdentified: { type: "number", description: "Total events/milestones identified" },
    eventsWithDates: { type: "number", description: "Events with associated dates" },
    eventsWithoutDates: { type: "number", description: "Events lacking dates" },
    dateSpecificityBreakdown: {
      type: "object",
      properties: {
        specific: { type: "number", description: "Specific-date count" },
        quarterly: { type: "number", description: "Quarterly-reference count" },
        monthly: { type: "number", description: "Monthly-reference count" },
        yearly: { type: "number", description: "Yearly-reference count" },
        relative: { type: "number", description: "Relative-date count" },
        vague: { type: "number", description: "Vague-reference count" }
      },
      required: ["specific", "quarterly", "monthly", "yearly", "relative", "vague"]
    },
    timelineSpan: {
      type: "object",
      properties: {
        earliestDate: { type: "string", description: "Earliest date found" },
        latestDate: { type: "string", description: "Latest date found" },
        spanDescription: { type: "string", description: "Human-readable span (e.g., '3 years from 2022-2025')" }
      },
      required: ["earliestDate", "latestDate", "spanDescription"]
    }
  },
  required: ["totalDatesFound", "totalEventsIdentified", "eventsWithDates", "eventsWithoutDates", "dateSpecificityBreakdown", "timelineSpan"]
};

const suggestedSourceSchema = {
  type: "object",
  properties: {
    sourceType: { type: "string", description: "Recommended source type" },
    reason: { type: "string", description: "Why this source would help" },
    expectedImprovement: { type: "string", description: "Gaps this would address" },
    priority: { type: "string", enum: ["high", "medium", "low"], description: "Acquisition priority" }
  },
  required: ["sourceType", "reason", "expectedImprovement", "priority"]
};

export const researchAnalysisSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Title for the research analysis report"
    },
    generatedAt: {
      type: "string",
      description: "ISO timestamp of when analysis was generated"
    },
    overallScore: { type: "number", description: "1-10 Gantt fitness score" },
    overallRating: {
      type: "string",
      enum: ["excellent", "good", "adequate", "poor", "inadequate"],
      description: "Overall quality rating"
    },
    summary: { type: "string", description: "Research quality summary (2-3 sentences)" },
    keyFindings: { type: "array", items: { type: "string" }, description: "Top 3-5 research quality findings" },
    themes: { type: "array", items: themeAnalysisSchema, description: "Per-theme analysis" },
    dataCompleteness: dataCompletenessSchema,
    ganttReadiness: {
      type: "object",
      properties: {
        readyThemes: { type: "number", description: "Themes ready for Gantt swimlanes" },
        totalThemes: { type: "number", description: "Total themes identified" },
        estimatedTasks: { type: "number", description: "Total extractable tasks" },
        recommendedTimeInterval: {
          type: "string",
          enum: ["weeks", "months", "quarters", "years"],
          description: "Time interval based on data granularity"
        },
        readinessVerdict: {
          type: "string",
          enum: ["ready", "needs-improvement", "insufficient"],
          description: "Gantt creation readiness verdict"
        }
      },
      required: ["readyThemes", "totalThemes", "estimatedTasks", "recommendedTimeInterval", "readinessVerdict"]
    },
    criticalGaps: {
      type: "array",
      items: { type: "string" },
      description: "Critical gaps to address before Gantt creation"
    },
    suggestedSources: {
      type: "array",
      items: suggestedSourceSchema,
      description: "Additional sources to improve research"
    },
    actionItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", description: "Action to take" },
          impact: { type: "string", enum: ["high", "medium", "low"], description: "Gantt quality impact" },
          effort: { type: "string", enum: ["low", "medium", "high"], description: "Effort required" }
        },
        required: ["action", "impact", "effort"]
      },
      description: "Prioritized improvement actions"
    }
  },
  required: [
    "title",
    "generatedAt",
    "overallScore",
    "overallRating",
    "summary",
    "keyFindings",
    "themes",
    "dataCompleteness",
    "ganttReadiness",
    "criticalGaps",
    "suggestedSources",
    "actionItems"
  ]
};

const researchAnalysisPrompt = `You are an expert research analyst specializing in evaluating research quality for project timeline and Gantt chart creation. Your job is to analyze uploaded research documents and provide a comprehensive assessment of how well the research supports creating accurate, detailed Gantt charts.

You MUST respond with *only* a valid JSON object matching the schema.

## ANALYSIS FRAMEWORK

### 1. THEME IDENTIFICATION
Identify ALL distinct themes, topics, entities, or focus areas in the research. This includes:
- Named organizations or companies
- Project phases or workstreams
- Regulatory or compliance topics
- Technology or system implementations
- Business processes or operations
- Any other distinct areas of focus

### 2. FITNESS SCORING (1-10 Scale)
For each theme, rate how well the research supports Gantt chart creation:

| Score | Rating | Criteria |
|-------|--------|----------|
| 9-10 | Excellent | Multiple specific events with exact dates (day/month/year), clear milestones, well-defined deadlines, sequencing information |
| 7-8 | Good | Several events with dates (at least month/year), some milestones identified, minor gaps in timeline |
| 5-6 | Adequate | Events mentioned but dates are approximate (quarters, seasons), limited milestone detail |
| 3-4 | Poor | Topic discussed but lacks specific dates, mostly narrative/descriptive, few actionable timeline items |
| 1-2 | Inadequate | Topic mentioned briefly, no dates or timelines, purely conceptual discussion |

### 3. EVENT DATA QUALITY ASSESSMENT
For each theme, evaluate:
- **Specific dates found**: Count exact dates (e.g., "March 15, 2024")
- **Approximate dates**: Count quarter/month references (e.g., "Q2 2024", "June 2024")
- **Relative dates**: Count relative references (e.g., "6 months after launch", "next quarter")
- **Missing dates**: Events mentioned without any timeline information

### 4. GANTT READINESS CRITERIA
A theme is "ready" for Gantt chart inclusion if it has:
- At least 3 distinct tasks/events that can be extracted
- At least 2 of those tasks have some form of date information
- Clear enough sequencing to place items on a timeline

### 5. GAP ANALYSIS
For each theme, identify specific gaps:
- Missing start dates
- Missing end dates or deadlines
- Lack of milestone definitions
- Unclear sequencing between events
- Vague timeline references that need clarification

### 6. RECOMMENDATIONS
Provide actionable, specific recommendations:
- BAD: "Add more dates" (too vague)
- GOOD: "Research should include specific delivery dates for the three software releases mentioned in Section 2"

### 7. SUGGESTED SOURCES
Recommend specific types of documents that would improve the research:
- Project schedules or timelines
- Regulatory filings with compliance deadlines
- Press releases with announcement dates
- Contract documents with milestone dates
- Meeting minutes with decision dates

## OUTPUT REQUIREMENTS

1. **Be thorough**: Analyze ALL themes, not just major ones
2. **Be specific**: Cite specific examples from the research
3. **Be actionable**: Every recommendation should be something the user can act on
4. **Be honest**: If research is insufficient, say so clearly
5. **Count accurately**: Provide accurate counts of dates and events found

## OVERALL SCORE CALCULATION
Calculate the overall score as a weighted average:
- Themes with more potential tasks get higher weight
- Themes that could become swimlanes get 2x weight
- Round to one decimal place

## READINESS VERDICT
- **ready**: At least 3 themes are Gantt-ready, overall score >= 6
- **needs-improvement**: 1-2 themes are Gantt-ready, or overall score 4-5.9
- **insufficient**: No themes are Gantt-ready, or overall score < 4`;

export function generateResearchAnalysisPrompt(userPrompt, researchFiles, precomputed = null) {
  const researchContent = precomputed?.researchContent || assembleResearchContent(researchFiles);

  const timestamp = new Date().toISOString();

  return `${researchAnalysisPrompt}

**USER REQUEST:**
${userPrompt}

**RESEARCH CONTENT TO ANALYZE:**
${researchContent}

**GENERATION TIMESTAMP:**
${timestamp}

Analyze this research thoroughly and provide a comprehensive quality assessment focused on its fitness for Gantt chart creation. Identify all themes, assess data quality for each, and provide specific, actionable recommendations.

Use ONLY the provided research content. Be specific, count accurately, and set generatedAt to the timestamp above. Respond with ONLY the JSON object.`;
}

