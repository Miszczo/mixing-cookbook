<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Runner and Access Boundary Implementation Plan

- **Plan**: context/changes/testing-runner-access-boundary/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-20
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Cookbook claims a 401 body the HTTP test does not assert

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:113
- **Detail**: §6.2 and §6.6 say anonymous `GET /api/isolation/probes` is 401 with body `{ error: "unauthorized" }` and without the note. `tests/isolation-access-http.test.ts` asserts status 401 and that the body does not contain the note. It does not assert the error JSON. Phase 2 required the note-absence check and said that JSON must not be the only assertion. The shipped test matches that contract; the cookbook overclaims a body equality the suite does not prove.
- **Fix A ⭐ Recommended**: Rewrite the 401 lines in §6.2 and §6.6 to status 401 plus note absence, and keep `{ error: "unauthorized" }` off the required proof.
  - Strength: Matches `isolation-access-http.test.ts` and the phase 2 contract.
  - Tradeoff: Drops a shape check the next author might copy from the handler.
  - Confidence: HIGH — the test file has no equality check on that JSON.
  - Blind spot: None significant.
- **Fix B**: Also expect the anonymous body to equal `{ error: "unauthorized" }`, in addition to the note-absence check.
  - Strength: Makes the cookbook and the suite say the same thing.
  - Tradeoff: Ties the proof to the current error string, which the plan treated as the wrong sole assertion.
  - Confidence: MEDIUM — the handler does return that JSON today, but this review did not re-read the handler as a contract.
  - Blind spot: A later copy change would fail a test the plan did not require.
- **Decision**: FIXED via Fix A

### F2 — Dev server stop can return while the process is still alive

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/isolation-access-http.test.ts:133
- **Detail**: `stopApp` resolves after 8 seconds even if `astro dev` has not exited. On Windows a failed `taskkill` only calls `child.kill()` from the spawn `error` event, not from a non-zero exit. This run's `npm test` exited 0 in about 19 seconds, so teardown succeeded here. A later failed kill can leave workerd running.
- **Fix**: After the kill attempt, reject `stopApp` if the child is still alive, and treat a non-zero `taskkill` exit as failure.
- **Decision**: FIXED

### F3 — Vitest config wraps getViteConfig and drops the Cloudflare dev plugin

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: vitest.config.ts:13
- **Detail**: The plan says `vitest.config.ts` exports `getViteConfig` from `astro/config` with `test.environment` `node`. The file calls `getViteConfig` with `environment: "node"`, then the default export strips plugin `vite-plugin-cloudflare:dev`. That keeps Vitest from booting a second workerd. The HTTP file still starts `astro dev` itself. No jsdom.
- **Fix**: Leave the wrapper. Record it on the plan as the reason Vitest does not load the Cloudflare dev plugin.
- **Decision**: FIXED
