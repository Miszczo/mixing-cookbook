# Runner and Access Boundary — Plan Brief

> Full plan: `context/changes/testing-runner-access-boundary/plan.md`
> Research: `context/changes/testing-runner-access-boundary/research.md`

## What & Why

Rollout Phase 1 of the test plan stands up Vitest and proves two access risks on the path research found. A second signed-in user must not receive the first user's `isolation_probes` note. A signed-out request must not receive dashboard content or that note, and the owner must still receive their own. Smoke's id check stays green if a later handler filters on `user_id` and the SELECT policy is removed, so this suite has to catch that.

## Starting Point

The owner table is `public.isolation_probes`. The list handler selects `id, note` with no `user_id` predicate; the authenticated SELECT policy is `user_id = (select auth.uid())`. `PROTECTED_ROUTES` is only `/dashboard`, so that redirect does not cover `/api/isolation`. There is no track route, no Vitest config, and no `test` script. CI already runs smoke and does not yet run this suite.

## Desired End State

`npm test` fails closed without the anon Supabase settings, and passes against local Supabase when user B cannot see A's note through a session select that has no owner filter, and when HTTP shows the dashboard redirect, the anonymous 401, the owner's note, and user B's HTTP 200 list without that note. The cookbook §6.1, §6.2, and §6.6 describe those patterns. Smoke and CI are unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Proof target | `isolation_probes.note` | Plugin, screenshot, and track tables, and a track route, are not in this tree | Research |
| Durable #1 proof | B selects `id, note` with no `user_id` predicate, after A's select contains the note | Smoke still passes if the handler later filters and the policy is removed | Research |
| #1 HTTP | User B's list is 200 and lacks A's note | A 401 is the signed-out branch, and 200 alone ignores the body | Research |
| #4 dashboard | 302 to `/auth/signin` and the body lacks `This page is only for authenticated users.` | The anonymous page gate is only the `/dashboard` prefix | Research |
| #4 API | A separate 401 whose body lacks the inserted note | The page redirect does not cover `/api/isolation` | Research |
| By-id | 404 and the body lacks the note; not the durable policy proof | The handler filters on `id` only today; a later `user_id` filter would hide a dropped policy | Research |
| Empty list | Not the assertion | B must not receive A's note; B may have other rows | Plan |
| Runner | Vitest 4 via `getViteConfig`, environment `node` | Astro's testing guide (checked 2026-10-07) and `astro@7.3.2`'s own `vitest` `^4.1.0` | Plan |
| Missing Supabase | Fail the suite, do not skip | A skip is a false green for #1 and #4 | Plan |
| HTTP harness | The suite starts and stops the app; real cookies; `redirect: "manual"` | A stubbed `locals.user` skips middleware and the cookie client | Plan |
| CI and smoke | Unchanged here | Test-plan Phase 4 wires CI; smoke remains the existing end-to-end script | Research |
| Cookbook | Last phase updates §6.1, §6.2, and §6.6 only | Those placeholders still say TBD; §1–§5 stay free of code anchors | Plan |
| AI-native | Not added; Playwright MCP checked 2026-10-07 | The note text and the owner are deterministic assertions | Research |
| `service_role` | Not added | The anon cookie client is the client the handlers use | Research |

## Scope

**In scope:** Vitest runner, two-user session select, HTTP gates for `/dashboard` and `/api/isolation/probes` (list and by-id), cookbook §6.1, §6.2, and §6.6.

**Out of scope:** CI wiring, smoke rewrites, catalog rules, product plugin/track routes, `PROTECTED_ROUTES` changes, service role, mocks, jsdom, vision checks, test-plan §1–§5 and §7.

## Architecture / Approach

Phase 1 is the cheap signal: two anon-key sessions against local Supabase, no app server. Phase 2 is the expensive signal: one workerd dev server per HTTP file, cookie jars, and separate signed-out requests for the page and the API. Phase 3 records what shipped. The owner's note is observed before any absence check, so a missing insert cannot pass.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Runner and owner-scoped select | `npm test` proves B's unfiltered select lacks A's note | A 200 or a mocked filter hides a dropped policy |
| 2. HTTP dashboard and probe gates | Redirect, 401 body, owner note, B's 200 list | The page redirect is mistaken for API coverage |
| 3. Cookbook patterns in §6 | §6.1, §6.2, §6.6 match the proofs above | The next phase copies a TBD or a mock |

**Prerequisites:** Local Supabase with this repo's migrations applied, `[auth.email] enable_confirmations = false` (already set), and the anon key in `SUPABASE_URL` / `SUPABASE_KEY`. Node 22.14.0.
**Estimated effort:** About two sessions across three phases.

## Open Risks & Assumptions

- Research did not query `pg_policies` live. The migration file is the policy under test; a local database without that migration fails the suite, which is the closed failure.
- Local `SUPABASE_KEY` is the anon key, matching the CI smoke job. A service-role value would bypass the proof and is out of scope.
- `dev()` under the Cloudflare adapter may need a child `astro dev` process. Either one meets the contract that the suite starts a real server.
- Email confirmations stay off. A hosted project with confirmations on would fail sign-in after sign-up.

## Success Criteria (Summary)

- User B does not receive the note user A stored, on an unfiltered session select and on an HTTP 200 list.
- A signed-out dashboard request redirects without the authenticated sentence, and a signed-out probe request returns 401 without that note.
- The owner receives the note, the suite does not skip when Supabase is missing, and §6 records the proofs without a vision layer.
