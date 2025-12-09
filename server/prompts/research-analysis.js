/**
 * Research Quality Analysis Prompt
 * Analyzes uploaded research for fitness to create Gantt charts
 *
 * This module evaluates research content to identify:
 * - Key themes and topics
 * - Quality of event-level data (dates, milestones, deadlines)
 * - Gaps in timeline information
 * - Actionable recommendations for improving research
 */

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/**
 * Theme analysis schema - detailed breakdown of each identified theme
 */
const themeAnalysisSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Name of the theme/topic identified in the research"
    },
    description: {
      type: "string",
      description: "Brief description of what this theme covers"
    },
    fitnessScore: {
      type: "number",
      description: "Score from 1-10 rating how well research supports Gantt chart creation for this theme"
    },
    eventDataQuality: {
      type: "string",
      enum: ["excellent", "good", "adequate", "poor", "inadequate"],
      description: "Quality rating of event-level data (dates, milestones, deadlines)"
    },
    datesCounted: {
      type: "number",
      description: "Number of specific dates or time references found for this theme"
    },
    tasksPotential: {
      type: "number",
      description: "Estimated number of tasks that could be extracted for a Gantt chart"
    },
    includeableInGantt: {
      type: "boolean",
      description: "Whether this theme has enough data to be included as a swimlane (requires 3+ tasks)"
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description: "What the research does well for this theme"
    },
    gaps: {
      type: "array",
      items: { type: "string" },
      description: "Specific missing information or gaps for this theme"
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "Actionable suggestions for improving research quality for this theme"
    },
    sampleEvents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          event: { type: "string", description: "Event or milestone name" },
          dateInfo: { type: "string", description: "Date/timeline info found (or 'Not specified')" },
          quality: { type: "string", enum: ["specific", "approximate", "vague", "missing"] }
        },
        required: ["event", "dateInfo", "quality"]
      },
      description: "Sample events found with their date quality assessment"
    }
  },
  required: ["name", "description", "fitnessScore", "eventDataQuality", "datesCounted", "tasksPotential", "includeableInGantt", "strengths", "gaps", "recommendations", "sampleEvents"]
};

/**
 * Data completeness metrics schema
 */
const dataCompletenessSchema = {
  type: "object",
  properties: {
    totalDatesFound: {
      type: "number",
      description: "Total count of specific dates found across all research"
    },
    totalEventsIdentified: {
      type: "number",
      description: "Total events/milestones/tasks identified"
    },
    eventsWithDates: {
      type: "number",
      description: "Number of events that have associated dates"
    },
    eventsWithoutDates: {
      type: "number",
      description: "Number of events lacking date information"
    },
    dateSpecificityBreakdown: {
      type: "object",
      properties: {
        specific: { type: "number", description: "Count of specific dates (e.g., 'March 15, 2024')" },
        quarterly: { type: "number", description: "Count of quarterly references (e.g., 'Q2 2024')" },
        monthly: { type: "number", description: "Count of monthly references (e.g., 'June 2024')" },
        yearly: { type: "number", description: "Count of yearly references (e.g., '2024')" },
        relative: { type: "number", description: "Count of relative dates (e.g., 'next quarter', '6 months')" },
        vague: { type: "number", description: "Count of vague references (e.g., 'soon', 'later')" }
      },
      required: ["specific", "quarterly", "monthly", "yearly", "relative", "vague"]
    },
    timelineSpan: {
      type: "object",
      properties: {
        earliestDate: { type: "string", description: "Earliest date reference found" },
        latestDate: { type: "string", description: "Latest date reference found" },
        spanDescription: { type: "string", description: "Human-readable timeline span (e.g., '3 years from 2022-2025')" }
      },
      required: ["earliestDate", "latestDate", "spanDescription"]
    }
  },
  required: ["totalDatesFound", "totalEventsIdentified", "eventsWithDates", "eventsWithoutDates", "dateSpecificityBreakdown", "timelineSpan"]
};

/**
 * Suggested source schema - recommendations for additional research
 */
const suggestedSourceSchema = {
  type: "object",
  properties: {
    sourceType: {
      type: "string",
      description: "Type of source recommended (e.g., 'Project timeline document', 'Regulatory filing')"
    },
    reason: {
      type: "string",
      description: "Why this source would help improve the research"
    },
    expectedImprovement: {
      type: "string",
      description: "What specific gaps this would address"
    },
    priority: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Priority level for obtaining this source"
    }
  },
  required: ["sourceType", "reason", "expectedImprovement", "priority"]
};

// ============================================================================
// MAIN SCHEMA
// ============================================================================

/**
 * Complete Research Analysis Schema
 */
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
    overallScore: {
      type: "number",
      description: "Overall research fitness score (1-10) for Gantt chart creation"
    },
    overallRating: {
      type: "string",
      enum: ["excellent", "good", "adequate", "poor", "inadequate"],
      description: "Overall quality rating"
    },
    summary: {
      type: "string",
      description: "Executive summary of research quality (2-3 sentences)"
    },
    keyFindings: {
      type: "array",
      items: { type: "string" },
      description: "Top 3-5 key findings about the research quality"
    },
    themes: {
      type: "array",
      items: themeAnalysisSchema,
      description: "Detailed analysis of each theme/topic identified"
    },
    dataCompleteness: dataCompletenessSchema,
    ganttReadiness: {
      type: "object",
      properties: {
        readyThemes: {
          type: "number",
          description: "Number of themes ready to become Gantt swimlanes (3+ tasks with dates)"
        },
        totalThemes: {
          type: "number",
          description: "Total number of themes identified"
        },
        estimatedTasks: {
          type: "number",
          description: "Estimated total tasks that can be extracted"
        },
        recommendedTimeInterval: {
          type: "string",
          enum: ["weeks", "months", "quarters", "years"],
          description: "Recommended time interval based on data granularity"
        },
        readinessVerdict: {
          type: "string",
          enum: ["ready", "needs-improvement", "insufficient"],
          description: "Overall verdict on whether research is ready for Gantt creation"
        }
      },
      required: ["readyThemes", "totalThemes", "estimatedTasks", "recommendedTimeInterval", "readinessVerdict"]
    },
    criticalGaps: {
      type: "array",
      items: { type: "string" },
      description: "Most critical gaps that should be addressed before creating a Gantt chart"
    },
    suggestedSources: {
      type: "array",
      items: suggestedSourceSchema,
      description: "Recommended additional sources to improve research quality"
    },
    actionItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", description: "Specific action to take" },
          impact: { type: "string", enum: ["high", "medium", "low"], description: "Expected impact on Gantt quality" },
          effort: { type: "string", enum: ["low", "medium", "high"], description: "Effort required" }
        },
        required: ["action", "impact", "effort"]
      },
      description: "Prioritized list of actions to improve research"
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

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export const researchAnalysisPrompt = `You are an expert research analyst specializing in evaluating research quality for project timeline and Gantt chart creation. Your job is to analyze uploaded research documents and provide a comprehensive assessment of how well the research supports creating accurate, detailed Gantt charts.

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

// ============================================================================
// PROMPT GENERATOR
// ============================================================================

/**
 * Generate the complete research analysis prompt with user context
 * @param {string} userPrompt - The user's analysis request
 * @param {Array<{filename: string, content: string}>} researchFiles - Research files to analyze
 * @returns {string} Complete prompt for AI
 */
export function generateResearchAnalysisPrompt(userPrompt, researchFiles) {
  const researchContent = researchFiles
    .map(file => `=== ${file.filename} ===\n${file.content}`)
    .join('\n\n');

  const timestamp = new Date().toISOString();

  return `${researchAnalysisPrompt}

**USER REQUEST:**
${userPrompt}

**RESEARCH CONTENT TO ANALYZE:**
${researchContent}

**GENERATION TIMESTAMP:**
${timestamp}

Analyze this research thoroughly and provide a comprehensive quality assessment focused on its fitness for Gantt chart creation. Identify all themes, assess data quality for each, and provide specific, actionable recommendations.

**CRITICAL REQUIREMENTS:**
1. Use ONLY the research content provided above - do not invent or assume information
2. Be specific about what IS in the research and what is MISSING
3. Count dates and events accurately
4. Every recommendation must be actionable and specific to gaps found
5. Set generatedAt to the timestamp provided above

Respond with ONLY the JSON object.`;
}

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Validate research analysis structure
 * @param {object} data - The generated analysis data
 * @returns {boolean} True if valid
 */
export function validateResearchAnalysisStructure(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required top-level fields
  const requiredFields = [
    'title',
    'overallScore',
    'overallRating',
    'summary',
    'themes',
    'dataCompleteness',
    'ganttReadiness'
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      return false;
    }
  }

  // Validate themes array
  if (!Array.isArray(data.themes) || data.themes.length === 0) {
    return false;
  }

  // Validate each theme has required fields
  for (let i = 0; i < data.themes.length; i++) {
    const theme = data.themes[i];
    if (!theme.name || typeof theme.fitnessScore !== 'number') {
      return false;
    }
  }

  // Validate overall score range
  if (data.overallScore < 1 || data.overallScore > 10) {
    return false;
  }

  return true;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  researchAnalysisSchema,
  researchAnalysisPrompt,
  generateResearchAnalysisPrompt,
  validateResearchAnalysisStructure
};
