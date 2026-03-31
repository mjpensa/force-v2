Read CLAUDE.md and ROADMAP.md before starting.

Implement ROADMAP.md item(s): $ARGUMENTS

Follow this exact process:

1. **Read the item(s)** from ROADMAP.md — get the description and file list
2. **Plan** — use /plan mode to draft the approach. Keep it concise. Exit plan mode when ready.
3. **Branch check** — if not already on a feature branch, ask the user which branch to use
4. **Execute** — make all code changes. Follow the conventions in CLAUDE.md.
5. **Test** — run `npm test`. If tests fail, fix them (up to 3 attempts).
6. **Clear cache if needed** — if any file in `server/prompts/` was modified, run `rm -f .gemini-cache/*.json`
7. **Commit** — commit with a descriptive message referencing the ROADMAP item number(s)
8. **Report** — summarize what changed (files modified, lines added/removed, tests passing)

Rules:
- One commit per item unless the user explicitly batches multiple items
- Never modify files not listed in the ROADMAP item unless required for the fix
- If the item requires a new file, follow the feature template in CLAUDE.md
- If you hit a blocker that requires user input, stop and ask — don't guess
