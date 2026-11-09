# Track Listening Notes — Plan Brief

> Full plan: `context/changes/track-listening-notes/plan.md`

## What & Why

A producer records how a mix sounded on specific reference equipment — "Beyerdynamic DT 770", "Samochód" — directly on the track, and later reads that history to improve the mix deliberately. This is roadmap slice S-07 (US-01, FR-012, FR-013): the PRD's primary success path ends with saving a listening note on the same track, and the note must survive a refresh and stay private.

## Starting Point

Tracks have a name and a stage (Aranż/Miks/Master); on Miks the track page also shows the recipe card. There is no note storage or UI, the track page has no POST handling of its own, and nothing in the app formats dates yet.

## Desired End State

Every track page has a "Listening notes" section: a form with equipment (text with suggestions from earlier equipment) and notes, and below it the track's notes newest first, each with Polish date and time, equipment, the stage at the time of saving, its text, and a Delete button. A bad input shows a message and keeps what was typed. Another user cannot see, add, or delete the owner's notes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| List order | Newest first (`created_at desc`, `id desc` as a tie-breaker) | The latest listening is right under the form, which matters on a phone; it matches the recipe list. |
| Equipment input | Free text 1–100 chars with a `datalist` of the user's earlier equipment (newest spelling, case-insensitive de-dup, max 20) | Keeps concrete model names from the shape notes while nudging consistent names for the parked FR-017 filter. |
| "Status" from the PRD | The track stage saved with the note, set by the server | Meets the PRD success criterion without another form field; later stage changes do not rewrite old notes. |
| Note lifecycle | Add and delete; no edit | Same trade-off as own recipes in S-05: fix a mistake by delete and re-add. |
| Where notes appear | On every stage | Listening happens in Aranż and Master too, and the history must not disappear when the stage changes. |
| Keeping typed text | Track page handles the note POST itself and re-renders on failure | Same pattern as `recipes/new.astro`; the `?error=` redirect used elsewhere on the page drops text. |
| Time display | `dd.MM.yyyy, HH:mm` in `Europe/Warsaw` | The server renders in UTC, so a fixed zone is needed for a correct local hour. |

## Scope

**In scope:**
- `src/lib/listening-notes.ts` with input schema, row schema, suggestion de-dup, date formatting
- `listening_notes` table with owner-only select/insert/delete, track-ownership check on insert, no update
- Notes section on `src/pages/tracks/[id].astro` and a delete route `src/pages/api/tracks/[id]/notes/[noteId].ts`
- Unit, RLS, and HTTP tests

**Out of scope:**
- Editing notes, a separate verdict field, a fixed equipment list
- Note template (FR-015), cross-track equipment filter (FR-017)
- Track deletion, pagination, production migration

## Architecture / Approach

Pure rules live in one module and are built test-first. The table hangs off `tracks` with `on delete cascade` and RLS copied from `track_recipe_progress`, including the `exists` check that the track belongs to the caller. The track page reads notes and suggestions in parallel with its existing queries. It saves a note through its own POST (303 on success, re-render with values on failure) and deletes through a small API route that answers 303.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Note model and validation | Limits, row shape, suggestions, Warsaw date format, unit tests | ICU format differences; avoided by building the date from `formatToParts` |
| 2. Table and RLS | `listening_notes` migration with owner-only policies, two-user RLS tests | Attaching a note to someone else's track if the insert policy skips the track-ownership check |
| 3. Notes on the track page | Form, history, delete route, HTTP tests | The page's new POST could resubmit on refresh or swallow a failed read as "no notes" |

**Prerequisites:** S-03 done (tracks exist); local Supabase running for tests.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes a track collects at most a few dozen notes, so no pagination is needed.
- Production needs the migration applied by hand before deploying.
- The PRD's "status" is interpreted as the saved track stage; a verdict field would be a new change.

## Success Criteria (Summary)

- A note saved on a track is visible newest first with date, equipment, and stage after a refresh and a new session.
- An invalid note shows a message and keeps the typed text; nothing is saved.
- A second user gets 404 for the owner's track and cannot add or delete the owner's notes.
