# Per-user row isolation — Plan Brief

> Full plan: `context/changes/per-user-row-isolation/plan.md`

## What & Why

Signed-in producers will keep private plugins, tracks, and listening notes. The repo can gate `/dashboard`, and it cannot yet stop one user from reading another user's rows, because there are no application tables. This change freezes that rule once, with a two-user proof, before any product table exists.

## Starting Point

Sign-in stores a Supabase session in cookies. Middleware sets `locals.user` from `auth.getUser()`. The server client uses the anon key. `supabase/` has `config.toml` only. Smoke covers auth redirects and does not read a response body or a second user.

## Desired End State

User A can save a probe note and read it back. User B, signed in afterwards, does not see that note and gets a not-found response for A's id. Both can read a seeded catalog label `starter-visible`. Neither can write the catalog. Anonymous calls get `401`. Later slices copy the private-table pattern or the catalog-table pattern.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Proof without product tables | Non-product probe table plus smoke | The roadmap requires a second user who cannot read the first user's rows, and product tables belong to later slices | Plan |
| Shared starter rows | Separate catalog table, read-only for signed-in users | FR-005 needs a starter recipe later, and a single owner-only rule would force per-user copies | Plan |
| Enforcement | RLS on the user JWT, no service role | The anon cookie client is the only database client, so policies must hold for that role | Plan |
| Catalog seed | One migration insert, label `starter-visible` | `seed.sql` is referenced and missing, and an API seed would need a write path users must not have | Plan |
| HTTP gate | `401` JSON from the route, not `PROTECTED_ROUTES` | The middleware list redirects pages to the sign-in form | Plan |
| Foreign probe id | `404` for missing and for another user's id | A `403` would reveal that the row exists | Plan |

## Scope

**In scope:**

- Migration for `isolation_probes` and `isolation_catalog`, RLS, grants, and one catalog row
- JSON routes for probe create/list/get and catalog read, plus a denied catalog write
- `zod` for the probe body
- Smoke steps for two users
- README correction that migrations now exist

**Out of scope:**

- Product tables, the sidechain starter recipe, and screenshot storage
- Probe UI, app roles, service role, and production migration push

## Architecture / Approach

The browser session stays on Supabase cookies. Routes call `createClient` and Postgres applies `auth.uid()` policies. Private rows check `user_id`. Catalog rows allow `SELECT` for `authenticated` and nothing else. Smoke reuses one cookie jar: it signs A out before it signs B in, and it reads JSON ids from the response body.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema and row policies | RLS fixtures and the `starter-visible` seed | A write grant on the catalog would undo the rule even with RLS off |
| 2. Session-scoped HTTP contract | Cookie routes and `zod` validation | Trusting a client `user_id` would bypass the session owner |
| 3. Two-user smoke proof | A and B assertions in `scripts/smoke.mjs` | One cookie jar will mix the two sessions if A is not signed out first |

**Prerequisites:** Local Supabase with email confirmation disabled, and the existing sign-in flow. No earlier product slice.
**Estimated effort:** One session across 3 phases.

## Open Risks & Assumptions

- Planning did not run `supabase start`. The plan assumes the CLI applies `supabase/migrations/` on start, which is what CI already relies on once the directory exists.
- Smoke sign-up still redirects to `/auth/confirm-email` and then signs in. That depends on confirmation staying disabled.
- Hosted Supabase is not migrated by this change. Applying the file there is a separate human step.

## Success Criteria (Summary)

- User B's probe list omits user A's id, and B's fetch of that id is `404`.
- Both users see `starter-visible`, and catalog POST is `403`.
- `npm run smoke` passes against preview and local Supabase, and `npx astro check` and `npm run lint` pass.
