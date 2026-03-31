Read CLAUDE.md and ROADMAP.md before starting.

Execute ROADMAP.md Phase: $ARGUMENTS

Look up the phase in the "Recommended Implementation Order" section at the bottom of ROADMAP.md. Identify ALL items in that phase.

For each item in the phase, in order:
1. Read the item description and file list from ROADMAP.md
2. Implement the fix/feature following CLAUDE.md conventions
3. Run `npm test` — fix failures (up to 3 attempts per item)
4. If any `server/prompts/` file was modified, run `rm -f .gemini-cache/*.json`
5. Commit with message referencing the item number (e.g., "Fix 1.1: Add PDF text extraction")
6. Move to the next item

Before starting:
- Create a branch named `phase-{letter}-{description}` (e.g., `phase-a-bugfixes`) if not already on one
- List all items you will implement and get user confirmation before proceeding

After completing all items:
- Run `npm test` one final time to confirm everything passes
- Report: items completed, total files modified, tests passing, any items skipped and why
