# Multi-Agent Codebase Review Playbook

A systematic technique for deep codebase analysis using parallel Claude Code agents. Proven on force-v2 (25,600 lines) across 32 agents in 4 rounds, identifying ~3,000+ lines of reduction and 10+ bugs.

---

## Core Pattern

```
Round 1: Zone-deep discovery (8 parallel agents, one per functional area)
Round 2: Cross-cutting verification (8 agents, themes from R1 findings)
Round 3: Blind spot coverage (8 agents, areas between R1-R2 boundaries)
Round 4: Targeted deep dives (8 agents, high-value files that need dedicated analysis)
```

Each agent is `general-purpose` with `max_turns: 30` and `model: "opus"`. All 8 agents in a round launch in a single message for maximum parallelism.

---

## Agent Prompt Template

Every agent receives:
1. **Exact file list** with line counts
2. **Analysis mandate** (5 categories or attack-specific focus)
3. **Specific investigation points** (what to look for in those files)
4. **Required output format**: finding with file:line, estimated impact, confidence level, cross-zone notes
5. **Instruction to be exhaustive** and summarize at the end

---

## Review Dimensions

### 1. Code Reduction / Simplification

**Round 1 zones (8 agents):**
- Server generators + validation logic
- Server prompts / schemas
- Server routes + middleware + config
- Server export templates
- Frontend orchestrator + state management
- Frontend view components
- Frontend subsystems (e.g., Gantt chart)
- CSS stylesheets

**Round 1 mandate per agent:**
1. Dead code -- unreachable branches, unused exports, defensive code that can't trigger
2. Duplication -- copy-paste patterns, repeated logic, similar functions that differ trivially
3. Over-engineering -- abstractions used once, config that never varies, validation that can't fail
4. Consolidation -- multiple small things that should be one, fragmented logic
5. Simplification -- complex logic with simpler equivalents, unnecessary indirection

**Round 2 cross-cutting agents (designed from R1 findings):**
- Dead data flow audit (trace fields from generation -> storage -> API -> client)
- Unified component design (for patterns duplicated across 3+ files)
- Shared module design (text processing, polling utilities, etc.)
- Minimal architecture redesign (strip over-built systems to actual usage)
- CSS dead selector verification (cross-reference CSS against all JS DOM generation)
- Validation pipeline minimal set (which validators actually influence behavior?)
- Prompt shared utilities (extract duplicated prompt text to shared functions)
- Subsystem-specific dedup (e.g., editor/exporter consolidation)

**Round 3 blind spots:**
- Shared utility dead export audit (every export vs every consumer)
- Deep template analysis (largest files with massive template literals)
- HTML modernization (CDN deps, inline scripts, build pipeline)
- Export service internal dedup (paragraph/section creation patterns)
- End-to-end feature reachability (trace every button to its handler)
- Inline style -> CSS migration audit (all JS files)
- Dependency + build pipeline audit (unused deps, dead build steps)

**Round 4 targeted deep dives:**
- Individual large files that only got zone-level coverage (give them the dedicated treatment)
- Concrete cleanup designs for specific findings (exact line deletions, CSS class definitions)
- Config dead property cleanup (verify every property against all consumers)
- Build pipeline fix-or-remove decisions

---

### 2. Security Audit

**Round 1 zones (8 agents):**
1. Authentication & session management (session creation, validation, expiry, hijacking vectors)
2. Input validation & sanitization (prompt injection, file upload validation, request body parsing)
3. CSP & security headers (Helmet config, CSP policy, CORS, X-Frame-Options)
4. Prompt injection defense (regex-based sanitization effectiveness, bypass vectors)
5. File upload security (MIME validation, extension checks, size limits, path traversal)
6. CORS & origin policy (allowed origins, credential handling, preflight config)
7. Rate limiting & DoS protection (limiter config, resource-intensive endpoints, timeout handling)
8. Data exposure & information leakage (error messages, stack traces, session data in responses)

**Round 2 attack-path tracing (8 agents):**
1. SSRF via file content (can uploaded file content trigger server-side requests?)
2. Session hijacking (UUID predictability, session fixation, no auth on session endpoints)
3. Stored XSS via AI output (AI-generated HTML rendered in browser without sanitization)
4. Denial of service via large uploads (memory exhaustion, concurrent generation, API queue saturation)
5. Information leakage via error messages (stack traces, internal paths, API keys in errors)
6. Prompt extraction attacks (can users extract system prompts via crafted input?)
7. Dependency vulnerability audit (npm audit, known CVEs, outdated packages)
8. Deployment security (Railway config, environment variables, public accessibility)

---

### 3. Performance Audit

**Round 1 zones (8 agents):**
1. CSS critical path (render-blocking CSS, unused CSS weight, specificity overhead)
2. JS bundle analysis (module count, load waterfall, code splitting opportunities)
3. API response times (Gemini call latency, timeout config, retry overhead)
4. Memory profiling (session Map growth, file cache eviction, event listener leaks)
5. Caching opportunities (static assets, API responses, file processing results)
6. Asset optimization (image formats, SVG cleanup, font loading strategy)
7. Render performance (DOM manipulation patterns, layout thrashing, paint costs)
8. Network waterfall (request count, CDN dependencies, compression, HTTP/2)

**Round 2 cross-cutting (8 agents):**
1. Largest Contentful Paint paths (what blocks first meaningful render?)
2. Memory leak detection (event listeners, DOM references, closures, timers)
3. Concurrent session load testing design (what happens with 100 simultaneous users?)
4. Gemini API cost optimization (token usage, caching, prompt compression)
5. Time-to-Interactive analysis (JS parse/compile cost, hydration overhead)
6. Database-less architecture stress test (in-memory session limits, eviction behavior)
7. Image/asset lazy loading effectiveness (Intersection Observer patterns, above-fold audit)
8. Server-side bottleneck analysis (Express middleware chain, compression overhead, static serving)

---

### 4. UX / Accessibility Audit

**Round 1 zones (8 agents):**
1. Keyboard navigation (tab order, focus management, keyboard shortcuts)
2. Screen reader compatibility (ARIA labels, live regions, semantic HTML)
3. Color contrast & visual accessibility (WCAG AA ratios, color-only indicators)
4. Error handling UX (user-facing messages, recovery paths, loading states)
5. Responsive design (breakpoint behavior, mobile layout, touch targets)
6. Form accessibility (labels, validation feedback, required field indicators)
7. Navigation & wayfinding (view switching, URL state, back button behavior)
8. Content accessibility (heading hierarchy, link text, image alt text)

---

### 5. AI Output Quality Audit

**Round 1 zones (8 agents):**
1. Roadmap prompt -> schema -> render pipeline (does the prompt produce good Gantt data?)
2. Slides prompt -> schema -> render pipeline (slide quality, layout distribution)
3. Document prompt -> schema -> render pipeline (executive summary quality, section depth)
4. Speaker notes prompt -> schema -> render pipeline (notes usefulness, reasoning quality)
5. Research analysis prompt -> schema -> render pipeline (analysis accuracy)
6. Intelligence brief prompt -> schema -> render pipeline (brief actionability)
7. Prompt instruction conflicts (do any prompts contradict each other?)
8. Schema field utilization (which schema fields actually improve output vs add noise?)

---

## Key Lessons Learned

### What makes agents effective
- **Exact file lists with line counts** -- agents know their scope
- **Specific investigation points** -- not just "find issues" but "check if X duplicates Y"
- **Required output format** -- file:line references, estimated lines, confidence levels
- **Cross-zone notes field** -- agents flag patterns they notice outside their zone
- **"Be exhaustive" instruction** -- prevents agents from stopping at the first few findings

### What to watch for
- **Round 1 underestimates** -- dedicated deep dives (R3-R4) consistently find 2-2.5x more than zone-level passes
- **Cross-zone duplication** -- the highest-value findings often span multiple agent zones (e.g., triplicated dropdown menu across views + CSS)
- **Dead data pipelines** -- fields generated by AI, stored in sessions, served via API, but never rendered by any client code
- **Vestigial architecture** -- systems built for async flows that are actually synchronous, reactive state managers with zero subscribers

### Synthesis between rounds
After each round:
1. Collect all agent outputs
2. Build a ranked findings list sorted by: lines removable x confidence
3. Identify cross-zone themes (patterns found by 2+ agents)
4. Map dependencies (which fixes enable other fixes)
5. Design next-round agents targeting gaps and cross-cutting themes

### Diminishing returns
- Round 1: ~60% of total findings
- Round 2: ~25% (cross-cutting verification + implementation designs)
- Round 3: ~10% (blind spots, deep dives on overlooked files)
- Round 4: ~5% (targeted deep dives, concrete cleanup designs)
- After R4, you're at 95%+ coverage. Additional rounds yield <2% new findings.

---

## Quick-Start Template

To run this on a new codebase:

```bash
# 1. Get file sizes to design zones
find . -type f \( -name '*.js' -o -name '*.ts' -o -name '*.css' \) \
  -not -path '*node_modules*' -not -path '*.git*' \
  -exec wc -l {} \; | sort -rn | head -40

# 2. Group files into 8 zones of roughly equal size (~2,000-4,000 lines each)
# 3. Launch 8 agents in one message with the template above
# 4. Synthesize findings, design Round 2
# 5. Repeat until diminishing returns
```

---

## Force-V2 Results Summary

| Round | Agents | New Findings | Cumulative Lines |
|-------|--------|-------------|-----------------|
| R1 | 8 | ~2,978 lines identified | 2,978 |
| R2 | 8 | +~1,200 (cross-verified + designs) | ~3,200 |
| R3 | 8 | +~800 (blind spots + deep dives) | ~3,500 |
| R4 | 8 | +~500 (targeted deep dives) | ~3,800 |

Plus: 10+ bugs found (leaked event listeners, selector collisions, unescaped HTML injection, stale hardcoded dates, missing destroy methods), dead build pipeline, 5 unused npm dependencies, ~1,300-3,000 AI tokens wasted per generation cycle on dead schema fields.
