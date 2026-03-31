# Proposal Studio (force-v2)

## Quick Start
```bash
npm start          # http://localhost:3000
npm test           # 267 tests (Jest, ESM)
npm run build      # esbuild + tailwind for production
```

## Architecture
- **Server:** Express 4 ESM (`server.js` entry) → routes in `server/routes/`
- **AI:** Google Gemini API via `@google/generative-ai`. Model rotation (`server/model-rotation.js`): flash → pro. Schema-constrained structured output (`responseMimeType: 'application/json'`).
- **Frontend:** Vanilla JS ES modules, two pages: `index.html` (upload) → `viewer.html` (multi-view SPA)
- **Views:** Gantt chart, Slides, Document, Research Analysis, Speaker Notes, Intelligence Brief
- **Exports:** PPTX via pptxgenjs, DOCX via docx library
- **Deploy:** Railway via nixpacks.toml (Node 20)

## Key Files
| Area | Files |
|------|-------|
| Gemini call | `server/gemini.js`, `server/generators.js` |
| Prompts + schemas | `server/prompts/*.js` (roadmap, slides, document, etc.) |
| Gantt rendering | `Public/gantt/renderer.js`, `Public/GanttChart.js` |
| Slide rendering | `Public/components/views/SlidesView.js` |
| CSS design system | `Public/styles/design-system.css` (glassmorphic navy theme) |
| Shared config | `Public/config/shared.js` (used by both client and server) |

## Conventions
- ESM everywhere (`import`/`export`, `type: "module"`)
- Gemini schemas use `responseSchema` with `required` arrays — always include `required` on objects with nullable fields
- Inline styles in `renderer.js` for grid borders (matches original force repo pattern)
- CSS: Tailwind utilities + large hand-written CSS files per view
- No Prettier — formatting is informal
- Tests: `tests/server/` (unit), `tests/integration/` (supertest), `tests/public/` (client utils)

## Adding a New View (Feature Template)

To add a new content view (e.g., "SWOT Analysis"), create these files in order:

1. **Schema + Prompt** — `server/prompts/<view-name>.js`
   - Export `<viewName>Schema` (JSON Schema with `required` arrays on all objects)
   - Export `generate<ViewName>Prompt(userPrompt, researchFiles, precomputed)` function
   - Follow `server/prompts/roadmap.js` as the simplest example

2. **Generator function** — add to `server/generators.js`
   - Add a config constant (e.g., `const SWOT_CONFIG = createConfig({...})`)
   - Add `async function generate<ViewName>(...)` using `generateWithGemini()`
   - Wire into `generateAllContent()` pipeline and `regenerateContent()` switch

3. **Route** — add endpoint in `server/routes/content.js` or `server/routes/sse-content.js`

4. **Frontend view** — `Public/components/views/<ViewName>View.js`
   - Export a class with a `render(container, data)` method
   - Follow `DocumentView.js` or `ResearchAnalysisView.js` as examples

5. **Sidebar nav** — register the view in `Public/components/SidebarNav.js`

6. **Viewer wiring** — add the view to `Public/viewer.js` (import, instantiate, route)

7. **CSS** — `Public/styles/<view-name>.css` (import in `viewer.html`)

8. **Tests** — `tests/server/prompts/<view-name>.test.js` + `tests/integration/<view-name>.test.js`

**Commit after each numbered step.** This allows recovery if something goes wrong mid-feature.

## Gotchas
- `gemini-2.5-flash-lite` is too weak for structured output — never add it to model rotation
- Disk cache (`.gemini-cache/`) can serve stale bad data — clear it after schema changes (`rm .gemini-cache/*.json`)
- Free-tier Gemini quota: 20 req/day per model. All models share the same API key.
- CSP `upgrade-insecure-requests` is disabled in dev (breaks Safari localhost)
- Gantt bar areas use CSS `subgrid` (requires Safari 16+)
