Read CLAUDE.md and ROADMAP.md before starting.

Build new view: $ARGUMENTS

Follow the "Adding a New View" feature template in CLAUDE.md exactly, in order:

1. **Schema + Prompt** — `server/prompts/<view-name>.js`
   - Look up the view in ROADMAP.md Category 6 for the schema design and generation config
   - Use `assembleResearchContent`, `extractKeyStats`, `getCurrentDateContext` from common.js
   - Include a `reasoning` object for chain-of-thought (follow document.js pattern)
   - Add `required` arrays on ALL objects

2. **Generator function** — `server/generators.js`
   - Add config constant with the temperature/topP/thinkingBudget from ROADMAP.md
   - Add async generator function
   - Wire into `generateAllContent()` at the correct pipeline phase (check ROADMAP.md for dependencies)
   - Add case to `regenerateContent()` switch

3. **Route** — `server/routes/content.js`
   - Add to `VIEW_TYPE_MAP`
   - Add to session `content` object in `/generate` handler
   - Add to `requestedViews` filter

4. **SSE** — `server/routes/sse-content.js`
   - Add to VIEWS array (use camelCase key)

5. **Frontend view** — `Public/components/views/<ViewName>View.js`
   - Export a class with `constructor(data, sessionId)`, `render()`, `destroy()`
   - Use glassmorphic design system tokens from design-system.css
   - Include expand/collapse interactions where appropriate

6. **Sidebar nav** — `Public/components/SidebarNav.js`
   - Add navItem with id, title, subtitle, icon SVG

7. **Viewer wiring** — `Public/viewer.js`
   - Add to `viewLoaders` (dynamic import)
   - Add to `_validateViewData` switch
   - Add to `_updateBodyViewClass` remove list
   - Add to `_startBackgroundStatusPolling` views array

8. **State** — `Public/components/shared/StateManager.js`
   - Add content key to initial state

9. **CSS** — `Public/styles/<view-name>.css`
   - Link from `viewer.html`
   - Use design system tokens, glassmorphic panels, responsive breakpoints

10. **Tests** — `tests/server/prompts/<view-name>.test.js`

Commit after each numbered step. Run `npm test` after steps 2, 3, and 10. Clear `.gemini-cache/*.json` after step 1.
