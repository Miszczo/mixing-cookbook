<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Track Name and Stage

- **Plan**: context/changes/track-stage-status/plan.md
- **Scope**: Full plan (plan has no numbered phases; 4 Progress items, all [x])
- **Reviewed phases**: none (no numbered phases)
- **Date**: 2026-11-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 3 warnings 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Checks run: `eslint` on track files and the HTTP test (clean), `npx astro check` (0 errors), `vitest run tests/plugins-tracks-http.test.ts` (2/2 passed, local Supabase). Manual check of `/tracks` confirmed by the project owner on 2026-11-01.

## Findings

### F1 — `formData()` not guarded in track routes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/tracks/index.ts:18, src/pages/api/tracks/[id].ts:25
- **Detail**: `request.formData()` throws on a non-form body, giving a signed-in caller an unhandled 500. Plugin routes (fixed in d89d927) and the profile route guard this call.
- **Fix**: Wrap in try/catch as in the plugin routes, so a bad body takes the existing `invalid_track` redirect.
- **Decision**: FIXED via Fix (try/catch in both track routes; regression test added)

### F2 — Truncating a long name can make `encodeURIComponent` throw

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/tracks/index.ts:22, src/pages/api/plugins/index.ts:27
- **Detail**: `name.slice(0, 100)` can split an emoji, and `encodeURIComponent` then throws `URIError: URI malformed` (reproduced in Node on the expression, not through the route). Reaching it takes an over-long name, so mostly a direct POST, because the form sets `maxlength="100"`. The effect is a 500 on the caller's own request. The plugin route has the same bug.
- **Fix**: Truncate by code point in both routes: `Array.from(name).slice(0, 100).join("")`.
- **Decision**: FIXED via Fix (code-point truncation in tracks and plugins routes; regression tests added)

### F3 — A rejected edit does not keep the typed text

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/tracks/[id].ts:28, src/pages/tracks/[id].astro:31
- **Detail**: The plan's Proof line says rejected input keeps typed text, without limiting it to create. Create keeps it. Edit redirects with only `?error=invalid_track`, and the form shows the stored name. The test covers only create.
- **Fix A ⭐ Recommended**: Narrow the plan's claim to create
  - Strength: `maxlength` and the fixed stage list block other invalid edits in the browser. The one that gets through is a whitespace-only name (`required` allows it, `trim().min(1)` in src/lib/tracks.ts:14 rejects it), and that text is not worth keeping.
  - Tradeoff: Direct POSTs with an over-long name still lose the text, which affects no form user.
  - Confidence: MED — based on reading the form and schema, not on a browser run.
  - Blind spot: None significant.
- **Fix B**: Pass the typed name through the redirect, as create does, and add a test
  - Strength: Makes create and edit behave the same and satisfies the plan as written.
  - Tradeoff: More code and a new test on a low-traffic path, with the deadline close.
  - Confidence: HIGH — the create route already shows the pattern.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A (plan Proof line narrowed to rejected create; no code change)

### F4 — Track tests miss several boundaries

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/plugins-tracks-http.test.ts:101
- **Detail**: Every claim in the Proof line has a matching assertion for create, but there is no anonymous POST to `/api/tracks` or `/api/tracks/[id]`, even though the handler check is the only gate there. The plugin test has this assertion. Also uncovered: the saved stage after create, a rejected edit, a non-form body, and the other user's list.
- **Fix**: Add anonymous POST 401 assertions, the saved stage after create, and a non-form body case.
- **Decision**: FIXED via Fix (anonymous POST 401s, saved stage after create, non-form bodies)

### F5 — Grants cover whole table columns

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261101120100_tracks.sql:37
- **Detail**: A signed-in user calling PostgREST directly can set `created_at`, `updated_at`, or `id` on their own rows. Ownership stays safe, because the UPDATE policy has both USING and WITH CHECK. The plugin migration does the same.
- **Fix**: Accept for the MVP; column-level grants would be a later migration on both tables.
- **Decision**: SKIPPED

### F6 — Track list query is unbounded

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/tracks/index.astro:12
- **Detail**: No limit or pagination. Rows are per user and `tracks_user_id_idx` exists, so the risk is low at MVP scale. `src/pages/plugins.astro` behaves the same.
- **Fix**: Accept for the MVP; add a limit if track counts grow.
- **Decision**: SKIPPED

### F7 — A row that fails schema parsing shows as not found

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/tracks/[id].astro:12
- **Detail**: `loadFailed` reflects only `result.error`, so a returned row that fails `trackRowSchema` gives a 404, while the list page treats that case as a load failure. It needs the migration and `TRACK_STAGES` to drift apart, which S-04 does not plan to do.
- **Fix**: Set `loadFailed` when a row is returned but fails parsing.
- **Decision**: FIXED via Fix (loadFailed set when a returned row fails parsing; not covered by a test)
