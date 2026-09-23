# Per-user row isolation Implementation Plan

## Overview

Freeze one Postgres isolation rule before any product table exists, and prove it with two signed-in users. Private rows are readable and writable only by their owner. A starter-catalog row is readable by every signed-in user and writable only by a migration. The proof uses two non-product tables and the existing HTTP smoke script.

## Current State Analysis

Auth already issues a cookie session and middleware resolves `locals.user` with `auth.getUser()`. The Supabase client is the anon key plus that cookie, so PostgREST can see the user JWT. There is no application schema: `supabase/` contains `config.toml` only, `src/` never calls `.from()`, and nothing reads `user.id`. `scripts/smoke.mjs` checks sign-up, sign-in, and `/dashboard` only. It keeps one cookie jar and returns status and redirect location, not a response body.

The product requirement is already fixed. A signed-in user sees only their own profile, plugins, screenshots, and listening history. There are no admin, member, or guest roles. Product tables (DAW profile, plugins, tracks, recipes, notes) are created by the first slice that needs each one. Screenshot object storage is not part of this change.

### Key Discoveries:

- Session identity is `App.Locals.user.id` from `src/middleware.ts` (lines 4–24) via `src/lib/supabase.ts` (lines 5–20). `user.id` is unused in `src/` today.
- `PROTECTED_ROUTES` is only `/dashboard` and redirects anonymous users to `/auth/signin` (`src/middleware.ts` lines 4 and 18–21). API isolation checks must return JSON status codes themselves.
- Smoke sign-up expects `302` to `/auth/confirm-email`, then a separate sign-in (`scripts/smoke.mjs` lines 38–58). Local `enable_confirmations = false` is what makes that sign-in succeed.
- CI's `smoke` job runs `supabase start` and then `npm run smoke` against `npm run preview` (`.github/workflows/ci.yml`). A new `supabase/migrations/` file is applied by that start. No extra CI job is required.
- `AGENTS.md` requires `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`, RLS, and granular per-operation policies. `zod` is required for API input and is not in `package.json` yet.
- `supabase/config.toml` points `db.seed` at `./seed.sql`, which is not in the repo. The catalog row must be inserted by the migration, not by that missing seed file.
- Migrations are forward-only (`context/foundation/infrastructure.md`). Worker rollback does not revert SQL.

## Desired End State

A second signed-in user cannot read the first user's probe row. Both signed-in users can read one seeded catalog row, and neither can insert, update, or delete it. Anonymous callers receive `401` from the isolation routes. Later slices copy one of the two table patterns instead of inventing a policy.

Verification is `BASE_URL=http://localhost:4321 npm run smoke` against a running preview server and local Supabase, including the new named steps. `npx astro check` and `npm run lint` pass.

### Key Discoveries:

- Owner key is `auth.users.id`, exposed as `locals.user.id`. The server sets `user_id`. The client body must not choose the owner.
- RLS is the enforcement layer. The anon key never bypasses it. There is no `service_role` environment variable, and this change must not add one.
- The catalog pattern is a second table, not a nullable `user_id` on the probe table. Each later product table picks exactly one pattern.

## What We're NOT Doing

- DAW profile, plugin inventory, tracks, recipes, listening notes, or any other product table.
- Seeding the "Sidechain stopy z basem" recipe. That stays in S-04.
- Supabase Storage policies for screenshots. Those stay with the upload slice.
- A dashboard or other UI for probe or catalog rows.
- App roles, public recipe sharing, or a service-role client.
- Adding `/api/isolation` to `PROTECTED_ROUTES`. That list redirects pages; these routes speak JSON.
- Editing `supabase/config.toml` or creating the missing `seed.sql`.
- Production deploy or a cloud Supabase migration push. Local `supabase start` and the existing CI smoke job are enough.

## Implementation Approach

One migration introduces `isolation_probes` (owner-only) and `isolation_catalog` (authenticated read, no authenticated write) and seeds a single catalog row labeled `starter-visible`. Thin API routes call the existing cookie `createClient`, validate input with `zod`, and map RLS failures to HTTP statuses. Smoke signs in two users on the one cookie jar, reads JSON bodies, and asserts the cross-user miss and the catalog write denial. The migration header states both patterns so later slices copy them.

## Critical Implementation Details

- **State sequencing:** `scripts/smoke.mjs` has one `jar`. Sign user A out before user B signs up. If both sessions were attempted in the same jar, B's cookies would replace A's before the cross-user read, or A's cookies would still be sent as B.
- **Debug & observability:** `request()` today drops the body (`scripts/smoke.mjs` lines 23–36). The new assertions need the probe id and the catalog label from JSON. Extend the helper; do not scrape HTML.
- **Timing & lifecycle:** The catalog `INSERT` belongs in the migration. The migration role bypasses RLS, which is what allows the seed while authenticated users have no write policy and no write grant. Do not seed the catalog from the API.
- **User experience spec:** A probe id that belongs to someone else, or does not exist, returns `404` with the same body. Do not return `403` for a foreign id; that would reveal that the row exists.

## Phase 1: Schema and row policies

### Overview

Add the first application migration. It creates the two non-product tables, enables RLS, grants the minimum privileges, and seeds the catalog row.

### Changes Required:

#### 1. Isolation migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_per_user_row_isolation.sql`

**Intent**: Store the isolation rule in SQL so later slices copy a pattern instead of restating it. Probe rows exist only so smoke can prove a negative read. The catalog row exists so smoke can prove shared read and denied write.

**Contract**: Timestamp-prefixed filename under `supabase/migrations/`. Header comment names the two patterns in one sentence each: private tables use `user_id uuid not null references auth.users(id) on delete cascade` and owner policies; catalog tables have no `user_id`, allow `authenticated` `SELECT` only, and receive rows from migrations.

`isolation_probes` columns: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `note text not null`, `created_at timestamptz not null default now()`.

`isolation_catalog` columns: `id uuid primary key default gen_random_uuid()`, `label text not null unique`, `created_at timestamptz not null default now()`. One inserted row with `label = 'starter-visible'`.

Enable RLS on both tables. Policies are for role `authenticated` only. No `anon` policy.

```sql
-- probes: one policy per operation
select using (user_id = (select auth.uid()));
insert with check (user_id = (select auth.uid()));
update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
delete using (user_id = (select auth.uid()));

-- catalog: select only
select using (true);
```

Grants, after RLS: `authenticated` receives `select, insert, update, delete` on `isolation_probes` and `select` on `isolation_catalog`. `anon` receives nothing on either table. `authenticated` does not receive `insert`, `update`, or `delete` on `isolation_catalog`. There is no write policy on the catalog.

#### 2. README baseline sentence

**File**: `README.md`

**Intent**: The local-Supabase section currently says no tables or migrations are required. After this migration that sentence would send the next slice down the auth-only path.

**Contract**: Replace the sentence at the end of the local Supabase setup section ("No database tables or migrations are required…"). State that application tables live in `supabase/migrations/`, that `isolation_probes` and `isolation_catalog` are the isolation fixtures, and that product tables are still added by the slice that needs them. Leave the cloud-project and email-confirmation sections unchanged.

### Success Criteria:

#### Automated Verification:

- Migration file under `supabase/migrations/` enables RLS on `isolation_probes` and `isolation_catalog` and seeds `starter-visible`
- `npm run lint` passes

#### Manual Verification:

- SQL review confirms `isolation_catalog` has no authenticated insert, update, or delete policy and no write grant

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Session-scoped HTTP contract

### Overview

Expose the two tables through cookie-authenticated JSON routes. The route uses the session user as the owner and turns RLS denials into stable HTTP statuses.

### Changes Required:

#### 1. Zod dependency

**File**: `package.json`

**Intent**: API input validation is required by `AGENTS.md`, and `zod` is not installed.

**Contract**: Add `zod` as a runtime dependency. Lockfile updates with it. No other dependency changes.

#### 2. Probe and catalog routes

**File**: `src/pages/api/isolation/probes.ts`

**File**: `src/pages/api/isolation/probes/[id].ts`

**File**: `src/pages/api/isolation/catalog.ts`

**Intent**: Give smoke a session-scoped way to insert and read rows without a product screen. Writes go through the cookie client from `src/lib/supabase.ts`, so RLS sees the user JWT.

**Contract**: Each file exports `const prerender = false`. Handlers are `GET` and `POST` only where listed. Every handler reads `context.locals.user`. Missing user returns `401` JSON and does not redirect. Missing Supabase configuration returns `503` JSON.

`POST /api/isolation/probes` body is zod `{ note: string }` with length 1–200. The insert sets `user_id` to `locals.user.id` and `note` from the parsed body. A client-supplied `user_id` is ignored. Success is `201` with `{ id, note }`.

`GET /api/isolation/probes` returns `200` `{ probes: [{ id, note }] }` for the session user only. Do not add a `.eq('user_id', …)` filter as a substitute for RLS; selecting the columns is enough because the owner policy already filters. A filter may be added only as a second check that uses `locals.user.id`.

`GET /api/isolation/probes/:id` validates `id` as a uuid. Zero rows returns `404` `{ error: "not_found" }`. One row returns `200` `{ id, note }`.

`GET /api/isolation/catalog` returns `200` `{ items: [{ id, label }] }`.

`POST /api/isolation/catalog` accepts no body that can create a row. For a signed-in user it returns `403` `{ error: "forbidden" }` without inserting. Do not use a privileged client to attempt the insert.

Do not add these paths to `PROTECTED_ROUTES`.

### Success Criteria:

#### Automated Verification:

- `npx astro check` passes
- `npm run lint` passes

#### Manual Verification:

- A signed-in POST `/api/isolation/probes` stores `user_id` from the session and ignores any client-supplied owner

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Two-user smoke proof

### Overview

Extend the existing smoke script so one run proves anonymous rejection, owner isolation, shared catalog read, and catalog write denial.

### Changes Required:

#### 1. Smoke steps and response body

**File**: `scripts/smoke.mjs`

**Intent**: The roadmap's unlock is a second signed-in user who cannot read the first user's rows. The current script never creates two users and never reads a body, so it cannot prove that.

**Contract**: Keep the existing steps and their expected statuses. `request()` may return a parsed JSON body in addition to `status` and `location`. Cookie handling stays a single jar.

Insert the following steps after `dashboard renders for signed-in user` and before the existing `signout clears session` step. User A is the account the current script already signs in. User B uses a second `smoke-b-…@example.com` address and the same password constant. B's sign-up and sign-in use the same expected redirects as A's (`/auth/confirm-email`, then `/`).

Named steps and expected results:

- Anonymous `GET /api/isolation/probes` returns `401`. Place this step before sign-up, while the jar is empty.
- User A `POST /api/isolation/probes` with `{ "note": "owned-by-a" }` returns `201` and an `id`.
- User A `GET /api/isolation/probes` returns `200` and a list containing that `id`.
- User A `GET /api/isolation/catalog` returns `200` and a label `starter-visible`.
- User A `POST /api/isolation/catalog` returns `403`.
- User A signs out (`302` to `/`).
- User B signs up and signs in.
- User B `GET /api/isolation/probes` returns `200` and the list does not contain A's `id`.
- User B `GET /api/isolation/probes/<A id>` returns `404`.
- User B `GET /api/isolation/catalog` returns `200` and a label `starter-visible`.
- User B `POST /api/isolation/catalog` returns `403`.

The existing final sign-out then clears B's session, and the existing dashboard redirect step still expects `302` to `/auth/signin`.

### Success Criteria:

#### Automated Verification:

- `BASE_URL=http://localhost:4321 npm run smoke` passes against preview and local Supabase

#### Manual Verification:

- Smoke log shows user B does not receive user A's probe id, both users receive `starter-visible`, and catalog POST returns `403`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- No unit-test runner exists in this repo. Do not add one for this change. Input bounds are the zod schema exercised by the smoke POST.

### Integration Tests:

- `scripts/smoke.mjs` is the integration check: anonymous `401`, owner A sees the probe, owner B does not, both see `starter-visible`, both receive `403` on catalog POST.
- CI already starts local Supabase, builds, runs preview, and runs smoke. No workflow edit unless `supabase start` fails to apply `supabase/migrations/`.

### Manual Testing Steps:

1. Read the migration and confirm the catalog has select-only access for `authenticated`.
2. With a signed-in session, POST a probe including a foreign `user_id` and confirm the stored owner is the session user.
3. Read the smoke log for the B-misses-A and catalog-`403` lines.

## Performance Considerations

Probe and catalog reads are single-table lookups for a smoke-scale fixture. No cache, index beyond the primary key and the unique catalog label, or pagination. This does not change the product latency budget for recipe cards.

## Migration Notes

There is no application data to backfill. The migration is forward-only: once `supabase start` has applied it, corrections are a new migration, not an edit of the applied file. The missing `supabase/seed.sql` is unused. Applying this migration to a hosted Supabase project is out of scope; local CLI and CI `supabase start` are the targets.

## References

- Roadmap item: `context/foundation/roadmap.md` (F-01, Change ID `per-user-row-isolation`)
- Access rule: `context/foundation/prd.md` (Access Control, FR-001)
- Migration rule: `AGENTS.md`
- Session client: `src/lib/supabase.ts`, `src/middleware.ts`
- Smoke harness: `scripts/smoke.mjs`
- CI smoke job: `.github/workflows/ci.yml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and row policies

#### Automated

- [x] 1.1 Migration file under `supabase/migrations/` enables RLS on `isolation_probes` and `isolation_catalog` and seeds `starter-visible`
- [x] 1.2 `npm run lint` passes

#### Manual

- [ ] 1.3 SQL review confirms `isolation_catalog` has no authenticated insert, update, or delete policy and no write grant

### Phase 2: Session-scoped HTTP contract

#### Automated

- [ ] 2.1 `npx astro check` passes
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 A signed-in POST `/api/isolation/probes` stores `user_id` from the session and ignores any client-supplied owner

### Phase 3: Two-user smoke proof

#### Automated

- [ ] 3.1 `BASE_URL=http://localhost:4321 npm run smoke` passes against preview and local Supabase

#### Manual

- [ ] 3.2 Smoke log shows user B does not receive user A's probe id, both users receive `starter-visible`, and catalog POST returns `403`
