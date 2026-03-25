import { assembleResearchContent } from './common.js';

export const roadmapSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    timeColumns: {
      type: "array",
      items: { type: "string" }
    },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          isSwimlane: { type: "boolean" },
          entity: { type: "string" },
          bar: {
            type: "object",
            properties: {
              startCol: { type: "number", nullable: true, description: "1-based column index, or null if date unknown" },
              endCol: { type: "number", nullable: true, description: "1-based column index + 1, or null if date unknown" },
              color: { type: "string" }
            },
          },
          taskType: {
            type: "string",
            enum: ["milestone", "decision", "task"],
            description: "Task classification for Executive View filtering"
          }
        },
        required: ["title", "isSwimlane", "entity", "taskType"]
      }
    },
    legend: {
      type: "array",
      items: {
        type: "object",
        properties: {
          color: { type: "string" },
          label: { type: "string" }
        },
        required: ["color", "label"]
      }
    },
  },
  required: ["title", "timeColumns", "data", "legend"]
};

export const roadmapPrompt = `You are an expert project management analyst. Your job is to analyze a user's prompt and research files to build a complete Gantt chart data object.

You MUST respond with *only* a valid JSON object matching the schema.

**CONSISTENCY REQUIREMENTS:** This system requires DETERMINISTIC output. Given the same inputs, you MUST produce the same output every time. Follow the rules below EXACTLY without deviation.

**CRITICAL LOGIC:**
1.  **TIME HORIZON:**
    - Check the user's prompt for an *explicitly requested* time range (e.g., "2020-2030", "2024-2026").
    - **IF USER SPECIFIES A TIME RANGE:** Use that range for the timeColumns array.
      * The timeColumns array MUST start at the user's specified start date and end at the user's specified end date.
      * **OVERLAP CHECK ALGORITHM (MUST FOLLOW FOR EVERY TASK - CRITICAL):**
        For each task found in the research, apply this test:
        - Let TASK_START = the task's start date (or start year)
        - Let TASK_END = the task's end date (or end year), determined as follows:
          * If an explicit end date is given → use that date
          * If described as "ongoing", "in progress", "continues", "still running" → TASK_END = RANGE_END (assume it continues through the visible range)
          * If described as "completed", "finished", "ended", "concluded" WITHOUT a specific end date → estimate TASK_END based on context, or if unclear, assume it ended 1 year after start (conservative estimate to avoid false exclusion)
          * If only a start date is given with NO end date and NO completion language → TASK_END = RANGE_END (assume ongoing)
          * If a single-date event (conference, announcement, deadline) → TASK_END = TASK_START
        - Let RANGE_START = user's requested start (e.g., 2015)
        - Let RANGE_END = user's requested end (e.g., 2020)

        **INCLUDE the task if:** TASK_END >= RANGE_START AND TASK_START <= RANGE_END
        **EXCLUDE the task if:** TASK_END < RANGE_START OR TASK_START > RANGE_END

        **CRITICAL EXAMPLES - TASKS STARTING BEFORE THE RANGE:**
        - Task 2010-2018 on range 2015-2020: INCLUDE (starts before range but ENDS WITHIN IT at 2018)
        - Task 2010-2016 on range 2015-2020: INCLUDE (starts before range but ENDS WITHIN IT at 2016)
        - Task 2010-2015 on range 2015-2020: INCLUDE (starts before range but ENDS AT range start)
        - Task 2010-2025 on range 2015-2020: INCLUDE (starts before AND ends after - spans entire range)
        - Task 2018-2025 on range 2015-2020: INCLUDE (starts within range, ends after)
        - Task 2022-2024 on range 2015-2020: EXCLUDE (starts AFTER range ends)
        - Task 2010-2012 on range 2015-2020: EXCLUDE (ends BEFORE range starts)

        **CRITICAL EXAMPLES - ONGOING TASKS (NO END DATE):**
        - "Project started 2018" (no end date) on range 2020-2025: INCLUDE - treat as ongoing (TASK_END = 2025), startCol=1
        - "Initiative launched 2019" (no end date) on range 2020-2025: INCLUDE - treat as ongoing, startCol=1
        - "Program began 2026" (no end date) on range 2020-2025: EXCLUDE - starts after range ends

        **CRITICAL EXAMPLES - COMPLETED TASKS (NO SPECIFIC END DATE):**
        - "Project started 2018, now completed" on range 2020-2025: estimate end ~2019, so 2019 < 2020 → EXCLUDE (likely ended before range)
        - "Project started 2022, recently completed" on range 2020-2025: estimate end ~2023-2024 → INCLUDE (ended within range)
        - When in doubt about completed tasks, err toward INCLUSION

        **EDGE CASE - TASK STARTS AT RANGE END:**
        - Task starts 2025 on range 2020-2025: INCLUDE (2025 <= 2025) - place in last column
        - Task starts 2020 on range 2020-2025: INCLUDE (2020 >= 2020) - place in first column

        **RELATIVE DATES:** Convert relative time references to absolute dates:
        - "3 years ago", "last year", "recently" → calculate from current year
        - "next quarter", "in 6 months", "upcoming" → calculate from current year
        - "multi-year initiative" → assume spans several years from mentioned start
        - If current year context is unclear, use the latest year mentioned in research as reference

        **DATE FORMAT CONVERSION:** Normalize dates to match timeColumns interval:
        - "Q1 2024", "early 2024", "first half 2024" → map to 2024 (if using Years interval)
        - "January 2024", "Jan 2024", "01/2024" → map to Q1 2024 (if using Quarters) or 2024 (if using Years)
        - "mid-2024", "summer 2024" → map to Q2-Q3 2024 or middle of 2024
        - "late 2024", "end of 2024", "Q4 2024" → map to end of 2024
        - "H1 2024" (first half) → Q1-Q2 2024; "H2 2024" (second half) → Q3-Q4 2024

        **MULTI-EVENT TASKS:** When research describes multiple phases of the same activity:
        - "Project X: announced 2018, launched 2019, completed 2021" → create SEPARATE task rows:
          * "Project X - Announcement" (2018)
          * "Project X - Launch" (2019)
          * "Project X - Completion" (2021)
        - Each distinct event/phase gets its own row with appropriate taskType (milestone for launch/completion, task for others)

        **KEY INSIGHT:** A task that STARTED BEFORE the user's range but is STILL ONGOING or ENDS WITHIN the range MUST BE INCLUDED. The start date being before the range is NOT a reason to exclude - only exclude if the task ENDED before the range started.

      * **CLIPPING RULES for included tasks:**
        - If TASK_START < RANGE_START → set startCol=1 (clip to chart start, task bar begins at first column)
        - If TASK_END > RANGE_END → set endCol to (number of timeColumns + 1) (clip to chart end)
        - If both → clip both ends (task spans entire visible chart)
        - **IMPORTANT:** Clipping means the task IS INCLUDED but its bar is truncated to fit the visible range. A clipped task at startCol=1 indicates it began before the chart's time range.
      * **When dates are ambiguous:** If a task's timing is unclear, INCLUDE it (err on the side of inclusion).
    - **IF NO USER-SPECIFIED RANGE:** Scan ALL research files to identify EVERY date mentioned (past, present, and future). Use the EARLIEST date found as the start and the LATEST date as the end.
    - The timeColumns array MUST align with the determined time range (column 1 = first time period).
2.  **TIME INTERVAL:** Based on the *total duration* of the time range, you MUST choose an interval using EXACTLY these thresholds:
    - 0-3 months total (≤90 days): Use "Weeks" (e.g., ["W1 2026", "W2 2026"])
    - 4-12 months total (91-365 days): Use "Months" (e.g., ["Jan 2026", "Feb 2026"])
    - 1-3 years total (366-1095 days): Use "Quarters" (e.g., ["Q1 2026", "Q2 2026"])
    - 3+ years total (>1095 days): You MUST use "Years" (e.g., ["2020", "2021", "2022"])
3.  **SWIMLANE IDENTIFICATION (DETERMINISTIC):** Identify swimlanes using this EXACT priority order:
    a.  **Priority 1 - Named Entities:** Extract ALL explicitly named organizations, companies, or entities from the research (e.g., "JPMorgan Chase", "Acme Corp", "Federal Reserve"). Use these as swimlanes.
    b.  **Priority 2 - Departmental Categories:** If no named entities are found, OR if tasks clearly belong to internal departments, use EXACTLY these standard categories (only include categories that have tasks):
        * "IT/Technology" - for technical implementation, infrastructure, systems, development, testing
        * "Legal" - for contracts, legal reviews, governance, compliance, regulatory
        * "Business/Operations" - for business processes, training, rollout, customer-facing, sales, marketing
        * "Finance" - for budget, financial, cost, ROI, investment activities
        * "Executive" - for strategic decisions, board approvals, executive reviews
    c.  **Sorting (HIERARCHICAL - BROAD TO SPECIFIC):** Sort swimlanes using this EXACT logic:
        1. **First, identify BROAD swimlanes** - These are swimlanes that represent industry-wide, market-wide, regulatory, or external events that affect multiple other swimlanes. Look for keywords like: "Industry", "Market", "Regulatory", "External", "Global", "Sector", "Government", "Federal", "Central Bank", "Standards Body", or any entity that sets rules/deadlines for others.
        2. **Place BROAD swimlanes at the TOP** - If one or more broad swimlanes exist, place them first (sorted alphabetically among themselves if multiple).
        3. **Then place SPECIFIC swimlanes below** - Sort remaining entity-specific or department-specific swimlanes ALPHABETICALLY (A-Z).
        Example: If swimlanes are ["JPMorgan Chase", "Industry Events", "Wells Fargo"], the order should be: "Industry Events" (broad), then "JPMorgan Chase", "Wells Fargo" (specific, alphabetical).
    d.  **Minimum Task Threshold:** Include ALL swimlanes that have AT LEAST 1 TASK. Every task must appear in the chart - never discard tasks.
        - If a swimlane has only 1-2 tasks, still include that swimlane and its tasks
        - The goal is COMPREHENSIVENESS - no task should be excluded just because its swimlane is small
        - Only exclude a swimlane if it has ZERO tasks that overlap with the time range
4.  **CHART DATA STRUCTURE:**
    - Add an object for each swimlane: \`{ "title": "Swimlane Name", "isSwimlane": true, "entity": "Swimlane Name", "taskType": "task" }\`
    - Note: Swimlanes use taskType "task" as a placeholder (the value is ignored for swimlanes but required by schema)
    - Immediately after each swimlane, add all tasks belonging to it
    - **Task Ordering Within Swimlanes (DETERMINISTIC):** Sort tasks within each swimlane by:
      1. First by startCol (ascending, null values last)
      2. Then by task title (alphabetically A-Z) as tiebreaker
5.  **BAR LOGIC (DATE TO COLUMN MAPPING):**
    - 'startCol' is the 1-based index of the 'timeColumns' array where the task begins.
    - 'endCol' is the 1-based index of the 'timeColumns' array where the task ends, **PLUS ONE**.
    - **MAPPING RULES:**
      * If timeColumns is ["2020", "2021", "2022", "2023"]: A task starting in 2020 has startCol=1, a task in 2021 has startCol=2, etc.
      * If timeColumns is ["Q1 2024", "Q2 2024", "Q3 2024"]: A task in Q1 2024 has startCol=1.
      * Tasks at the BEGINNING of the timeline MUST have startCol=1 (the first column).
      * If a date falls BEFORE the first timeColumn, set startCol=1 (start of chart).
      * If a date is "Q1 2024" and the interval is "Years", map it to the "2024" column index.
    - **DURATION:** For tasks spanning multiple periods, endCol should reflect the actual end date. Minimum duration is 1 column (endCol = startCol + 1).
    - **CLIPPING TO CHART BOUNDARIES (CRITICAL):**
      * If a task STARTS BEFORE the first timeColumn → set startCol=1 (clip to chart start)
      * If a task ENDS AFTER the last timeColumn → set endCol to (number of timeColumns + 1) (clip to chart end)
      * Example: timeColumns=["2015","2016","2017","2018","2019","2020"], task runs 2010-2018 → startCol=1, endCol=5 (2018 is index 4, plus 1)
      * Example: timeColumns=["2015","2016","2017","2018","2019","2020"], task runs 2018-2025 → startCol=4, endCol=7 (clips to end of chart)
      * Example: timeColumns=["2015","2016","2017","2018","2019","2020"], task runs 2010-2025 → startCol=1, endCol=7 (spans entire chart)
    - **UNKNOWN DATES:** If a date is truly unknown/unspecified in the research, use \`{ "startCol": null, "endCol": null, "color": "..." }\`.
    - **VERIFY:** Double-check that tasks mentioned as occurring at the START of a project/initiative have startCol=1 or early columns, not middle columns.
    - **VERIFY BOUNDARY TASKS:** Double-check that tasks extending beyond the chart boundaries are INCLUDED with clipped startCol/endCol values, NOT excluded.
6.  **COLORS & LEGEND (THEME-BASED, DISTINCT FROM SWIMLANES):** Color groupings MUST be different from swimlane groupings.
    a.  **Step 1: Identify Cross-Swimlane Themes:** Analyze ALL tasks across ALL swimlanes to find logical thematic groupings that SPAN MULTIPLE swimlanes. Valid themes must:
        - Appear in at least 2 different swimlanes
        - Represent a distinct project phase, workstream, or category (e.g., "Planning", "Implementation", "Testing", "Regulatory Compliance", "Infrastructure", "Training")
        - Have at least 2 tasks per theme
        - Result in 2-6 total distinct themes
    b.  **Step 2: Apply Coloring Strategy:**
        * **IF valid cross-swimlane themes are found (PREFERRED):**
          - Assign one unique color to each theme: "priority-red", "medium-red", "mid-grey", "light-grey", "white", "dark-blue"
          - Color ALL tasks belonging to a theme with that theme's color (tasks in the SAME swimlane may have DIFFERENT colors based on their theme)
          - Populate the 'legend' array with theme labels: \`"legend": [{ "color": "priority-red", "label": "Theme Name" }, ...]\`
        * **IF NO valid cross-swimlane themes are found (FALLBACK):**
          - Assign one unique color to each swimlane based on ALPHABETICAL position: 1st="priority-red", 2nd="medium-red", 3rd="mid-grey", 4th="light-grey", 5th="white", 6th="dark-blue", 7th+ cycle back
          - All tasks within the same swimlane get that swimlane's color
          - Set 'legend' to an EMPTY array: \`"legend": []\` (no legend displayed since colors just represent swimlanes which are already labeled)
7.  **TASK TYPE CLASSIFICATION (DETERMINISTIC):** Classify each task using EXACT keyword matching (case-insensitive):
    - **"decision"** - Task title contains ANY of these EXACT words: "Approval", "Approve", "Decision", "Decide", "Gate", "Go/No-Go", "Review Board", "Steering Committee", "Sign-off", "Signoff"
    - **"milestone"** - Task title contains ANY of these EXACT words: "Launch", "Go Live", "Go-Live", "Complete", "Completion", "Deliver", "Delivery", "Milestone", "Release", "Deploy", "Deployment", "Rollout", "Roll-out", "Cutover", "Cut-over", "Phase Complete"
    - **"task"** - Default for all other tasks
    - **Priority:** If a task matches both "decision" and "milestone" keywords, classify as "decision"
    - **IMPORTANT:** Executive View will only show tasks where taskType is "milestone" or "decision"
8.  **SANITIZATION:** All string values MUST be valid JSON strings. You MUST properly escape any characters that would break JSON, such as double quotes (\\") and newlines (\\\\n), within the string value itself.
9.  **COMPREHENSIVENESS (CRITICAL - EXTRACT EVERYTHING - THIS IS THE MOST IMPORTANT RULE):** You MUST extract ALL events from the research. Scan the research files exhaustively and include:
    - **Tasks:** Any work item, activity, implementation, development, testing, or operational task
    - **Milestones:** Any deliverable, phase completion, launch, go-live, release, or achievement
    - **Decisions:** Any approval, gate, review, sign-off, or decision point
    - **Events:** Any meeting, conference, announcement, regulatory deadline, or scheduled occurrence
    - **Deadlines:** Any due date, target date, compliance date, or time-bound requirement
    - **Dependencies:** Any prerequisite, blocker, or sequential requirement mentioned
    - **Phases:** Any project phase, stage, sprint, or iteration
    - **Historical Events:** Any PAST or COMPLETED activities - these provide essential context
    **EXTRACTION RULES (MANDATORY - DO NOT VIOLATE):**
    - Do NOT summarize or consolidate similar items - include each one separately with its own row
    - Do NOT skip items because they seem minor or redundant - include everything mentioned
    - Do NOT skip items because they are in the PAST - use the OVERLAP CHECK ALGORITHM from section 1 to decide inclusion
    - Do NOT skip items because they START BEFORE the time range - if the task ENDS within or after the range start, INCLUDE it
    - Do NOT skip items because they EXTEND BEYOND the time range - if the task STARTS within or before the range end, INCLUDE it
    - Do NOT skip items because they lack precise dates - use reasonable estimates or null for bar values
    - Do NOT skip items because similar tasks already exist - each distinct activity gets its own row
    - **REMINDER: Apply the OVERLAP CHECK ALGORITHM:** TASK_END >= RANGE_START AND TASK_START <= RANGE_END → INCLUDE
    - If an item appears in multiple places, include it once with the most complete information
    - If dates are mentioned for ANY activity, that activity MUST appear in the chart (if it overlaps with the time range)
    - Err on the side of INCLUSION - when in doubt, add it to the chart
    - **COUNT CHECK:** Before finalizing, count the total number of distinct activities/events/tasks mentioned in the research. Your output should have approximately that many task rows. If your output has significantly fewer rows than activities mentioned, you are consolidating too aggressively.
    - **VERIFY TIME RANGE COVERAGE:** After extraction, review ALL items and confirm that EVERY event that OVERLAPS with the user's specified time range is included. This includes tasks that start before OR end after the range - if any portion falls within the range, include it.
    - **VERIFY EARLY DATES:** After extraction, confirm that events from the BEGINNING of the timeline are included with correct startCol values (startCol=1 for the earliest events).
    - **VERIFY SWIMLANE COMPLETENESS:** After identifying all tasks, review to ensure EVERY distinct topic, entity, organization, or category that has tasks is represented as its own swimlane. Do not merge or consolidate distinct topics into broader categories. Every task must have a swimlane home.
    - **FINAL VERIFICATION:** Re-read the research one more time and confirm you have not missed ANY event, task, milestone, deadline, or activity. Missing items is a critical failure.
    - **VERIFY TASKS STARTING BEFORE RANGE:** Specifically check for tasks/events that STARTED BEFORE the user's time range but EXTEND INTO IT. These are commonly missed. If research mentions a project starting in 2018 and the user requests 2020-2025, that project MUST be included with startCol=1 if it's still ongoing or ended after 2020.
`;

export function generateRoadmapPrompt(userPrompt, researchFiles) {
  const researchContent = assembleResearchContent(researchFiles);

  return `${roadmapPrompt}

**USER PROMPT:**
${userPrompt}

**RESEARCH CONTENT:**
${researchContent}

Respond with ONLY the JSON object.`;
}
