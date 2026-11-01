<!-- PLAN-REVIEW-REPORT -->
# Plan Review: In-Track Sidechain Card

- **Plan**: context/changes/in-track-sidechain-card/plan.md
- **Mode**: Deep
- **Date**: 2026-11-01
- **Verdict**: REVISE, then SOUND after the fixes below
- **Findings**: 0 critical 4 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 7/7 existing paths ✓, 4/4 cited references ✓, Progress↔Phase 15/15 ✓, brief↔plan ✓. The nested route was confirmed not to collide, and `public/` files are served in dev and preview.

Triage was done by the agent under the owner's standing instruction not to wait for routine decisions. All fixes are plan edits.

## Findings

### F1 — Another user's plugin id can be stored directly

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Migration
- **Detail**: Foreign key checks bypass RLS, and the policy checked only the track. A direct PostgREST call could store another user's plugin uuid and learn from the error whether it exists. The route check covers HTTP only.
- **Fix**: Require in the insert and update checks that `selected_plugin_id` is null or owned by the user, and test it.
- **Decision**: FIXED via Fix

### F2 — Write contract left details to guesswork

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Migration and progress route
- **Detail**: The plan did not say that upserts must carry `user_id` and `updated_at`, that `choose-tool` must write both choice columns, that the payload must be a single object, or that the update policy needs `using` as well as `with check`.
- **Fix**: State each of these in the migration and route contracts.
- **Decision**: FIXED via Fix

### F3 — HTTP tests can run against the wrong server

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — HTTP test; tests/helpers/http-app.ts:101
- **Detail**: With a dev server running, `astro dev` exits and prints that server's URL, and the helper accepts any local URL. By code reading, tests would then run against the other server rather than fail. This was not reproduced through the helper itself.
- **Fix**: Make the helper reject a port other than the reserved one, and record that local `npm test` needs `astro dev` stopped.
- **Decision**: FIXED via Fix

### F4 — Migration notes overstated what is automatic

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Migration Notes; Phase 2 success criteria
- **Detail**: The plan said local and production apply the migration automatically. A running local stack needs a command, and nothing in the repo applies migrations to production.
- **Fix**: Correct the notes, use `npx supabase migration up --local`, and list production as a manual step in the brief.
- **Decision**: FIXED via Fix

### F5 — Rapid step toggles can lose a step

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Progress route
- **Detail**: `toggle-step` reads and rewrites the array, so two very quick clicks can lose one. Each click is a full page POST by one owner, so this is unlikely, and a refresh shows it.
- **Fix**: Record last-write-wins in the plan, without an atomic update.
- **Decision**: ACCEPTED, recorded in the plan

### F6 — Saving the track closes an unstarted card

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Track page
- **Detail**: The track edit route redirects to the bare URL, so `?recipe=` is dropped. A card with no stored progress closes, and nothing is lost.
- **Fix**: Record this behaviour in the plan and leave the edit route unchanged.
- **Decision**: ACCEPTED, recorded in the plan

### F7 — Ordering claim was stronger than the design

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries; brief Key Decisions
- **Detail**: The plan said the suggestion reads the same as `/plugins`, but `/plugins` sorts with the database collation and `selectTool` sorts in JavaScript. Unusual names can differ.
- **Fix**: Claim the same rule rather than the same order, and pin the JavaScript comparator in tests.
- **Decision**: FIXED via Fix
