# Coverage Policy

## Why the percentage dropped (it didn't)

Before 2026-08-07 the coverage denominator included `Public/dist/main.min.js` and
`Public/dist/viewer.min.js` — **2,259 of 8,600 statements, 26% of the total**. Those are
esbuild output: minified duplicates of source files already counted, and `dist/` is
gitignored.

That produced two problems:

1. **The number was nondeterministic.** `Public/dist/*` exists locally after `npm run build`
   but never in CI, which runs only `npm ci`. Local and CI coverage were measured against
   different denominators, so no threshold could be correct in both.
2. **The incentive was backwards.** Deleting browser code raised coverage more than testing
   server code, and re-running the build regenerated 2,259 permanently-uncoverable statements.

`collectCoverageFrom` now excludes `Public/dist/**` and `**/*.min.js`. The denominator is
6,382 statements. Nothing was deleted and no tests were removed.

The stale `!server/prompts.js` exclusion was also dropped — that file no longer exists.

## Why thresholds are per-area

A single global number averaging a ~53%-covered server against a ~3%-covered browser tree
describes neither. It also dilutes: every new server test moves the global number by a
fraction of its real effect, because the untested client mass outweighs it roughly 3:1.

Jest subtracts path-keyed files from the `global` pool, so `global` in `jest.config.js` is
the **server remainder** (`server/**` minus `utils.js` and `generators.js`), not the whole
tree.

| Group | Threshold (stmt/branch/func/line) | Actual at time of writing |
|---|---|---|
| `global` (server remainder) | 51 / 41 / 48 / 52 | 53.2 / 44.2 / 50.0 / 54.3 |
| `./server/generators.js` | 87 / 75 / 95 / 88 | 89.2 / 77.5 / 97.4 / 89.9 |
| `./server/utils.js` | 100 / 100 / 100 / 100 | 100 |
| `./Public/` | 2 / 2 / 2 / 2 | 2.9 / 2.8 / 2.9 / 2.7 |

Every number sits just under its measured actual. CI went green on the first commit with
**zero new tests written for the purpose** — the point was to get an honest gate in place
before producing changes that need gating, not to manufacture a number.

`generators.js` is held high deliberately: it is the target of the Phase 3 consolidation, and
the threshold is what stops that refactor from quietly shedding coverage.

`./Public/` is a floor, not a target. It exists so the number can only move one way.

## The ratchet rule

1. **Never lower a threshold.** A change that reduces coverage in any group fails CI. That is
   the entire mechanism.
2. **Raise on merge** when `actual - threshold >= 3` for a group: set the threshold to
   `floor(actual) - 1`. The 3-point deadband absorbs the jitter of adding a new source file.
3. **New untested files fail.** A file added under `Public/components/views/`, `Public/gantt/`,
   or `server/templates/` with 0% coverage should fail review — cheaper to enforce than any
   percentage rule, and it stops the client growing faster than its tests.

## What this policy explicitly does not ask for

Raising `./Public/` to a high number by writing jsdom tests against ~6,300 statements of DOM
code to satisfy a threshold. That is weeks of work for near-zero defect detection.

The client floor rises as a **byproduct** of the Phase 2 work — extracting the shared
`flattenSlideDeck()`, unifying the truncation constants, and adding golden-replay tests for
the exporters all move logic out of the browser-only zone and into the node-testable one.
Coverage earned that way corresponds to real defect detection.

## Running it

```bash
npm test           # fast, no coverage (~17s) — the inner loop
npm run test:coverage   # coverage report, no CI flags
npm run test:ci    # coverage + thresholds — this is the gate CI runs
```

`npm test` deliberately does not collect coverage. An 86-second inner loop across a
multi-week refactor pushes you toward running tests less often, exactly when you need them
most.
