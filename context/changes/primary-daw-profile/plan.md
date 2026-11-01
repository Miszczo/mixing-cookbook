# Primary DAW Profile Implementation Plan

## Overview

Let a signed-in producer choose one primary DAW on `/dashboard` and replace it later. The choice is stored on a private row so a later recipe can name that DAW's native tools. This slice does not name those tools.

## Current State Analysis

Sign-in, sign-up, and sign-out already work. Middleware protects only `/dashboard` and redirects anonymous visitors to `/auth/signin` (`src/middleware.ts` lines 4 and 18–21). That page shows the account email, the sentence "This page is only for authenticated users.", and a sign-out form (`src/pages/dashboard.astro` lines 13–23). Sign-in still redirects to `/` (`src/pages/api/auth/signin.ts`).

There is no profile table and no DAW field. The only application tables are the isolation fixtures in `supabase/migrations/20260923171212_per_user_row_isolation.sql`. Private rows use `user_id` owned by `auth.users`, with one policy per operation for `authenticated` and no `anon` grant. The server sets `user_id` from `locals.user.id`. The cookie client is `createClient` in `src/lib/supabase.ts`. JSON routes validate input with zod and return `401` themselves; they are not listed in `PROTECTED_ROUTES`.

FR-002 requires one primary DAW on the profile. S-04 later maps native tools from that choice. F-01 is done and explicitly left the product table to this slice.

## Desired End State

A signed-in producer opens `/dashboard`, sees that no primary DAW is set, and saves one of five products: Ableton Live, FL Studio, Logic Pro, Bitwig Studio, or Reaper. After refresh the page shows that label. Saving a different product replaces the label. The page never offers a way to clear it. Another signed-in user cannot read the stored id. An anonymous POST cannot write it. An id outside the five does not change the stored value.

Verification is `npm test`, `npm run lint`, and `npx astro check`. The existing smoke script still passes because sign-in still lands on `/` and the dashboard keeps its authenticated-users sentence.

### Key Discoveries:

- Owner key is `locals.user.id`. The client body must not choose the owner (`src/pages/api/isolation/probes.ts` lines 58–63).
- Zero rows is the unset state. A query error is not the same thing and must not be shown as "no DAW".
- `isolation_catalog` is the shared-read pattern for later starter recipes. The five DAW names are a fixed list, not catalog rows.
- CI runs lint, `npx astro check`, build, and smoke. It does not run `npm test`. The two-user proof follows the existing Vitest isolation tests and runs locally.

## What We're NOT Doing

- Rebuilding register, login, or logout, or moving the sign-in redirect off `/`.
- A separate `/profile` page, or adding the DAW route to `PROTECTED_ROUTES`.
- More than one DAW, a version in the name, or a free-text name.
- Clearing the choice. No delete grant and no clear control.
- Native-tool labels, plugin inventory, tracks, recipes, screenshots, or listening notes.
- Using `isolation_catalog` as the DAW list.
- A `service_role` client, app roles, or a new CI job.
- Blocking any page until a DAW is chosen.

## Implementation Approach

Add one private `daw_profiles` row per user. The primary key is `user_id`. `daw_id` is one of five stable ids, enforced by a check constraint and by the same list in application code. No row means unset. The first accepted save inserts. A later accepted save updates that row. The dashboard is a server-rendered form that posts `daw_id` to one route. The route checks the session, parses the id, and writes `user_id` from the session. Labels stay in the app. The database stores ids only.

## Critical Implementation Details

- **No delete:** `isolation_probes` grants delete to the owner. Copying that grant would let the signed-in user clear the row through PostgREST and return to unset. This table grants `select`, `insert`, and `update` only, and it has no delete policy.
- **Upsert needs both policies:** a replace is an insert that conflicts on `user_id` and then updates. Row-level security checks the insert policy and the update policy. Both must allow `user_id = auth.uid()`.
- **Empty is not a write:** the unset select submits an empty `daw_id`. That response redirects back with an error and does not insert. A failed read shows a load error, not the unset sentence.
- **Leave the auth surface alone:** keep the dashboard sentence "This page is only for authenticated users." and keep successful sign-in on `/`. The HTTP isolation test and smoke both depend on those.

## Phase 1: Private DAW profile row

### Overview

Add the private table that stores one primary DAW id per user. No page uses it yet.

### Changes Required:

#### 1. DAW profile migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_primary_daw_profile.sql`

**Intent**: Create the product row this slice owns, with the five ids fixed in the database so a later native-tool map can rely on them. The timestamp sorts after `20260923171212`.

**Contract**: Table `public.daw_profiles`. Columns: `user_id uuid primary key references auth.users (id) on delete cascade`, `daw_id text not null`, `updated_at timestamptz not null default now()`. Check constraint allows only `ableton-live`, `fl-studio`, `logic-pro`, `bitwig-studio`, and `reaper`.

Enable row-level security. Policies for `authenticated` only, named for select, insert, and update. Select and update use `user_id = (select auth.uid())`. Insert and update check the same expression. No delete policy and no `anon` policy.

```sql
revoke all on table public.daw_profiles from anon, authenticated;
grant select, insert, update on table public.daw_profiles to authenticated;
```

`anon` receives nothing. `authenticated` does not receive `delete`.

### Success Criteria:

#### Automated Verification:

- Migration enables RLS on `daw_profiles`, checks the five daw ids, and grants authenticated select, insert, and update only
- `npm run lint` passes

#### Manual Verification:

- Local Supabase applies the migration and `daw_profiles` exists

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Dashboard choice

### Overview

Show the unset or current DAW on `/dashboard` and save or replace it through a validated route.

### Changes Required:

#### 1. Shared DAW list

**File**: `src/lib/primary-daw.ts`

**Intent**: Keep the ids and the visible labels in one place so the page, the route, and the check constraint cannot drift.

**Contract**: Export one list, in this order, and nothing else that writes to the database:

```ts
export const PRIMARY_DAWS = [
  { id: "ableton-live", label: "Ableton Live" },
  { id: "fl-studio", label: "FL Studio" },
  { id: "logic-pro", label: "Logic Pro" },
  { id: "bitwig-studio", label: "Bitwig Studio" },
  { id: "reaper", label: "Reaper" },
] as const;
```

The check constraint in Phase 1 lists these ids and no others.

#### 2. Save route

**File**: `src/pages/api/profile/primary-daw.ts`

**Intent**: Accept the dashboard form and write the signed-in user's row. Reject a missing session, an empty value, and any id outside the five without changing stored data.

**Contract**: `export const prerender = false` and `export const POST`. Read the form field `daw_id`. Do not read `user_id` from the body. No session returns `401` JSON `{ "error": "unauthorized" }`. No Supabase client returns `503` JSON `{ "error": "service_unavailable" }`.

An empty or unknown `daw_id` returns `303` to `/dashboard?error=invalid_daw` and does not write. An accepted id upserts `{ user_id: locals.user.id, daw_id, updated_at }` on conflict `user_id`, then returns `303` to `/dashboard`. A failed write returns `500` JSON `{ "error": "save_failed" }` and does not redirect to the success URL. Do not add this path to `PROTECTED_ROUTES`.

#### 3. Dashboard form

**File**: `src/pages/dashboard.astro`

**Intent**: Let the producer see and change the primary DAW on the page they already have after sign-in.

**Contract**: In the frontmatter, load the signed-in user's `daw_id` with `maybeSingle`. Render the existing email, the authenticated-users sentence, and sign-out.

- No row: show `No primary DAW is set.` The select's selected option is `Choose a DAW` with value `""`.
- One row: show `Primary DAW: <label>` using the label for that id. That id's option is selected.
- Query or client failure: show `Primary DAW could not be loaded.` Do not show the unset sentence and do not show the form.
- `?error=invalid_daw`: show `Choose a primary DAW.` Keep the current row's selected option, or the empty option when no row exists.

The form is `method="POST"` `action="/api/profile/primary-daw"`. It is a sibling of the existing sign-out form, not wrapped around it. The select name is `daw_id`. Its options are the empty choice plus the five labels. The submit button says `Save`. There is no clear control. Use normal Astro attributes and `class`, merged with `cn()` when a class list is conditional. Do not use `set:html`.

### Success Criteria:

#### Automated Verification:

- `npx astro check` passes
- `npm run lint` passes

#### Manual Verification:

- Signed-in dashboard shows "No primary DAW is set." and saving Ableton Live then refreshing shows "Primary DAW: Ableton Live"
- Saving FL Studio replaces the label, and the page offers no way to clear the choice
- Submitting "Choose a DAW" leaves the profile unset and shows "Choose a primary DAW."

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Two-user proof

### Overview

Prove the privacy and rejection rules with two signed-in sessions against local Supabase. Follow the isolation tests: a real session, no mocked ownership, and a second user's select that does not contain the owner's id.

### Changes Required:

#### 1. Row-level proof

**File**: `tests/primary-daw-rls.test.ts`

**Intent**: Show that the owner can read the stored id and another signed-in user cannot, even when the second select does not filter by `user_id`.

**Contract**: Same session style as `tests/isolation-probes-rls.test.ts`. The owner upserts one of the five ids. The owner's `select("daw_id")` contains that id. The second user's `select("daw_id")` does not. Assert the id string, not only the HTTP status.

#### 2. HTTP proof

**File**: `tests/primary-daw-http.test.ts`

**Intent**: Show that the page and the route agree with the row rules, and that a bad id is not reported as a success.

**Contract**: Same app boot style as `tests/isolation-access-http.test.ts`. Do not follow the anonymous `/dashboard` redirect.

- Anonymous `GET /dashboard` is `302` to `/auth/signin`, and the body does not contain `This page is only for authenticated users.`
- Anonymous `POST /api/profile/primary-daw` is `401`, and the body does not contain the owner's daw id.
- After the owner saves, the owner `GET /dashboard` is `200` and contains `Primary DAW: ` plus that id's label. The other signed-in user's dashboard does not contain that status line. The option text may still appear.
- A POST with a daw id outside the five, from the owner, leaves a following owner read on the previous id. The response is the `303` to `/dashboard?error=invalid_daw`, not the success redirect.

Do not treat `401` alone, or "RLS enabled", as the proof. Do not point these tests at `isolation_probes`.

### Success Criteria:

#### Automated Verification:

- `npm test` shows the second user cannot read the daw id, anonymous POST returns 401 without that id, the other dashboard omits the status line `Primary DAW:` plus that label, and a rejected id leaves the stored id unchanged
- `npm run lint` passes
- `npx astro check` passes

#### Manual Verification:

- After the tests, a signed-in refresh of `/dashboard` still shows the last saved DAW label

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- The five ids and labels live in `src/lib/primary-daw.ts`. Do not add a unit test that only repeats that array. The database check and the route are the enforcement.

### Integration Tests:

- `tests/primary-daw-rls.test.ts` for the second-user select.
- `tests/primary-daw-http.test.ts` for the anonymous page, the anonymous POST, the owner label, the other user's page, and the rejected id.
- Both use a live local Supabase session, matching `context/foundation/test-plan.md` section 6.2.

### Manual Testing Steps:

1. Sign in and open `/dashboard`. Confirm `No primary DAW is set.`
2. Save Ableton Live. Refresh. Confirm `Primary DAW: Ableton Live`.
3. Save FL Studio. Refresh. Confirm the label changed and there is no clear control.
4. With no row, submit `Choose a DAW`. Confirm the unset sentence remains and `Choose a primary DAW.` appears.
5. Sign out. Confirm `/dashboard` redirects to `/auth/signin`.

## Performance Considerations

The dashboard reads one primary-key row and the save writes that same row. No cache. The one-second budget in the PRD applies to the later recipe card, not to this page.

## Migration Notes

The migration is forward-only. Existing accounts get no backfill. A missing row is the unset state. Deleting the auth user cascades the profile row. Rolling back the app does not drop the table.

## References

- Related research: none for this change. Requirements are FR-002 in `context/foundation/prd.md` and S-01 in `context/foundation/roadmap.md`.
- Similar implementation: `supabase/migrations/20260923171212_per_user_row_isolation.sql`
- Route pattern: `src/pages/api/isolation/probes.ts`
- Page pattern: `src/pages/dashboard.astro`
- Proof pattern: `context/foundation/test-plan.md` section 6.2, `tests/isolation-probes-rls.test.ts`, `tests/isolation-access-http.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Private DAW profile row

#### Automated

- [x] 1.1 Migration enables RLS on `daw_profiles`, checks the five daw ids, and grants authenticated select, insert, and update only
- [x] 1.2 `npm run lint` passes

#### Manual

- [ ] 1.3 Local Supabase applies the migration and `daw_profiles` exists

### Phase 2: Dashboard choice

#### Automated

- [ ] 2.1 `npx astro check` passes
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 Signed-in dashboard shows "No primary DAW is set." and saving Ableton Live then refreshing shows "Primary DAW: Ableton Live"
- [ ] 2.4 Saving FL Studio replaces the label, and the page offers no way to clear the choice
- [ ] 2.5 Submitting "Choose a DAW" leaves the profile unset and shows "Choose a primary DAW."

### Phase 3: Two-user proof

#### Automated

- [ ] 3.1 `npm test` shows the second user cannot read the daw id, anonymous POST returns 401 without that id, the other dashboard omits the status line `Primary DAW:` plus that label, and a rejected id leaves the stored id unchanged
- [ ] 3.2 `npm run lint` passes
- [ ] 3.3 `npx astro check` passes

#### Manual

- [ ] 3.4 After the tests, a signed-in refresh of `/dashboard` still shows the last saved DAW label
