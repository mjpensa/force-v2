# Phase 2 Compliance Report

Baseline measured over 20 captured responses in tests/golden/.
Produced with zero API calls. Re-run after any prompt change and compare.

## Schema conformance

17 of 20 captures satisfy the schema the app declared.

- **narrative-spine-1.json** (narrative-spine)
  - / missing:analyticalFramework
  - / missing:recommendedAction
  - / missing:tensionPair
  - /keyClaims/* missing:evidence
  - /keyClaims/* missing:stake
- **narrative-spine-2.json** (narrative-spine)
  - / missing:analyticalFramework
  - / missing:recommendedAction
  - / missing:tensionPair
  - /keyClaims/* missing:evidence
  - /keyClaims/* missing:stake
- **speaker-notes-1.json** (speaker-notes)
  - /slides/* missing:anticipatedQuestions
  - /slides/* missing:sourceAttribution
  - /slides/*/narrative missing:keyPhrase

Gemini does not enforce `required`. Any consumer reading these fields gets undefined.

## Slide rule compliance

**slides-1.json** — 50 slides, 32 issues
- by field: paragraph2 18, paragraph1 9, paragraph3 1, tagline 4
- paragraphs outside the 380-410 target: 112/120 (93%)
- paragraphs over the 450 ceiling: 27/120 (23%)
- median paragraph length: 440 chars

**slides-2.json** — 27 slides, 45 issues
- by field: paragraph1 15, paragraph2 18, paragraph3 10, tagline 2
- paragraphs outside the 380-410 target: 66/67 (99%)
- paragraphs over the 450 ceiling: 43/67 (64%)
- median paragraph length: 464 chars

## Narrative spine (injected into every downstream prompt)

**narrative-spine-1.json** — renders 410 chars, 0 literal "undefined"
- schema fields present: coreThesis, keyClaims
- claims carrying evidence: 0/1

**narrative-spine-2.json** — renders 408 chars, 0 literal "undefined"
- schema fields present: coreThesis, keyClaims
- claims carrying evidence: 0/1

## Document editorial quality

**document-1.json** — 3 sections
- executive summary issues: 4
- section openers: 2 weak, 0 strong, of 3

**document-2.json** — 7 sections
- executive summary issues: 2
- section openers: 2 weak, 1 strong, of 7

## Domain-prior leakage

The prompt layer bakes in one fictional case (JPMorgan / ISDA CDM / DRR). Captures
mentioning those terms whose source research was on another topic indicate the prior
is teaching content, not just form.

No occurrences in any capture.

