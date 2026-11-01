---
date: 2026-10-07T20:38:30+02:00
researcher: Miszczo
git_commit: cb541a8017cb1ef26cdbfff9e381cabef690028b
branch: master
repository: mixing-cookbook
topic: "Ground test-plan Phase 1 access risks #1 and #4"
tags: [research, codebase, access-boundary, rls, isolation-probes]
status: complete
last_updated: 2026-10-07
last_updated_by: Miszczo
---

# Research: Ground test-plan Phase 1 access risks #1 and #4

**Date**: 2026-10-07T20:38:30+02:00
**Researcher**: Miszczo
**Git Commit**: cb541a8017cb1ef26cdbfff9e381cabef690028b
**Branch**: master
**Repository**: mixing-cookbook

## Research Question

For rollout Phase 1 of `context/foundation/test-plan.md` ("Runner i granica dostępu"), where do risks #1 and #4 actually fail in this repo, does the written response guidance catch that failure, what tests already exist, and what is the cheapest useful layer?

Risk #1: a signed-in user sees someone else's plugins, screenshots, or notes. Guidance to verify: a second signed-in user cannot read the first user's rows; challenge "RLS enabled" or a bare 401; do not mock the ownership check; do not check only HTTP 200.

Risk #4: a signed-out person opens a private URL and receives data, or a signed-in user cannot reach their own track. Guidance to verify: a signed-out request does not receive private data, and a signed-in user can reach their own track; challenge "a redirect on one page also closes the API"; do not test only the sign-in page.

Hot-spot directories named as likelihood scope, not anchors: `src`, `scripts`, `supabase/migrations`.

## Summary

In the one file under `supabase/migrations/`, the owner-scoped table is `public.isolation_probes`. That file does not create a plugin, screenshot, listening-note, or track table. Its SELECT policy for role `authenticated` is `user_id = (select auth.uid())` (`supabase/migrations/20260923171212_per_user_row_isolation.sql:24-28`). `GET /api/isolation/probes` selects `id, note` with no `user_id` predicate (`src/pages/api/isolation/probes.ts:26`). With user B signed in, `scripts/smoke.mjs:115-122` expects HTTP 200 and user A's probe id absent from that list, then HTTP 404 for A's id. A check that stops at HTTP 200 passes that list step even when A's note is in the body. A check that stops at HTTP 401 misses it: the 401 branch runs when `locals.user` is null (`src/pages/api/isolation/probes.ts:17-18`), and user B is signed in.

The page redirect and the API denial are different gates. `PROTECTED_ROUTES` is `["/dashboard"]` (`src/middleware.ts:4`). The redirect to `/auth/signin` sits inside that prefix test (`src/middleware.ts:18-21`). The isolation handlers are not under `/dashboard`, so that redirect does not handle them. Each of the three handlers returns 401 JSON when `locals.user` is null (`probes.ts:17-18`, `probes/[id].ts:15-16`, `catalog.ts:13-14`).

No track route exists in the 11 files under `src/pages`. The signed-in path this tree can prove is `GET /dashboard` returning 200 (`scripts/smoke.mjs:72`) and user A's probe list containing A's id (`scripts/smoke.mjs:85-91`).

`package.json` scripts at lines 5-14 and devDependencies at lines 38-56 do not name Vitest, Jest, or Playwright. A glob of `**/{vitest,jest,playwright}.config.*` returned no files. The existing automated proof is `npm run smoke`.

## Detailed Findings

### Risk #1 — second signed-in user and `isolation_probes`

The migration header says later product tables should copy one of two patterns (`supabase/migrations/20260923171212_per_user_row_isolation.sql:1-3`). This session found one file in `supabase/migrations/`. It creates two tables:

- `public.isolation_probes` has `user_id uuid not null references auth.users(id)` (`:5-8`). RLS is enabled at `:21`. Four policies for role `authenticated` use `user_id = (select auth.uid())`: SELECT (`:24-28`), INSERT (`:30-34`), UPDATE (`:36-41`), DELETE (`:43-47`).
- `public.isolation_catalog` has no `user_id` (`:12-16`). RLS is enabled at `:22`. Its SELECT policy for `authenticated` is `using (true)` (`:49-53`). There is no INSERT, UPDATE, or DELETE policy on that table in this file. Grants at `:55-59` give `authenticated` select/insert/update/delete on probes and select on the catalog, after revoking all from `anon` and `authenticated`.

`src/lib/supabase.ts:5-20` builds one server client from `SUPABASE_URL` and `SUPABASE_KEY` plus the request cookies. `README.md:104` and `README.md:124` describe `SUPABASE_KEY` as the anon public key. A search of `README.md`, `.env.example`, `src/**/*.ts`, and `astro.config.mjs` for `service_role` returned no matches. That search does not prove the value stored in an environment is the anon key.

The list handler does not add `.eq("user_id", ...)`. After the null-user 401, it selects `id, note` from `isolation_probes` (`src/pages/api/isolation/probes.ts:26`) and returns `{ probes }` with status 200 (`:33`). The by-id handler filters with `.eq("id", idResult.data)` (`src/pages/api/isolation/probes/[id].ts:29-33`) and maps a failed row parse to 404 `{ error: "not_found" }` (`:40-41`). A successful row returns 200 `{ id, note }` (`:44`). Insert sets `user_id` from `context.locals.user.id` (`probes.ts:58-62`), which is the app's choice of owner; the INSERT policy still has its own `WITH CHECK`.

`scripts/smoke.mjs` uses one cookie jar (`:9`, `:12-14`). It signs A out (`:103`) before B signs in (`:109-113`). B's list step expects status 200 and `!probes.some((p) => p.id === probeIdA)` (`:115-120`). It does not assert that the note string `owned-by-a` is absent. B's by-id step expects status 404 (`:122`) and does not read the body. If the handler later added `.eq("user_id", locals.user.id)` and the SELECT policy was removed, those two smoke steps would still pass, because the HTTP response would look the same. A test that mocks that filter would hide the same gap. Asserting `ENABLE ROW LEVEL SECURITY` (`:21`) would also pass after the USING expression was dropped.

`isolation_catalog` is the counterexample. User B is expected to see `starter-visible` (`scripts/smoke.mjs:123-130`) because the SELECT policy is `using (true)`. Catalog POST returns 403 from the handler without calling insert (`src/pages/api/isolation/catalog.ts:32-42`). That 403 does not prove a database write policy.

Product nouns in the risk sentence are not tables in this migration. A search of `src` for `plugin`, `screenshot`, `listening`, `track`, and `utwor` returned no matches. The `note` matches in that search are the probe column. `context/foundation/prd.md:125` states the product privacy NFR in Polish: a signed-in user sees exclusively their own DAW profile, plugins, private screenshots, and listening history. Access Control at `context/foundation/prd.md:139-143` names private recipes, plugins, worklogs, and listening notes. Roadmap F-01 status is `done` (`context/foundation/roadmap.md:46`) and line 85 says it unlocks a verification path that a second signed-in user cannot read the first user's rows. In the same table, S-01, S-02, S-03, and S-05 are `ready`; S-04, S-06, and S-07 are `proposed` (`context/foundation/roadmap.md:47-53`). None of those seven rows is `done`.

Guidance verdict for #1:

- "Second signed-in user cannot read the first user's rows" matches the probe proof that smoke and the SELECT policy already aim at. It does not match a plugin, screenshot, or listening-note table, because those tables are not in the migration file inspected here.
- "Challenge RLS enabled or a bare 401" holds. The 401 is the signed-out branch. User B's list is specified as HTTP 200.
- "Do not mock the ownership check" holds, because the list query has no ownership predicate to mock.
- "Do not check only HTTP 200" holds, because the cross-user list step is specified as 200 plus an id check.

### Risk #4 — signed-out data and the missing track

Middleware sets `locals.user` from `auth.getUser()` when the client exists, and sets null when it does not (`src/middleware.ts:7-16`). The redirect runs when the pathname starts with a `PROTECTED_ROUTES` entry and `locals.user` is null (`:18-21`). The array has one entry, `/dashboard` (`:4`). `src/pages/dashboard.astro:3` and `:14` render `user?.email` and do not themselves redirect.

Pages present under `src/pages` (11 files from a glob of `src/pages/**/*.{astro,ts}`): `index.astro`, `dashboard.astro`, `auth/signin.astro`, `auth/signup.astro`, `auth/confirm-email.astro`, `api/auth/signin.ts`, `api/auth/signup.ts`, `api/auth/signout.ts`, `api/isolation/probes.ts`, `api/isolation/probes/[id].ts`, `api/isolation/catalog.ts`. None of those paths is a track page.

Signed-out behavior already asserted by smoke, against a running server:

- `GET /dashboard` expects 302 and location `/auth/signin` (`scripts/smoke.mjs:55`).
- `GET /api/isolation/probes` expects 401 (`scripts/smoke.mjs:56`). The step does not assert the body. The handler returns `{ error: "unauthorized" }` before the query (`probes.ts:17-18`).
- After sign-out, `GET /dashboard` expects the same redirect (`scripts/smoke.mjs:133-134`).

`/auth/signin` is one of the 11 page files and is not in `PROTECTED_ROUTES`. A test that loads that page and no dashboard or isolation route does not exercise the redirect or the isolation 401.

Guidance verdict for #4:

- "Signed-out request does not receive private data" holds for the dashboard redirect and for the isolation 401 that returns before the probe query. Smoke does not assert the 401 body.
- "Signed-in user can reach their own track" does not name a route in `src/pages`. The reachable signed-in stand-in is `/dashboard` status 200 (`scripts/smoke.mjs:72`) and A's own probe id in the list (`scripts/smoke.mjs:85-91`).
- "A redirect on one page also closes the API" is the assumption to reject. The redirect prefix is `/dashboard`. Isolation routes return their own 401 JSON.
- "Do not test only the sign-in page" holds.

### Tests, runner, and the cheapest layer

`package.json:5-14` defines `dev`, `build`, `preview`, `astro`, `lint`, `lint:fix`, `format`, and `smoke`. It does not define a `test` script. devDependencies at `package.json:38-56` are eslint, prettier, supabase, typescript, wrangler, and their plugins. A glob of Vitest, Jest, and Playwright config filenames returned no files. A glob of `**/*.{test,spec}.{ts,tsx,js,mjs}` returned two files, both under `.cursor/skills/`, and no product test.

CI (`.github/workflows/ci.yml:3-7`) runs on push and pull_request to `master`. The `ci` job lints, typechecks, and builds (`:10-25`). The `smoke` job starts local Supabase, writes `SUPABASE_URL` and `SUPABASE_KEY` from `API_URL` and `ANON_KEY`, builds, previews on port 4321, and runs `npm run smoke` (`:27-55`). `.env.example` names `SUPABASE_URL` and `SUPABASE_KEY`.

`context/foundation/test-plan.md:30` says scoped history had 4 commits in the last 30 days, below a threshold of 5, so likelihood did not come from churn in `src`, `scripts`, or `supabase/migrations`. Those directory names are a misleading map of the failure. `scripts/smoke.mjs` is the existing oracle. The HTTP gates are `src/middleware.ts` and the three isolation handlers. The row denial expression is the probe USING clause, not the directory `supabase/migrations` and not the `enable row level security` lines by themselves.

`scripts/smoke.mjs:115-120` is written to fail when A's probe id is present in B's list. This session did not run that script. A new Vitest file that mocks `createClient`, or that asserts status 200 and does not read the body, would not catch the failures named above. A Vitest file that opens `/auth/signin` and no other route would not catch them either. The test plan assigns Phase 1 to stand up Vitest (`context/foundation/test-plan.md:62`, `:73`). The useful layer for that runner is an integration test against local Supabase that asserts the note text is absent for user B and present for user A, and that the anonymous probe response body has no note. A select issued with user B's session and no `user_id` predicate would still fail if a later handler added that predicate and the policy was removed. Smoke, as written at `:115-122`, would not.

Phase 4 of the test plan, not Phase 1, is the row that wires the suite into CI (`context/foundation/test-plan.md:65`). The `smoke` job is already on pull requests to `master` (`ci.yml:3-7`).

## Code References

- `src/middleware.ts:4` — `PROTECTED_ROUTES` is `["/dashboard"]`.
- `src/middleware.ts:18-21` — anonymous redirect to `/auth/signin` for that prefix.
- `src/pages/dashboard.astro:3` — reads `Astro.locals.user` and does not redirect.
- `src/pages/api/isolation/probes.ts:17-18` — null user returns 401 before the query.
- `src/pages/api/isolation/probes.ts:26` — list select has no `user_id` predicate.
- `src/pages/api/isolation/probes.ts:58-62` — insert writes `user_id` from the session.
- `src/pages/api/isolation/probes/[id].ts:29-33` — by-id select filters on `id`.
- `src/pages/api/isolation/probes/[id].ts:40-41` — missing row parse becomes 404.
- `src/pages/api/isolation/catalog.ts:32-42` — POST returns 403 without an insert.
- `src/lib/supabase.ts:5-20` — cookie client from `SUPABASE_URL` and `SUPABASE_KEY`.
- `supabase/migrations/20260923171212_per_user_row_isolation.sql:21-28` — RLS enabled, then the owner SELECT policy.
- `supabase/migrations/20260923171212_per_user_row_isolation.sql:49-53` — catalog SELECT `using (true)`.
- `scripts/smoke.mjs:55-56` — anonymous dashboard 302 and probes 401.
- `scripts/smoke.mjs:72` — signed-in dashboard expects 200.
- `scripts/smoke.mjs:85-91` — owner list expects 200 and A's id present.
- `scripts/smoke.mjs:115-122` — user B list expects 200 without A's id; by-id expects 404.
- `package.json:5-14` — scripts include `smoke` and no `test` script.
- `.github/workflows/ci.yml:3-7` — `ci` and `smoke` run on push and pull_request to `master`.

## Architecture Insights

Two gates: middleware redirects one page prefix; isolation handlers return JSON status codes themselves. The database client used by those handlers is the cookie client in `src/lib/supabase.ts`, so a signed-in request carries that user's JWT into PostgREST. Cross-user denial of probe rows is then the SELECT policy, because the list query does not add an owner filter. The catalog SELECT policy for role `authenticated` is `using (true)` (`supabase/migrations/20260923171212_per_user_row_isolation.sql:49-53`), so that expression does not compare `user_id`. Smoke keeps a single cookie jar and signs A out before B, so the cross-user steps are not two simultaneous sessions in one jar.

## Historical Context (from prior changes)

- `context/changes/per-user-row-isolation/plan.md:9` — "There is no application schema: `supabase/` contains `config.toml` only, `src/` never calls `.from()`". **Contradicted** as a description of the current tree: the migration file exists, and `src/pages/api/isolation/probes.ts:26` calls `.from("isolation_probes")`. **Supported** as that plan's pre-change baseline, not as the current schema.
- `context/changes/per-user-row-isolation/plan.md:16` and `:46` — API isolation checks return JSON; do not add `/api/isolation` to `PROTECTED_ROUTES`. **Supported** by `src/middleware.ts:4` and by the 401 returns in the three isolation handlers.
- `context/changes/per-user-row-isolation/plan.md:34` — "There is no `service_role` environment variable, and this change must not add one." **Supported** as an instruction of that plan. The `service_role` string is absent from the files searched in this session (`README.md`, `.env.example`, `src/**/*.ts`, `astro.config.mjs`). That absence is not a reading of a deployed secret.
- `context/changes/per-user-row-isolation/plan.md:61` and `plan-brief.md:26` — a foreign probe id returns 404, same as a missing id, not 403. **Supported** by `src/pages/api/isolation/probes/[id].ts:40-41` and `scripts/smoke.mjs:122`. This file has no 403 branch for a foreign id.
- `context/changes/per-user-row-isolation/plan.md:263` — "No unit-test runner exists in this repo. Do not add one for this change." **Supported** for that change's scope. It does not name `testing-runner-access-boundary`. The current `package.json` scripts still have no `test` script (`package.json:5-14`).
- `context/changes/per-user-row-isolation/reviews/impl-review.md:40` — if A's insert returns no id, user B's miss check is vacuously true and the script still prints PASS. **Contradicted** for current `scripts/smoke.mjs:139-142`, which logs FAIL and breaks before the user B probe steps when `probeIdA` is not a string. The review sentence remains a supported description of the defect it found.

`context/archive/` has no product change folder that this session used. `context/changes/bootstrap-verification/` does not decide row access.

## Related Research

No `research.md` files were found under `context/`. Not applicable.

## Open Questions

- This session did not start Supabase or read `pg_policies`. Enforcement is the SQL file at the cited lines, not a live query result.
- `git status --porcelain` for the cited source files was empty at commit `cb541a8017cb1ef26cdbfff9e381cabef690028b` on local `master`. This session did not check whether that commit is on the GitHub remote, so citations stay `file:line`.
- Whether a deployed `SUPABASE_KEY` is the anon key is not established beyond `README.md:104` and `:124`.
