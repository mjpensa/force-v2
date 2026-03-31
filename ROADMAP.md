# Proposal Studio — Master Enhancement Roadmap

Compiled from 10-agent deep dive across all frontend, backend, prompts, views, CSS, routes, exports, and architecture.

---

## Category 1: Bugs (Broken Right Now)

### 1.1 PDF uploads produce garbage
- `FileCache.js` has no PDF parser — `buffer.toString('utf8')` on binary PDF produces corrupted text
- The upload form, multer middleware, and shared config all accept `.pdf`
- Fix: add `pdf-parse` library, 3-line `else if` in FileCache
- Also fix stale error messages in `config.js` lines 76-77 that omit `.pdf`
- **Files:** `server/cache/FileCache.js`, `package.json`, `server/config.js`

### 1.2 Per-view regeneration is built but unwired
- `regenerateContent()` exported from `generators.js`, tested, documented — but no route imports it
- The function also has bugs: no precomputation, no swimlane extraction, no cache bypass
- If slides fail, user must regenerate everything from scratch
- Fix: update function to accept existing session content, add `POST /:sessionId/:viewType/regenerate` route, add "Retry This View" button to viewer failure screen
- **Files:** `server/generators.js`, `server/routes/content.js`, `Public/viewer.js`

### 1.3 SSE endpoint is fake
- `sse-content.js` is a 2-second polling loop that almost always finds content already complete
- `/generate` is synchronous — blocks for 2+ minutes, returns everything at once
- The SSE connection is wasted work
- Fix: see Category 5 (async generation architecture)
- **Files:** `server/routes/sse-content.js`, `server/routes/content.js`

### 1.4 SSE error handler crashes on non-JSON data
- `viewer.js` line 51: `JSON.parse(event.data)` inside SSE `error` event listener will throw if data is not JSON
- Fix: wrap in try/catch
- **Files:** `Public/viewer.js`

### 1.5 `?views=` query parameter partially broken
- When `?views=slides` is used, the pipeline still generates roadmap (slides depend on it) but reports `roadmap: false` in the response
- Fix: either report the truth or document the dependency
- **Files:** `server/routes/content.js`

### 1.6 Document validation issues never surfaced
- `validateExecutiveSummary()` and `validateReasoningCoherence()` compute issues but the client never sees them
- `validationIssues` and `coherenceIssues` are attached to the result but no route or UI displays them
- **Files:** `server/generators.js`, `Public/components/views/DocumentView.js`

---

## Category 2: Client-Side Validation Gaps

### 2.1 No file size validation on client
- Server config defines `MAX_SIZE_BYTES: 10MB` per file, but `main.js` never checks
- User uploads a 500MB file, waits for upload to finish, then gets a server error
- Fix: check `file.size` in `processFiles()` before accepting
- **Files:** `Public/main.js`

### 2.2 No file count validation on client
- `FILE_LIMITS.MAX_COUNT` is 500, but client only shows a spinner at 100+ files
- Fix: reject files over the limit with a clear message
- **Files:** `Public/main.js`

### 2.3 No prompt length validation
- `VALIDATION.MAX_QUESTION_LENGTH` is 1000 chars in shared config but never enforced on upload page
- Textarea has no `maxlength` attribute
- **Files:** `Public/main.js`, `Public/index.html`

### 2.4 No `beforeunload` warning during generation
- Closing the tab mid-generation loses everything with no warning
- **Files:** `Public/main.js`

---

## Category 3: UX Problems

### 3.1 "Generate Chart" button label is misleading
- The app generates charts, slides, documents, and research analysis — not just a chart
- Form ID is also `gantt-form` (legacy naming)
- Fix: rename to "Generate Proposal" or "Generate Content"
- **Files:** `Public/index.html`

### 3.2 "Still generating" shows as error
- When user clicks a view that's still generating, `StateManager.loadView()` throws an error
- The user sees "slides is still being generated. Please wait..." but styled as an error with an error toast
- Fix: detect `processing: true` in error details, show a loading/generating placeholder instead
- **Files:** `Public/viewer.js`

### 3.3 No per-view retry button
- When slides generation fails, only options are "Generate New Content" (starts over) or refresh
- Fix: add "Retry This View" button that calls the regenerate endpoint (see 1.2)
- **Files:** `Public/viewer.js`

### 3.4 No session context in viewer
- User has no indication of which project/prompt they are viewing
- Session ID is only in the URL query parameter
- Fix: show prompt text and file names in a collapsible header
- **Files:** `Public/viewer.js`

### 3.5 No upload progress indicator
- `fetch()` provides no upload progress for large files
- Timer shows elapsed time but not upload percentage
- **Files:** `Public/main.js`

### 3.6 Home link discards session without confirmation
- Sidebar "New Roadmap" navigates to `/` with no "are you sure?" dialog
- **Files:** `Public/components/SidebarNav.js`

### 3.7 Re-clicking active view does nothing
- `_handleNavClick` returns early if `view === this.activeView`
- If a view failed to load, clicking it again has no effect
- Fix: allow re-click to retry
- **Files:** `Public/components/SidebarNav.js`

### 3.8 Error notification has white background
- Jarring against the dark navy glassmorphic UI
- Fix: use glass design language for error toasts
- **Files:** `Public/components/shared/ErrorHandler.js`

### 3.9 Inconsistent page titles
- `index.html` = "Proposal Studio", `viewer.html` = "Content Viewer"
- Fix: unify to "Proposal Studio"
- **Files:** `Public/viewer.html`

### 3.10 Only one error notification at a time
- `showErrorNotification` replaces any existing notification
- If multiple views fail simultaneously, user only sees the last error
- **Files:** `Public/components/shared/ErrorHandler.js`

### 3.11 Single-attempt content fetch on SSE ready
- `_fetchAndCacheContent` uses `pollUntilReady` with `maxAttempts: 1`
- A single transient failure silently drops content
- **Files:** `Public/viewer.js`

### 3.12 Dropzone reset creates oversized elements
- When all files are invalid, the dropzone recreates its icon/text with `text-2xl`/`text-3xl` classes
- Original HTML uses `text-[10px]`/`text-xs` — reset state looks much larger than initial state
- **Files:** `Public/main.js`

---

## Category 4: View-Specific Enhancements

### Gantt Chart

#### 4.1 No undo/redo for edits
- Drag, resize, add, delete — all irreversible
- **Files:** `Public/gantt/GanttEditor.js`

#### 4.2 Inline edits not persisted
- Task name, chart title, and legend label changes only update in-memory — lost on reload
- Only drag/resize and color changes call the API
- Fix: add `POST /api/content/update-task-title` (or generalized update endpoint)
- **Files:** `Public/gantt/GanttEditor.js`, `server/routes/content.js`

#### 4.3 No touch support
- Drag and resize are mouse-only — no touch event handlers
- **Files:** `Public/gantt/DraggableGantt.js`, `Public/gantt/ResizableGantt.js`

#### 4.4 No keyboard accessibility for interactions
- Drag, resize, context menu — all mouse-only
- WAI-ARIA expects keyboard alternatives for `role="menu"` elements
- **Files:** `Public/gantt/DraggableGantt.js`, `Public/gantt/ResizableGantt.js`, `Public/gantt/ContextMenu.js`

#### 4.5 Context menu color names are misleading
- `mid-grey` maps to Teal (#14B8A6), `light-grey` maps to Pink-Purple (#E879F9)
- **Files:** `Public/gantt/ContextMenu.js`

#### 4.6 No visual indicator for tasks with null dates
- Bars with null `startCol` are silently skipped — no "unknown date" marker shown
- **Files:** `Public/gantt/renderer.js`

#### 4.7 Virtualization uses hardcoded 18px row height
- Will break if CSS overrides row height
- **Files:** `Public/gantt/renderer.js`

#### 4.8 SVG export is not true vector
- Embeds a raster PNG inside SVG markup — does not scale
- **Files:** `Public/gantt/GanttExporter.js`

#### 4.9 Export filenames don't include chart title
- Always `gantt-chart.png` / `gantt-chart.svg`
- **Files:** `Public/gantt/GanttExporter.js`

#### 4.10 No PDF export for Gantt
- PNG and fake-SVG only
- **Files:** `Public/gantt/GanttExporter.js`

#### 4.11 New task placement is hardcoded
- `addNewTaskRow` always puts new tasks at `startCol: 2, endCol: 4` regardless of context
- **Files:** `Public/gantt/GanttEditor.js`

#### 4.12 Delete confirmation uses native `confirm()` dialog
- Not styled or branded
- **Files:** `Public/gantt/GanttEditor.js`

#### 4.13 Poor mobile experience
- Font sizes go to 0.6rem (9.6px), bars shrink to 3px — unreadable and untappable
- No horizontal scroll affordance or alternative list view
- **Files:** `Public/styles/gantt.css`

### Slides

#### 4.14 No presentation mode / fullscreen
- No fullscreen, no auto-advance, no minimal overlay controls
- Design: Fullscreen API on `.slides-view-container`, hide sidebar/TOC/notes, 16:9 letterboxing, auto-hiding overlay controls
- Optional "Presenter View" with 70/30 split showing notes alongside
- **Files:** `Public/components/views/SlidesView.js`, `Public/styles/slides-view.css`

#### 4.15 No keyboard navigation
- No arrow keys for slide advancement, no Home/End, no F5 for presentation
- Design: ArrowLeft/Right, Home/End, Escape, F5. Guard against contenteditable focus.
- **Files:** `Public/components/views/SlidesView.js`

#### 4.16 No inline editing
- Content is completely read-only — no editable taglines, titles, or body text
- Design: new `SlidesEditor.js` following GanttEditor pattern, `data-editable` attributes, double-click to edit, character counter badges, new `POST /api/content/update-slide-field` endpoint
- **Files:** `Public/components/views/SlidesView.js`, new `SlidesEditor.js`, `server/routes/content.js`, `Public/styles/slides-view.css`

#### 4.17 Demo slides always prepended
- 2 hardcoded template slides cannot be hidden or removed
- **Files:** `Public/components/views/SlidesView.js`

#### 4.18 No slide reordering
- **Files:** `Public/components/views/SlidesView.js`

#### 4.19 TOC hidden on mobile with no alternative
- At 767px, slides TOC gets `display: none` — no swipe or other navigation
- **Files:** `Public/styles/slides-view.css`

### Document

#### 4.20 Closing section has hardcoded next steps
- "Review detailed findings", "Align stakeholders", "Reference roadmap" — not derived from data
- **Files:** `Public/components/views/DocumentView.js`

#### 4.21 Duplicate heading IDs possible
- Section IDs generated from heading text — duplicate headings = duplicate IDs
- **Files:** `Public/components/views/DocumentView.js`

#### 4.22 Scroll-spy offset hardcoded at 150px
- May not match all header configurations
- **Files:** `Public/components/views/DocumentView.js`

#### 4.23 No PDF export
- DOCX only — PDF is the standard delivery format for executive briefings
- **Files:** `server/templates/docx-export-service.js`

#### 4.24 Table cells only handle plain text
- `_renderTable` does not support complex cell content
- **Files:** `Public/components/views/DocumentView.js`

### Research Analysis

#### 4.25 Zero export options
- No PNG, PDF, CSV, or any export for this dashboard
- Fix: html2canvas for PNG (pattern from GanttExporter)
- **Files:** `Public/components/views/ResearchAnalysisView.js`

#### 4.26 No ToC sidebar or scroll-spy
- Unlike Document and Slides, Research Analysis has no navigation aid
- **Files:** `Public/components/views/ResearchAnalysisView.js`

#### 4.27 No theme filtering or sorting
- **Files:** `Public/components/views/ResearchAnalysisView.js`

#### 4.28 Sample events capped at 5 with no "show more"
- **Files:** `Public/components/views/ResearchAnalysisView.js`

### Speaker Notes

#### 4.29 Uses innerHTML string concatenation
- Different pattern from rest of codebase (which uses DOM creation)
- Higher maintenance burden and XSS risk surface
- **Files:** `Public/components/views/SpeakerNotesManager.js`

#### 4.30 Fragile retry button
- Uses inline `onclick` with `this.closest('.slides-view-container').__view__._notesManager.generateOnDemand()` — brittle DOM traversal
- **Files:** `Public/components/views/SpeakerNotesManager.js`

#### 4.31 No caching between slide navigations
- Navigating away and back can trigger regeneration
- **Files:** `Public/components/views/SpeakerNotesManager.js`

#### 4.32 Bridge phrases buried too deep
- Hostile interruption / losing the room phrases are powerful but nested 4 levels deep in reasoning section — no quick-access mode
- **Files:** `Public/components/views/SpeakerNotesManager.js`

---

## Category 5: Architecture Improvements

### 5.1 Make generation async with real SSE streaming
- POST /generate returns sessionId immediately
- Generation runs in background, writing results to session progressively
- SSE streams real per-view lifecycle events (started, completed, failed)
- Client redirects to viewer immediately, shows views as they complete
- Includes event replay for late-connecting clients and heartbeat for proxy keepalive
- **Files:** `server/routes/content.js`, `server/generators.js`, `server/routes/sse-content.js`, `Public/viewer.js`, `Public/main.js`

### 5.2 Narrative Spine for cross-prompt coherence
- New Phase 0 step generates 3-5 key claims + core thesis + analytical framework
- Injected into roadmap, slides outline, and document prompts as authoritative anchors
- ~300 tokens of prompt overhead, eliminates story divergence between views
- **Files:** new `server/prompts/narrative-spine.js`, `server/generators.js`, `server/prompts/roadmap.js`, `server/prompts/slides.js`, `server/prompts/document.js`, `server/prompts/common.js`

### 5.3 Research Analysis feed-forward
- Await research analysis before Phase 1 (run parallel with narrative spine)
- Extract compact "research digest" (theme quality, timeline span, recommended interval)
- Inject 6-8 lines into downstream prompts for calibrated confidence
- **Files:** `server/generators.js`, `server/prompts/common.js`, `server/prompts/roadmap.js`, `server/prompts/document.js`

### 5.4 Slide self-critique pass
- Programmatic validator checks character constraints (tagline <=21, title lines <=10, paragraphs 380-410)
- Auto-fix trivial violations in code (tagline word count, uppercase)
- Send complex violations (paragraph length, title restructuring) to a fast correction LLM call
- Adds 0-8s conditionally
- **Files:** `server/generators.js`, `server/prompts/slides.js`

### 5.5 No session deletion endpoint
- Users cannot explicitly delete sessions — must wait for 1-hour TTL or LRU eviction
- **Files:** `server/routes/content.js`

---

## Category 6: New Views

### 6.1 SWOT Analysis (~12h)
- Interactive quadrant grid with collapsible evidence cards per item
- Cross-quadrant strategic implications section
- Schema: reasoning + strengths/weaknesses/opportunities/threats with evidence, source, impact rating, cross-references
- Pipeline: parallel with research analysis (no dependencies)
- Config: temperature 0.4, topP 0.8, thinkingBudget 8192
- **New files:** `server/prompts/swot-analysis.js`, `Public/components/views/SwotAnalysisView.js`, `Public/styles/swot-analysis.css`

### 6.2 Risk Register (~16h)
- 5x5 heat map matrix + sortable/filterable table with accordion row expansion
- Schema: risk items with likelihood (1-5), impact (1-5), score, category, mitigation, owner, status, roadmap impact
- Pipeline: Phase 2 (optionally depends on roadmap for roadmapImpact field)
- Config: temperature 0.3, topP 0.7, thinkingBudget 10240
- **New files:** `server/prompts/risk-register.js`, `Public/components/views/RiskRegisterView.js`, `Public/styles/risk-register.css`

### 6.3 Competitive Analysis (~15h)
- Competitor cards + comparison dimension table + strategic recommendations
- Schema: competitors with strengths/weaknesses/evidence, comparison dimensions with ratings, do-nothing risk
- Pipeline: parallel with research analysis (no dependencies)
- Config: temperature 0.45, topP 0.8, thinkingBudget 10240
- Note: speaker notes already have shallow `competitivePositioning` but standalone view needs richer data
- **New files:** `server/prompts/competitive-analysis.js`, `Public/components/views/CompetitiveAnalysisView.js`, `Public/styles/competitive-analysis.css`

### 6.4 Additional content types identified (not designed)
- Pricing / Cost Estimate
- Scope of Work / Statement of Work
- Budget / Financial Model
- Case Study / Success Story generator
- Team / Staffing Plan
- Compliance / Requirements Matrix
- Executive Email / Follow-Up generator
- Objection Playbook (consolidates speaker notes Q&A into standalone reference)
- Data Confidence Report (surfaces `generationTransparency` from speaker notes)
- Meeting Agenda Generator
- Follow-Up Action Tracker

---

## Category 7: Visual Design Debt

### 7.1 Modal system uses wrong color palette
- Gantt task modal uses charcoal gray (#1A1A1A, #383838) — predates the glassmorphic design system
- Intelligence brief modal already uses correct navy-glass treatment
- Fix: unify all modals to navy-glass
- **Files:** `Public/styles/modal.css`

### 7.2 Gantt uses ~30+ hardcoded hex values
- #0D0D0D, #354259, #546579, #383838, etc. instead of design system tokens
- **Files:** `Public/styles/gantt.css`, `Public/gantt/renderer.js`

### 7.3 Font sizing inconsistent across views
- Gantt: rem values (0.6rem, 0.65rem)
- Modal: pixel values (18px, 20px)
- Rest: token scale (--text-xs, --text-sm)
- **Files:** `Public/styles/gantt.css`, `Public/styles/modal.css`

### 7.4 Analysis view hardcodes colors
- Uses `#1a2744` instead of `--color-navy-deep`, `#FFFFFF` instead of `var(--glass-text-primary)`
- **Files:** `Public/styles/analysis-view.css`

### 7.5 Tailwind config duplicates CSS custom properties
- Every design-system token (blur, radius, shadow, glass colors) is duplicated in `tailwind.config.js`
- Double maintenance surface where values can drift
- **Files:** `tailwind.config.js`, `Public/styles/design-system.css`

### 7.6 Dropdown menu has no animation
- Toggles `display:none` / `display:block` with no transition
- Inconsistent with the `glassFadeSlideUp` pattern used everywhere else
- **Files:** `Public/styles/design-system.css`

### 7.7 Tooltip arrow points wrong direction
- `icon-rail.css` line 472-479: tooltip arrow on right side pointing left, but tooltip appears to the right of the sidebar
- **Files:** `Public/styles/icon-rail.css`

### 7.8 Speaker notes shimmer overshoots
- `translateX(400%)` shoots the fill bar off-screen
- Fix: bounded shimmer within track (like `barShine` in analysis-view)
- **Files:** `Public/styles/slides-view.css`

---

## Category 8: Prompt Engineering Improvements

### 8.1 Intelligence brief is under-engineered
- Dramatically simpler than other prompts — no chain-of-thought, no examples, no anti-patterns
- This is the "last mile" deliverable a consultant carries into a meeting
- Fix: add reasoning object, worked examples, evidence chain requirements
- **Files:** `server/prompts/intelligence-brief.js`

### 8.2 Speaker notes schema is extremely heavy
- Each slide's notes include narrative, anticipated questions, source attribution, story context, generation transparency, credibility anchors, risk mitigation, stakeholder angles, audience signals, quick reference
- May strain model output limits
- Consider: deferring some fields, making them optional, or splitting into tiers
- **Files:** `server/prompts/slides.js`

### 8.3 Roadmap prompt is repetitive
- 200 lines with overlap check examples stated multiple ways
- Could be condensed to the same semantic content in fewer tokens
- **Files:** `server/prompts/roadmap.js`

---

## Category 9: Server Gaps

### 9.1 No session persistence
- In-memory `Map()` — all content lost on server restart
- No ability to save, name, or organize proposals
- Future: SQLite or Redis for session persistence

### 9.2 No content editing API (beyond Gantt)
- Only `update-task-dates` and `update-task-color` exist
- No way to edit slide text, document sections, or any other content server-side
- Fix: add generalized update endpoints per view (see 4.2, 4.16)

### 9.3 No user management
- No authentication, no user accounts, no per-user session isolation
- Any client who knows a session ID can access it

### 9.4 No iterative refinement
- No prompt refinement endpoint ("make it more formal", "add more data to slide 3")
- No version history or undo/redo

### 9.5 No template customization
- PPTX and DOCX templates hardcoded with BIP branding
- No mechanism for custom branding, colors, or layouts

### 9.6 Export gaps
- No export for Research Analysis view
- No export for Gantt as data (CSV/Excel)
- No PDF export for any view
- No Markdown export

---

## Category 10: Accessibility & Standards

### 10.1 No keyboard navigation for sidebar
- `role="menu"` expects arrow-key navigation per WAI-ARIA authoring practices
- Missing `keydown` handler for up/down arrow movement between items
- **Files:** `Public/components/SidebarNav.js`

### 10.2 XSS vector in _statusScreen
- Injects `errorMessage` via innerHTML template literal
- DOMPurify is loaded but not used here
- **Files:** `Public/viewer.js`

### 10.3 Performance marks never reported
- `Performance.js` records marks and computes durations but discards results
- No logging, display, or telemetry
- **Files:** `Public/components/shared/Performance.js`

### 10.4 No offline handling
- No offline indicator, no service worker, no graceful degradation message
- Cached content is accessible but navigating to uncached views shows network error

---

## Recommended Implementation Order

### Phase A: Bug fixes — COMPLETE
~~1.1 PDF uploads, 1.2 Per-view regeneration, 1.4 SSE JSON.parse crash, 1.5 views param fix, 2.1-2.4 Client validation, 3.1 Button label, 3.9 Page title, 3.12 Dropzone reset, 10.2 XSS fix~~

### Phase B: Core UX improvements — COMPLETE
~~3.2 Generating placeholder, 3.3 Retry button, 3.7 Re-click retry, 3.8 Error notification styling, 4.15 Slides keyboard nav, 4.14 Slides presentation mode, 7.7 Tooltip arrow~~

### Phase C: Architecture — COMPLETE
~~5.1 Async generation + real SSE, 5.2 Narrative spine, 5.3 Research analysis feed-forward, 5.4 Slide self-critique~~

### Phase D: New views — COMPLETE
~~6.1 SWOT Analysis, 6.2 Risk Register, 6.3 Competitive Analysis~~

### Phase E: Polish — COMPLETE
~~4.16 Slides inline editing, 4.2 Gantt inline edit persistence, 4.25 Research Analysis export, 7.1 Modal unification, 7.2 Gantt token migration, 8.1 Intelligence brief enhancement, 4.23 Document PDF export~~

### Phase F: Future (scope TBD)
4.1 Undo/redo, 4.3 Touch support, 9.1 Session persistence, 9.3 User management, 6.4 Additional content types
