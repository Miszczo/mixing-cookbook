<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Per-user row isolation

- **Plan**: context/changes/per-user-row-isolation/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-09-26
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Findings

### F1 — smoke.mjs fails prettier, so lint does not pass

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:36
- **Detail**: `npm run lint` exits 1 with 6 `prettier/prettier` errors in `scripts/smoke.mjs` (lines 36, 60, 110, 115, 138, 152). Progress marks 1.2 and 2.2 done, but phase 3 reformatted the smoke steps and the current tree no longer passes lint. `npx astro check` passes (0 errors). `BASE_URL=http://localhost:4321 npm run smoke` passes all 20 steps against the running dev server and local Supabase (B-misses-A, both `starter-visible`, catalog POST 403).
- **Fix**: Run `npx eslint --fix scripts/smoke.mjs` and re-run `npm run lint`.
- **Decision**: FIXED

### F2 — Missing probe id still lets later isolation steps PASS

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs:80
- **Detail**: If the user A insert does not return a string `id`, `probeIdA` stays `null` and the script continues. User A's own list check fails (`p.id === null` does not match), so the process still exits 1. User B's miss check is vacuously true (`!probes.some(p => p.id === null)`), and `GET /api/isolation/probes/null` hits uuid validation and returns 404, so those two lines print PASS without proving isolation.
- **Fix**: After the 201 step, fail the run immediately when `probeIdA` is not a string, before the B isolation steps.
- **Decision**: FIXED

### F3 — Catalog smoke 403 does not hit PostgREST

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/isolation/catalog.ts:42
- **Detail**: `POST /api/isolation/catalog` returns `{ error: "forbidden" }` with status 403 and never calls `.insert()`. That matches the plan. A later grant of `INSERT` on `isolation_catalog` would not fail this smoke step. Write denial for `authenticated` is in the migration (`revoke all`, then `grant select` only), which manual step 1.3 already covers.
- **Fix**: No code change. Keep the HTTP 403 as the route contract; treat the migration grants as the write-denial proof.
- **Decision**: FIXED
