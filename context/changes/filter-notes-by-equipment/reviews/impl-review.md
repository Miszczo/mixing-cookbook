<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Filter listening notes by equipment

- **Plan**: context/changes/filter-notes-by-equipment/plan.md
- **Scope**: Full plan (2 of 2 phases)
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria re-run during review: unit tests 27/27, lint, `astro check` (0/0/0), build all green; `npm test` 131/131 at phase 2 gate. All Progress rows are `[x]` with SHAs.

## Findings

### F1 — `*` wildcard can crowd true matches out of the 201-row window

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/notes.astro:22-27, 36, 48-50
- **Detail**: PostgREST rewrites every `*` in an `ilike` value to `%` and it cannot be escaped, so a filter such as `Mic*` is a wildcard prefilter. The DB limit (201 newest) is applied before the JS `sameEquipment` re-check, so with 201+ newer over-matching rows the true matches are never fetched, `hasMore` is computed after the JS filter, and the page can show a wrong "No notes for this equipment." Reachable via a hand-typed URL or a stored name containing `*`. Plan already documented the `*` limitation and chose the JS re-check as mitigation; without `*` the prefilter is exact. Related, lower risk: SQL `ilike` case folding depends on DB collation and does not trim, while the JS re-check does (the insert schema trims, so this is theoretical; local/default `en_US.UTF-8` passes the `SAMOCHÓD` test).
- **Fix**: Compare in SQL without `*` rewriting, e.g. `.filter("equipment", "imatch", "^" + escapeRegex(filter) + "$")`.
  - Strength: exact case-insensitive match in the database, no crowding, JS re-check becomes a safety net.
  - Tradeoff: new regex-escape helper + a test for `*`; regex case folding also depends on collation.
  - Confidence: MED — not run against the real PostgREST here.
  - Blind spot: whether `imatch` handles Polish letters the same as `ilike` on the target DB.
- **Decision**: FIXED — via exactMatchRegex + imatch in notes.astro; tests added (uncommitted)

### F2 — Equipment select reads 1000 rows, not distinct names

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/notes.astro:30-34, src/lib/listening-notes.ts:36
- **Detail**: The names read takes the newest 1000 note rows. Names used only on older notes silently disappear from the select (not reported as a failure). The plan accepted this scale for a personal tool; those notes stay reachable via a typed `?equipment=`.
- **Fix**: When the names read returns exactly `MAX_EQUIPMENT_SCAN` rows, show a short "Equipment list may be incomplete" notice.
- **Decision**: FIXED — notice when names read hits MAX_EQUIPMENT_SCAN (uncommitted; not covered by a test)

### F3 — Test gaps around the risky paths

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/listening-notes-overview-http.test.ts
- **Detail**: Not covered: `*`, `_` and `\` literals, the >200 "more" message / LIMIT+1 behaviour, failure alert paths, and track names on items 3-4 of the first scenario. All 7 planned scenarios are present; these gaps go beyond the plan.
- **Fix**: Add a `*` case alongside the fix for F1.
- **Decision**: FIXED — added `_` / `\` literal tests; `*` covered under F1; >200 message and alert paths left untested (uncommitted)

### F4 — Nav may overflow on very narrow phones

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/layouts/AppLayout.astro:9-14
- **Detail**: Five links in a non-wrapping `flex gap-4` nav; no `aria-current`. Manual check 2.7 (phone width) passed.
- **Fix**: Add `flex-wrap` to the nav.
- **Decision**: FIXED — flex-wrap on main nav (uncommitted)
