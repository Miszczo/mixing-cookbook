# Primary DAW Profile — Plan Brief

> Full plan: `context/changes/primary-daw-profile/plan.md`

## What & Why

A signed-in producer chooses one primary DAW on the dashboard so a later recipe can name that DAW's native tools. Sign-in already exists. Without a stored DAW, that later fallback has nothing to name.

## Starting Point

`/dashboard` is the only protected page. It shows the account email and sign-out. The database has isolation fixtures only. Product tables are created by the slice that needs them, and this slice needs the DAW profile.

## Desired End State

The producer sees `No primary DAW is set.`, saves Ableton Live, and after refresh sees `Primary DAW: Ableton Live`. Saving FL Studio replaces that label. The page cannot clear the choice. Another signed-in user cannot see it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| How many DAWs | One primary | FR-002 is a single default for native tools. |
| Which names | Ableton Live, FL Studio, Logic Pro, Bitwig Studio, Reaper | Stable ids (`ableton-live`, `fl-studio`, `logic-pro`, `bitwig-studio`, `reaper`) with no version, so a later map can attach tools. |
| Empty profile | Unset until a valid save | No row until the first accepted id. Submitting `Choose a DAW` does not write. |
| Change later | Replace in place | The current id is the one a later recipe reads. The previous id is not kept. |
| Clear | Not offered | No clear control and no delete grant, so the row cannot be removed back to unset. |
| Where | `/dashboard` | That page is already protected. Sign-in still lands on `/`. |
| Auth | Leave as it is | Register, login, and logout already satisfy FR-001. |
| DAW catalog table | Not used | The five ids are a check constraint, not shared catalog rows. |

## Scope

**In scope:**

- Private `daw_profiles` row, one per user, with the five-id check.
- Dashboard select, save, replace, unset copy, and invalid-choice copy.
- Two-user read proof and anonymous POST rejection.

**Out of scope:**

- Native-tool names, plugins, tracks, recipes, and listening notes.
- A `/profile` page, free-text DAWs, versions, and multiple DAWs.
- Rebuilding auth or changing the sign-in redirect.
- A delete or clear path, and a new CI job.

## Architecture / Approach

The dashboard reads the signed-in user's row with the cookie Supabase client. No row renders the unset sentence. The form posts `daw_id` to `POST /api/profile/primary-daw`. The route validates the id, sets `user_id` from the session, and upserts. Labels live in `src/lib/primary-daw.ts`. The database stores the id.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Private DAW profile row | Table, five-id check, owner read and write, no delete | Copying the probe grant would allow a clear |
| 2. Dashboard choice | Unset, save, and replace on `/dashboard` | A failed read shown as "no DAW" hides a real row |
| 3. Two-user proof | Second user cannot read the id; bad id does not stick | HTTP 401 alone does not prove the row policy |

**Prerequisites:** F-01 per-user row isolation is done. Local Supabase for the migration and the Vitest proofs.
**Estimated effort:** About one to two sessions across three phases.

## Open Risks & Assumptions

- S-04 still chooses native-tool labels. It must use these five ids as the keys.
- CI runs lint, typecheck, build, and smoke. `npm test` is local, as with the existing isolation tests.
- A database owner can still delete the row outside the app role. The signed-in role cannot.

## Success Criteria (Summary)

- A signed-in producer can save Ableton Live and see `Primary DAW: Ableton Live` after refresh.
- Saving FL Studio replaces that label, and nothing on the page clears it.
- Another signed-in user does not see the choice, and an id outside the five does not change it.
