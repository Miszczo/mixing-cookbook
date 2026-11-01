# Runner and Access Boundary Implementation Plan

## Overview

Stand up Vitest and prove rollout Phase 1 of `context/foundation/test-plan.md` ("Runner i granica dostępu"). A second signed-in user must not receive the first user's `isolation_probes.note`. A signed-out request must not receive dashboard content or that note, and the owner must still receive their own note. The proofs target the failure path in `research.md`, not the plugin, screenshot, or track nouns in the risk sentences.

## Current State Analysis

`public.isolation_probes` is the only owner-scoped table. `GET /api/isolation/probes` selects `id, note` with no `user_id` predicate, so cross-user denial is the SELECT policy `user_id = (select auth.uid())` on role `authenticated`. `scripts/smoke.mjs` signs user B in, expects HTTP 200, and checks that user A's probe id is absent. It does not assert the note string. Those smoke steps still pass if a later handler adds `.eq("user_id", ...)` and the SELECT policy is removed.

`PROTECTED_ROUTES` is `["/dashboard"]`. The anonymous redirect to `/auth/signin` applies only to that prefix. The isolation handlers are outside it and return 401 JSON when `locals.user` is null, before querying. `src/pages` has no track route. The signed-in stand-in this tree can prove is the owner's probe note, plus `GET /dashboard` for an authenticated session.

`package.json` has `smoke` and no `test` script. Vitest, Jest, and Playwright are not installed. CI already runs lint, `astro check`, build, and `npm run smoke` against local Supabase. Test-plan Phase 4, not this change, wires the new suite into CI. `[auth.email] enable_confirmations` is `false` in `supabase/config.toml`, which is why sign-up followed by password sign-in works in smoke.

There is no `service_role` environment variable in the files research searched, and this change must not add one. The app client is `SUPABASE_URL` plus `SUPABASE_KEY` (the anon key, per `README.md` and the CI smoke job).

## Desired End State

`npm test` runs two integration proofs against local Supabase and exits 0. User A's own select of `isolation_probes` contains the note this run inserted. User B's select of `id, note`, issued with B's session and no `user_id` predicate, does not contain that note. Separately, HTTP against a server the suite starts shows: signed-out `GET /dashboard` is 302 to `/auth/signin` and the body does not contain `This page is only for authenticated users.`; signed-out `GET /api/isolation/probes` is 401 and the body does not contain the inserted note; the owner's list is 200 and contains that note; user B's list is 200 and does not contain it. `context/foundation/test-plan.md` §6.1, §6.2, and §6.6 describe those patterns. `npm run lint` and `npx astro check` still exit 0. Smoke and CI are unchanged.

### Key Discoveries:

- List query has no owner filter: `src/pages/api/isolation/probes.ts:26`. Owner SELECT policy: `supabase/migrations/20260923171212_per_user_row_isolation.sql:24-28`. User B's list is specified as HTTP 200 (`scripts/smoke.mjs:115-120`), so a 401 does not prove risk #1.
- By-id filters on `id` only (`src/pages/api/isolation/probes/[id].ts:29-33`) and maps a missing row to 404 (`:40-41`). A 404 without reading the body is not the proof that survives a later `user_id` filter on the handlers.
- Middleware redirect is prefix `/dashboard` only (`src/middleware.ts:4`, `:18-21`). Dashboard copy to keep out of the anonymous body is `This page is only for authenticated users.` (`src/pages/dashboard.astro:16`).
- Cookie client: `src/lib/supabase.ts:5-20`. Smoke uses one jar and signs A out before B (`scripts/smoke.mjs:9`, `:103-113`). The session-select proof needs both sessions.
- Astro's installed package exports `getViteConfig` from `astro/config` (`node_modules/astro/dist/config/entrypoint.js`). `astro@7.3.2` declares `vitest` `^4.1.0` in its own devDependencies. The testing guide (Context7 `/withastro/docs`, checked 2026-10-07) uses `getViteConfig` and the `node` environment, not jsdom.
- AI-native / vision checks stay out. Test-plan §4 records Playwright MCP checked 2026-10-07 and rejects a vision layer because the note text and the owner are deterministic assertions.

## What We're NOT Doing

- Wiring the suite into `.github/workflows/ci.yml`. That is test-plan Phase 4.
- Rewriting `scripts/smoke.mjs` so smoke becomes this proof. Smoke may keep its current id check.
- Product tables or routes for plugins, screenshots, listening notes, or tracks. They are not in this tree.
- Catalog behavior. `isolation_catalog` SELECT is `using (true)`; a shared row is not evidence for risk #1.
- Adding `/api/isolation` to `PROTECTED_ROUTES`. Isolation routes keep their own JSON status codes.
- A `service_role` key, a policy-text assertion on `ENABLE ROW LEVEL SECURITY`, or a unit test that mocks `@/lib/supabase`, `createClient`, or `locals.user`.
- jsdom, Astro container snapshot tests, and a Playwright MCP or vision layer.
- A test whose only page is `/auth/signin`.
- An assertion that user B's probe list is empty. B must not receive A's note; B may have other rows.
- Edits to test-plan §1–§5, §6.3–§6.5, or §7.

## Implementation Approach

Cost × signal puts the durable risk-#1 proof first. Vitest 4 loads the Astro Vite config through `getViteConfig`, with the test environment `node`. Integration tests use the anon key against local Supabase. If `SUPABASE_URL` or `SUPABASE_KEY` is still missing after the suite loads the repo `.env`, the suite throws. It does not call `it.skip` or `describe.skip`.

Phase 1 creates two auth users with `supabase-js` (`signUp` then `signInWithPassword`). User A inserts one short unique note with `user_id` set to A's id. A's select of `id, note` must contain that note. Only then does B's select of `id, note`, with no `user_id` predicate and no other owner filter, assert the note is absent. That select is not `GET /api/isolation/probes`. It still fails if a later handler filters on `user_id` and the SELECT policy is gone.

Phase 2 pays for HTTP. The suite starts and stops the app server itself (workerd, the same path as `npm run dev`) on a port it chooses, then `fetch`es with `redirect: "manual"` and cookie jars built from `Set-Cookie`. Signed-out requests use an empty jar. The owner's note is inserted through `POST /api/isolation/probes` and observed on the owner's list before the signed-out and user-B assertions. User B's list must be HTTP 200. The by-id 404 is a boundary of the current read path: the body must not contain the note, and this status is not a substitute for the phase-1 select.

Phase 3 writes the patterns that actually shipped into the cookbook. It does not restate §1–§5.

## Critical Implementation Details

- **Vacuous absence.** Assert the inserted note is present for the owner before asserting it is absent for anyone else. If the insert did not store the note, fail the test. An empty foreign list is not a pass.
- **Phase 1 is not the handler.** B's select goes through B's user JWT to PostgREST. A test that only calls the list route stays green under the handler-filter-plus-dropped-policy regression that `research.md` names.
- **Do not stub the session for HTTP.** `getViteConfig` merges the Cloudflare adapter. Importing the route module and setting `locals.user` skips middleware and the cookie client. The HTTP proof is a real response from the server the suite started. `dev()` from `astro`, or a child process running `astro dev` on the suite's port, both satisfy that contract.
- **401 is the wrong branch for user B.** Risk #1's list check is HTTP 200 without A's note. Risk #4's anonymous probe check is a different request: HTTP 401 whose body does not contain the note.
- **One server for the HTTP file only.** Do not start the app server for the phase-1 select test.

## Phase 1: Runner and owner-scoped select

### Overview

**Behavior asserted:** User A's select of `isolation_probes` (`id, note`) contains the note this run inserted. User B, signed in, selects `id, note` with no `user_id` predicate and does not receive that note.

**Regression caught:** The SELECT policy is removed, including the case where the list handler later filters on `user_id` and `scripts/smoke.mjs:115-122` still passes. Also caught: A's insert never stored the note, so B's miss would otherwise be vacuous.

**Research source:** `research.md` Summary and "Risk #1"; `src/pages/api/isolation/probes.ts:26`; `supabase/migrations/20260923171212_per_user_row_isolation.sql:24-28`; `scripts/smoke.mjs:115-122`; `package.json:5-14`.

**Edge / error / boundary:** B is authenticated, so the result is a row set, not a 401. The assertion is "A's note is absent", not "B's list is empty". A missing `SUPABASE_URL` or `SUPABASE_KEY` fails the run. The note is unique to the run and short enough to satisfy the HTTP note rule in phase 2 (`1..200` characters).

**Anti-pattern avoided:** Mocking the ownership check, asserting only HTTP 200, treating `ENABLE ROW LEVEL SECURITY` or a bare 401 as the proof, and skipping the test when Supabase is down.

### Changes Required:

#### 1. Vitest runner

**File**: `package.json`, `package-lock.json`, `vitest.config.ts`

**Intent**: Add a non-watch test script and Vitest 4 so later phases have a runner that loads this app's Vite config, including the `@/` alias and server env wiring.

**Contract**: `scripts.test` is `vitest run`. The direct devDependency is `vitest` `^4.1.0`, the major `astro@7.3.2` already declares in its own devDependencies. `vitest.config.ts` exports `getViteConfig` from `astro/config` with `test.environment` set to `node`. The default export awaits that config and removes plugin `vite-plugin-cloudflare:dev` so Vitest does not start a second workerd. The HTTP file starts `astro dev` itself. Do not set jsdom. Do not add a `test` script that shells out to `scripts/smoke.mjs`.

#### 2. Env guard and the session select

**File**: `tests/isolation-probes-rls.test.ts`

**Intent**: Prove the owner SELECT policy with two real sessions. The test fails closed when the anon connection settings are missing, and it fails when A's note is not actually stored.

**Contract**: Read `SUPABASE_URL` and `SUPABASE_KEY` from the process environment, loading the repo `.env` only when a name is unset. If either value is empty after that, throw before any query. Do not read or introduce a service-role variable. Create two users with the anon client (`signUp`, then `signInWithPassword`), relying on `enable_confirmations = false`. Insert A's row with `user_id` equal to A's auth user id and a run-unique note. A's `.from("isolation_probes").select("id, note")` must include that note. B's `.from("isolation_probes").select("id, note")` must not add `.eq("user_id", ...)` or any other owner predicate, and the returned notes must not include A's note. Do not import `src/pages/api/isolation/probes.ts` for this assertion. Do not mock the Supabase client. Cleanup, if any, uses the owner's JWT. A cleanup failure must not convert a failed assertion into a pass. Keep this file free of an app-server start.

### Success Criteria:

#### Automated Verification:

- `npm test` exits 0 against local Supabase when `SUPABASE_URL` and `SUPABASE_KEY` are the anon key, and `tests/isolation-probes-rls.test.ts` shows user A's select of `id, note` contains the note this run inserted before it asserts user B's select of `id, note` with no `user_id` predicate does not contain that note
- `npm run lint` exits 0
- `npx astro check` exits 0

#### Manual Verification:

- With `SUPABASE_URL` unset and the repo `.env` not supplying it, `npm test` exits non-zero and does not report skipped tests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: HTTP dashboard and probe gates

### Overview

**Behavior asserted:** Signed-out `GET /dashboard` redirects to `/auth/signin` and the response body does not contain `This page is only for authenticated users.` Signed-out `GET /api/isolation/probes` returns 401 and the body does not contain the note this run inserted. The signed-in owner receives that note on the list. User B's list is HTTP 200 and does not contain it.

**Regression caught:** An anonymous caller receives dashboard HTML or a probe note. A signed-in owner cannot see their own note. A test of `/auth/signin` alone, or a belief that the dashboard redirect also closes `/api/isolation`, leaves the API gate unproved. User B's list returning 401 would assert the signed-out branch instead of a signed-in miss.

**Research source:** `research.md` "Risk #4" and Architecture Insights; `src/middleware.ts:4`, `:18-21`; `src/pages/dashboard.astro:16`; `src/pages/api/isolation/probes.ts:17-18`, `:26`; `src/pages/api/isolation/probes/[id].ts:29-41`; `scripts/smoke.mjs:55-56`, `:72`, `:85-91`, `:115-122`.

**Edge / error / boundary:** `redirect: "manual"` so a followed redirect cannot hide dashboard HTML. The anonymous probe check uses the same note already observed on the owner's list, so a 401 with an empty body is not a pass merely because no note existed. User B's `GET /api/isolation/probes/<A's id>` is 404 and the body does not contain the note. That 404 documents the current by-id path (404, not 403). It is not the proof that survives a later handler `user_id` filter; phase 1 is that proof. B's list assertion is absence of A's note, not an empty `probes` array.

**Anti-pattern avoided:** A test that only opens `/auth/signin`. Treating the dashboard redirect as coverage of the API. Asserting a 401 or a 404 status without checking that the body lacks the note. Mocking `locals.user`.

### Changes Required:

#### 1. HTTP access test

**File**: `tests/isolation-access-http.test.ts`

**Intent**: Drive the real middleware and isolation handlers over HTTP, with cookie sessions, against local Supabase. The file starts and stops the app server so a passing run does not depend on a hand-started preview.

**Contract**: Bind a port the suite chooses. Start the app the way `npm run dev` does (workerd) and stop it in teardown for this file only. Send `fetch` with `redirect: "manual"`. Build jars from `Set-Cookie` on the app's existing `/api/auth/signup` and `/api/auth/signin` routes. Use a run-unique email pair and a note of 1 to 200 characters. Order: owner signs in, `POST /api/isolation/probes` stores the note, owner `GET /api/isolation/probes` returns 200 and the body contains that note. Then, on an empty jar, `GET /dashboard` is status 302 and the location path is `/auth/signin`, and the body does not contain `This page is only for authenticated users.` On an empty jar, `GET /api/isolation/probes` is status 401 and the body does not contain the note. User B, signed in on a second jar, `GET /api/isolation/probes` is status 200 and the body does not contain the note. User B's `GET /api/isolation/probes/<A's id>` is status 404 and the body does not contain the note. Do not add `/api/isolation` to `PROTECTED_ROUTES`. Do not set `locals.user` from the test. Do not follow redirects. Absence of the note is the body check; do not make `{ "error": "unauthorized" }` or `{ "error": "not_found" }` the only assertion.

### Success Criteria:

#### Automated Verification:

- `npm test` exits 0 without a hand-started preview, and `tests/isolation-access-http.test.ts` uses `redirect: "manual"` to assert signed-out `GET /dashboard` is 302 to `/auth/signin` with a body that does not contain `This page is only for authenticated users.`, signed-out `GET /api/isolation/probes` is 401 and its body does not contain the note this run inserted, the owner's list is 200 and contains that note, user B's list is 200 and does not contain that note, and user B's `GET /api/isolation/probes/<id>` is 404 and its body does not contain that note
- `npm run lint` exits 0
- `npx astro check` exits 0

#### Manual Verification:

- Confirm `.github/workflows/ci.yml` and `scripts/smoke.mjs` have no edits from this phase, and the HTTP test issues separate requests for `/dashboard` and `/api/isolation/probes`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Cookbook patterns in §6

### Overview

**Behavior asserted:** §6.1, §6.2, and §6.6 of `context/foundation/test-plan.md` tell the next author how to add the runner, the session select, and the HTTP gates that phases 1 and 2 shipped.

**Regression caught:** The next test copies a mock ownership check, a 200-only assertion, or a sign-in-page test because the cookbook still says TBD.

**Research source:** `context/foundation/test-plan.md` §6.1, §6.2, §6.6, and §4's AI-native row (Playwright MCP checked 2026-10-07). The behaviors to record are the ones `research.md` verified for risks #1 and #4.

**Edge / error / boundary:** The cookbook names the note string, user B's HTTP 200, the separate 401 body, and the dashboard sentence. It states that the by-id 404 is not the durable policy proof. It leaves the vision layer not recommended, with the existing checked date 2026-10-07, and does not add a new AI-native tool.

**Anti-pattern avoided:** Filling §6 with "unit tests TBD", with an `ENABLE ROW LEVEL SECURITY` checklist, or with file:line anchors in §1 or §2. §3's risk sentences stay free of code anchors.

### Changes Required:

#### 1. Cookbook sections that this phase shipped

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the Phase 1 placeholders in §6.1, §6.2, and §6.6 with the patterns that now exist, so the next rollout phase can copy a proof that catches the researched failures.

**Contract**: Edit only §6.1, §6.2, and §6.6. §6.1 names `npm test`, Vitest through `getViteConfig`, environment `node`, and states that the access boundary is the integration in §6.2, not a unit test cut off from the session. §6.2 names both shipped proofs: the second user's select of `id, note` with no `user_id` predicate after the owner's select has contained the note, and the HTTP gates (dashboard 302 without `This page is only for authenticated users.`, anonymous probes 401 without the note, owner list 200 with the note, user B list 200 without the note). It names the avoided proofs: mocked ownership, HTTP 200 alone, `ENABLE ROW LEVEL SECURITY` alone, a bare 401, a sign-in page only, and treating the dashboard redirect as coverage of `/api/isolation`. §6.6 records that Phase 1 shipped those proofs, that `npm run smoke` remains the existing end-to-end script, and that CI wiring is still §3 Phase 4. Do not change §1–§5, §6.3–§6.5, or §7. Do not add a file:line code anchor to §2.

### Success Criteria:

#### Automated Verification:

- `context/foundation/test-plan.md` §6.1, §6.2, and §6.6 describe the shipped runner, the session select without a `user_id` predicate, and the HTTP gates, including the note-absence assertions
- The diff to `context/foundation/test-plan.md` does not change §1–§5, §6.3–§6.5, or §7

#### Manual Verification:

- Read §6.2 and confirm it names these avoided proofs: a mocked ownership check, HTTP 200 alone, `ENABLE ROW LEVEL SECURITY` alone, a bare 401, a sign-in page test, and treating the dashboard redirect as coverage of `/api/isolation`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

The product change is the tests. Phase 1 is the policy proof smoke cannot make. Phase 2 is the HTTP proof a session select cannot make: middleware, the 401 that returns before the query, and the owner's list. Neither file mocks the client that talks to Supabase.

A false green is any of: `it.skip` when env is missing, a mocked `createClient`, an assertion on status 200 alone, a 401 from user B, a body check that ignores the inserted note, or a by-id 404 used as the only evidence the SELECT policy exists.

`npm run lint` and `npx astro check` cover the new TypeScript. `tsconfig.json` includes `**/*`, so the test files are part of that check. There is no separate unit suite to mock.

### Manual Testing Steps:

1. Start local Supabase so the migrations, including `20260923171212_per_user_row_isolation.sql`, are applied, with the anon key in `SUPABASE_URL` and `SUPABASE_KEY`.
2. Run `npm test` and confirm both integration files pass.
3. Hide `.env` and unset `SUPABASE_URL`, run `npm test`, and confirm a non-zero exit with no skipped tests. Restore the env afterward.
4. Confirm `ci.yml` and `scripts/smoke.mjs` are unchanged and that §6.2 names the avoided proofs.

## Performance Considerations

The phase-1 file is a PostgREST round trip and should not boot the app. The phase-2 file starts one workerd dev server for the file and stops it, instead of one server per assertion. Expect that file to take longer than the select test. Do not add a preview build to this suite; the CI smoke job already builds and previews.

## Migration Notes

No SQL migration. Tests create auth users and probe rows in the local database. Do not add a service-role cleanup path. Leftover local users are acceptable. Owner-JWT deletes are optional and run only after the assertions.

## References

- Related research: `context/changes/testing-runner-access-boundary/research.md`
- Test plan: `context/foundation/test-plan.md` §2 risks #1 and #4, §3 Phase 1, §4, §6
- List handler: `src/pages/api/isolation/probes.ts:17-18`, `:26`
- By-id handler: `src/pages/api/isolation/probes/[id].ts:29-41`
- Middleware: `src/middleware.ts:4`, `:18-21`
- Dashboard copy: `src/pages/dashboard.astro:16`
- SELECT policy: `supabase/migrations/20260923171212_per_user_row_isolation.sql:24-28`
- Smoke gap: `scripts/smoke.mjs:115-122`
- Prior isolation plan (do not put `/api/isolation` on `PROTECTED_ROUTES`; do not add `service_role`): `context/changes/per-user-row-isolation/plan.md`
- Astro testing guide, `getViteConfig`, `node` environment: Context7 `/withastro/docs`, checked 2026-10-07
- AI-native rejection: `context/foundation/test-plan.md` §4, Playwright MCP checked 2026-10-07

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runner and owner-scoped select

#### Automated

- [x] 1.1 `npm test` exits 0 against local Supabase when `SUPABASE_URL` and `SUPABASE_KEY` are the anon key, and `tests/isolation-probes-rls.test.ts` shows user A's select of `id, note` contains the note this run inserted before it asserts user B's select of `id, note` with no `user_id` predicate does not contain that note — 9f54471
- [x] 1.2 `npm run lint` exits 0 — 9f54471
- [x] 1.3 `npx astro check` exits 0 — 9f54471

#### Manual

- [x] 1.4 With `SUPABASE_URL` unset and the repo `.env` not supplying it, `npm test` exits non-zero and does not report skipped tests — 9f54471

### Phase 2: HTTP dashboard and probe gates

#### Automated

- [x] 2.1 `npm test` exits 0 without a hand-started preview, and `tests/isolation-access-http.test.ts` uses `redirect: "manual"` to assert signed-out `GET /dashboard` is 302 to `/auth/signin` with a body that does not contain `This page is only for authenticated users.`, signed-out `GET /api/isolation/probes` is 401 and its body does not contain the note this run inserted, the owner's list is 200 and contains that note, user B's list is 200 and does not contain that note, and user B's `GET /api/isolation/probes/<id>` is 404 and its body does not contain that note — 59ce763
- [x] 2.2 `npm run lint` exits 0 — 59ce763
- [x] 2.3 `npx astro check` exits 0 — 59ce763

#### Manual

- [x] 2.4 Confirm `.github/workflows/ci.yml` and `scripts/smoke.mjs` have no edits from this phase, and the HTTP test issues separate requests for `/dashboard` and `/api/isolation/probes` — 59ce763

### Phase 3: Cookbook patterns in §6

#### Automated

- [x] 3.1 `context/foundation/test-plan.md` §6.1, §6.2, and §6.6 describe the shipped runner, the session select without a `user_id` predicate, and the HTTP gates, including the note-absence assertions — db57a1a
- [x] 3.2 The diff to `context/foundation/test-plan.md` does not change §1–§5, §6.3–§6.5, or §7 — db57a1a

#### Manual

- [x] 3.3 Read §6.2 and confirm it names these avoided proofs: a mocked ownership check, HTTP 200 alone, `ENABLE ROW LEVEL SECURITY` alone, a bare 401, a sign-in page test, and treating the dashboard redirect as coverage of `/api/isolation` — db57a1a
