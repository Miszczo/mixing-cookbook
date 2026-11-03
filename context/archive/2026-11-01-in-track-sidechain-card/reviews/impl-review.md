<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: In-Track Sidechain Card

- **Plan**: context/changes/in-track-sidechain-card/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-03
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria run during review: `npm test` (8 files / 27 tests), `npm run lint`, `npx astro check` (0 errors), `npm run build` all pass. Manual steps 3.5–3.8 were confirmed by the owner. The 10 changed files are exactly the planned set; no scope-fence violations.

## Findings

### F1 — Recipe lookup returns the first recipe matching either condition

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/tracks/[id].astro:53-55
- **Detail**: `RECIPES.find(c => c.id === requested || stored.some(...))` returns the first recipe in list order that matches either condition. With a second recipe, `?recipe=B` would show A whenever A has stored progress and comes earlier. Harmless today (one recipe), but S-05 will add more.
- **Fix**: Look up the requested recipe first: `RECIPES.find(id === requested) ?? RECIPES.find(stored)`.
- **Decision**: FIXED — lookup now prefers the requested recipe, then falls back to stored progress (tracks/[id].astro:53-55); lint, astro check and recipe-card-http pass

### F2 — Toggle-step read-modify-write can lose a step on concurrent clicks

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/tracks/[id]/recipes/[recipeId].ts:72-119
- **Detail**: Two concurrent toggles (double click, two tabs) read the same array and the last write wins. The plan documents this explicitly ("two rapid clicks can lose a step, which a refresh shows and a click repairs"), so this is an accepted risk, not drift. Not covered by a test.
- **Fix A ⭐ Recommended**: Keep as planned; revisit if S-05 or later adds client-side toggling.
  - Strength: Matches the plan and the single-owner, single-page assumption.
  - Tradeoff: Rare lost click stays possible.
  - Confidence: HIGH — documented in the plan.
  - Blind spot: Real-world double-click frequency is unmeasured.
- **Fix B**: Atomic SQL (`array_append`/`array_remove` RPC, `security invoker`).
  - Strength: Removes the race entirely.
  - Tradeoff: New migration and RPC; deviates from the plan's upsert design.
  - Confidence: MEDIUM — RPC plus RLS interplay not verified.
  - Blind spot: Whether the extra complexity is worth it for one owner.
- **Decision**: ACCEPTED — Fix A: documented in the plan as a known last-write-wins risk; revisit if toggling becomes client-side

### F3 — Recipe tests create nine users per run against the auth rate limit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/recipe-card-http.test.ts:42-45, 128-130
- **Detail**: The file makes about 18 auth calls; `supabase/config.toml` allows 30 sign-ins/sign-ups per 5 minutes per IP, shared with the other HTTP and RLS test files. A full run passed here, but back-to-back runs could hit a 429.
- **Fix**: Reuse users across tests where tracks are already separate, or raise the local rate limit in the test config.
  - Strength: Removes a flake source.
  - Tradeoff: Slightly less isolation between tests.
  - Confidence: MEDIUM — the limit was read from config, a 429 was not reproduced.
  - Blind spot: Other files' call counts were not summed.
- **Decision**: FIXED — recipe-card-http now reuses users across tests (9 -> 6 accounts, 18 -> 12 auth calls); full npm test passes

### F4 — Every step toggle returns the page to the top

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/recipes/RecipeCard.astro:46, 84; src/pages/api/tracks/[id]/recipes/[recipeId].ts:124
- **Detail**: Server-form POST with a 303 to the page loses scroll and focus, so a keyboard or screen-reader user starts over after each of the six steps. The plan chose server forms with no client JS, so this follows the plan.
- **Fix**: Redirect to `?recipe=<id>#recipe-title` with `tabindex="-1"` on the heading. The tests assert the exact `location`, so they need updating too.
  - Strength: Keeps server forms, restores position.
  - Tradeoff: Changes the redirect contract the plan states.
  - Confidence: MEDIUM — browser anchor and focus behaviour not tried here.
  - Blind spot: Not tested on a real screen reader.
- **Decision**: ACCEPTED — follows the plan's server-form, no-client-JS decision; revisit with the accessibility pass

### F5 — Direct PostgREST calls can store junk, and some denials are untested

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261101130000_track_recipe_progress.sql; tests/recipe-progress-rls.test.ts
- **Detail**: Only the route validates step ids, plugin type and Miks stage. A signed-in user can fill their own row with an unbounded `completed_steps` array. `selectTool` ignores bad values, so there is no functional harm and no cross-user exposure. The RLS test has an anonymous read check but no anonymous insert/update, no spoofed `user_id` insert, and no `track_id` move.
- **Fix**: Add `check (cardinality(completed_steps) <= 50)` in a follow-up migration and the three missing denial tests.
- **Decision**: PARTIALLY FIXED — added tests for anon insert/update, spoofed user_id, moving track_id and delete (npm test 30/30); the 50-step cap in the database was left out as beyond this change

### F6 — Chooser `details` is open only when no card is shown

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/tracks/[id].astro (`details open={!recipe}`)
- **Detail**: The plan says the card "opens" when the parameter or progress row exists. The card renders outside the `details`, which collapses once the card shows. This is a reasonable reading and the owner confirmed the flow manually; the plan is silent on whether the chooser should stay open.
- **Fix**: Leave as is, or note the behaviour in the plan.
- **Decision**: DISMISSED — reasonable reading of the plan, confirmed by the owner in manual steps 3.5-3.8


