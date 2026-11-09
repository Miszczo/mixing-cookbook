# Track Listening Notes Implementation Plan

## Overview

A signed-in producer can add a listening note to any of their tracks — the reference equipment (e.g. "Beyerdynamic DT 770", "Samochód") and free-text sound notes — and reads that track's notes newest first, each with its date, equipment, and the track stage at the moment it was saved. Notes survive a refresh, are private to their author, and can be deleted. This is roadmap slice S-07 (US-01, FR-012, FR-013) and the last open must-have slice besides search (S-06).

## Current State Analysis

- The track page `src/pages/tracks/[id].astro` shows the name/stage form for every track and, on a Miks track, the recipe list and card. It has no POST handling of its own; its forms post to `/api/...` routes that answer 303 and report errors as `?error=` query parameters (`src/pages/api/tracks/[id].ts:31-34`), which loses typed text.
- `public.tracks` (`supabase/migrations/20261101120100_tracks.sql`) has select/insert/update policies and no delete, so tracks are never removed by the app.
- Child rows of a track follow `track_recipe_progress` (`supabase/migrations/20261101130000_track_recipe_progress.sql:27-44`): RLS per operation, `revoke all` then explicit grants, and an `exists` check on track ownership in the insert policy, because a foreign key check bypasses RLS.
- The page that keeps typed text on failure is `src/pages/recipes/new.astro`: it handles its own POST, re-renders with the submitted values and a `role="alert"` message, and redirects 303 on success.
- `/tracks` is already in `PROTECTED_ROUTES` (`src/middleware.ts:4`).
- No code formats dates yet. The app renders on workerd in UTC, so a time must be formatted with an explicit time zone.
- `TRACK_STAGE_IDS` in `src/lib/tracks.ts:11` is module-private; the note row schema needs it.
- Test patterns: two-user RLS tests in `tests/recipe-progress-rls.test.ts`, HTTP tests against the real server in `tests/recipes-in-track-http.test.ts` with helpers in `tests/helpers/http-app.ts`. Test plan risk #3 asks for "save plus a separate read", not an assertion on the save response.
- Lessons (`context/foundation/lessons.md`) are process rules: work in `D:\www\10xdevs4` and stop before the next skill.

## Desired End State

On every track page (Aranż, Miks, Master) there is a "Listening notes" section with a form — equipment (text with suggestions from the user's earlier equipment) and notes — and below it the track's notes, newest first. Each note shows its date and time in Polish time, its equipment, the stage label saved with it, its text, and a Delete button. Saving redirects back to the track and the note is there after a refresh and in a new session. An empty or too-long field shows a clear message and keeps both typed values. Another user cannot read, add to, or delete the owner's notes. Changing the track's stage later does not change the stage shown on older notes.

Verify with `npm test` (new unit, RLS, and HTTP tests) and the manual steps below.

### Key Discoveries:

- The insert policy must check that `track_id` belongs to the caller (`exists ... tracks t where t.id = track_id and t.user_id = auth.uid()`), as `track_recipe_progress` does; `user_id = auth.uid()` alone would let a user attach a note to another user's track id.
- The stage on a note comes from the track row the server reads during the POST, not from the form, so the client cannot claim a stage the track did not have.
- `created_at` has microsecond precision and each note is written in its own request, so "newest first" by `created_at desc` matches save order; `id desc` is added only to make the order deterministic.
- `recipes/new.astro` shows that an Astro page can process its own POST and re-render; the track page needs the same for the note form only.

## What We're NOT Doing

- Editing a note. A wrong note is deleted and written again.
- A separate verdict field on a note (e.g. "Do poprawy"/"OK"); "status" in the PRD success criterion is the saved track stage.
- A fixed equipment list or an equipment table; equipment stays free text.
- The note template button (FR-015) and filtering notes across tracks by equipment (FR-017) — both parked in the roadmap.
- Deleting tracks, pagination of notes, or notes on recipes.
- Changing how the track form or the recipe card report errors.
- Applying the migration to production.

## Implementation Approach

Put the input rules, row shape, equipment-suggestion de-duplication, and date formatting in one pure module and drive it test-first. Add a `listening_notes` table owned by the user and tied to a track, with owner-only select/insert/delete and no update. On the track page, read the notes and the equipment suggestions alongside the track, render the section for every stage, and handle the note form's POST in the page itself so a failure re-renders the typed text; deletion goes through a small API route with a 303, like recipe deletion.

## Critical Implementation Details

- **POST on the track page must not re-run as a GET.** On success the page answers 303 to `/tracks/<id>` (keeping a `recipe` query parameter if the request had one) plus `#notes`, so a refresh does not resubmit. On failure it renders with status 400/500 and the typed values; on a missing or foreign track it answers 404 without inserting.
- **A failed read is not an empty list.** If the notes query fails, show an alert ("Listening notes could not be loaded"), not "No listening notes yet". A failed suggestions query only drops the suggestions.

## Phase 1: Note model and validation

### Overview

Pure logic for the note: input limits, row shape, equipment suggestions, and the displayed date. Delivered test-first with `/10x-tdd`.

### Changes Required:

#### 1. Export the stage ids

**File**: `src/lib/tracks.ts`

**Intent**: Let the note schema reuse the track stage enum instead of repeating it.

**Contract**: `TRACK_STAGE_IDS` becomes an export; no other change.

#### 2. Note module

**File**: `src/lib/listening-notes.ts` (new)

**Intent**: One place for the rules used by the page, the route, and the tests.

**Contract**:
- `MAX_EQUIPMENT_LENGTH = 100`, `MAX_NOTE_LENGTH = 2000`, `MAX_EQUIPMENT_SUGGESTIONS = 20`.
- `listeningNoteInputSchema`: zod object `{ equipment: string trimmed 1–100, body: string trimmed 1–2000 }`.
- `listeningNoteRowSchema`: `{ id: uuid, equipment: string, body: string, stage: enum(TRACK_STAGE_IDS), created_at: string }`; `ListeningNote` type; `LISTENING_NOTE_COLUMNS = "id, equipment, body, stage, created_at"`.
- `equipmentSuggestions(values: string[]): string[]`: input is newest first; trims, drops empty values, de-duplicates case-insensitively keeping the first (newest) spelling, returns at most `MAX_EQUIPMENT_SUGGESTIONS`.
- `formatNoteDate(iso: string): string`: `dd.MM.yyyy, HH:mm` in `Europe/Warsaw`, built from `Intl.DateTimeFormat(...).formatToParts` so the output does not depend on the ICU short format.

#### 3. Tests

**File**: `tests/listening-notes.test.ts` (new)

**Intent**: Prove the boundaries with hand-written expected values.

**Contract**: Equipment of 100 vs 101 characters and of only spaces; body of 2000 vs 2001 characters and of only spaces; surrounding spaces are trimmed. Suggestions: `["DT 770", "dt 770 ", "Samochód", "", "Monitory"]` → `["DT 770", "Samochód", "Monitory"]`; 25 distinct values → 20, the first 20 kept. Dates: `2026-11-09T09:05:00Z` → `09.11.2026, 10:05` (CET) and `2026-07-01T08:00:00Z` → `01.07.2026, 10:00` (CEST). Row schema rejects an unknown stage.

### Success Criteria:

#### Automated Verification:

- Note tests pass: `npx vitest run tests/listening-notes.test.ts`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`

#### Manual Verification:

- None for this phase; it is pure logic.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 2.

---

## Phase 2: Listening notes table and row-level security

### Overview

Store notes privately, tied to a track the user owns, with no way to change a saved note.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261109120000_listening_notes.sql` (new)

**Intent**: Create `public.listening_notes` with owner-only policies, in the style of `track_recipe_progress`.

**Contract**:
- Columns: `id uuid pk default gen_random_uuid()`, `track_id uuid not null references public.tracks (id) on delete cascade`, `user_id uuid not null references auth.users (id) on delete cascade`, `equipment text not null` (char_length 1–100), `body text not null` (char_length 1–2000), `stage text not null check (stage in ('aranz', 'miks', 'master'))`, `created_at timestamptz not null default now()`.
- Indexes: `(track_id, created_at desc)` and `(user_id)`.
- RLS enabled. Policies for `authenticated`: select using `user_id = (select auth.uid())`; insert with check `user_id = (select auth.uid())` and `exists` a `public.tracks` row with that `track_id` and the same owner; delete using `user_id = (select auth.uid())`. No update policy.
- `revoke all on table public.listening_notes from anon, authenticated;` then `grant select, insert, delete ... to authenticated`.

#### 2. RLS tests

**File**: `tests/listening-notes-rls.test.ts` (new)

**Intent**: Prove isolation and immutability with two signed-in users, as in `tests/recipe-progress-rls.test.ts`.

**Contract**: The owner inserts a note on their track and reads it back. A second user's `select` without a `user_id` predicate does not return it; an anonymous select errors. The second user cannot insert on the owner's track with their own `user_id`, nor with the owner's `user_id`; the owner cannot insert on the second user's track. An update by the owner errors (no grant) and the row is unchanged. A delete by the second user removes nothing; a delete by the owner removes the row. Check constraints reject empty and 101-character equipment, a 2001-character body, and the stage `"mix"`.

### Success Criteria:

#### Automated Verification:

- Local Supabase applies the migration: `npx supabase migration up --local`
- RLS tests pass: `npx vitest run tests/listening-notes-rls.test.ts`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`

#### Manual Verification:

- None for this phase; the tests cover the policies.

**Implementation Note**: Pause for confirmation before Phase 3.

---

## Phase 3: Notes on the track page

### Overview

Show the form and the history on every track page, save a note without losing typed text on failure, and delete a note.

### Changes Required:

#### 1. Track page

**File**: `src/pages/tracks/[id].astro`

**Intent**: Add the "Listening notes" section for every stage and handle the note form's POST in the page.

**Contract**:
- Reads, when the track exists: notes for the track with `LISTENING_NOTE_COLUMNS`, ordered `created_at desc, id desc`; and the user's equipment values (`select("equipment")` ordered `created_at desc`, limit 200) passed through `equipmentSuggestions`. Both run in parallel with the existing Miks reads.
- POST (form field `action=add-note`): validate with `listeningNoteInputSchema`; on success insert `{ track_id, user_id, equipment, body, stage: track.stage }` and answer 303 to `/tracks/<id>` (plus the request's `recipe` parameter, if any) with `#notes`. Invalid input → status 400, message "Enter the equipment (up to 100 characters) and your notes (up to 2000 characters).", both values kept. Insert error → 500 with "The note could not be saved." and values kept. Unknown or foreign track → the existing 404 render, no insert. Any other POST `action` → 400.
- Section `id="notes"`: form with an equipment `<input list>` plus `<datalist>` of suggestions (`maxlength` 100) and a notes `<textarea>` (`maxlength` 2000), "Save note" button; then the list. Each item shows `formatNoteDate(created_at)` in a `<time datetime>`, the equipment, `trackStageLabel(stage)`, the body with line breaks kept (`whitespace-pre-line`, no `set:html`), and a Delete form posting `action=delete` to the route below. Empty state: "No listening notes yet." A failed notes read shows an alert instead.
- Uses the existing `field`/`button` classes; usable at phone width.

#### 2. Delete route

**File**: `src/pages/api/tracks/[id]/notes/[noteId].ts` (new)

**Intent**: Delete one note through the same form-and-redirect pattern as recipe deletion.

**Contract**: `POST` with `action=delete`: 401 without a user, 503 without a client, 404 for an invalid track or note id, 400 for another action, 500 on a query error, 404 when the delete (filtered by `id` and `track_id`) returns no rows, otherwise 303 to `/tracks/<id>#notes`. Exports `prerender = false`, validates ids and the action with zod.

#### 3. HTTP tests

**File**: `tests/listening-notes-http.test.ts` (new)

**Intent**: Prove the user-visible flow through the real server, with each save checked by a separate GET.

**Contract**:
- On a Miks track, posting `DT 770` / `Sub za głośny` answers 303; a new GET of the track shows the text, the equipment, and "Miks". Posting `Samochód` / `Wokal OK` and reading again shows the second note before the first.
- After switching the track to Master, a GET still shows both notes, the older one with "Miks", and the form is present on a Master track.
- A third note with equipment `dt 770 ` leaves exactly one `DT 770`-like option in the datalist (the newest spelling).
- An empty body answers 400, the page contains the typed equipment, and a GET shows no new note; a 2001-character body behaves the same and keeps the text.
- A second user: GET of the owner's track answers 404 without note text; POST of a note to the owner's track answers 404 and the owner's list is unchanged; deleting the owner's note answers 404 and the note remains.
- The owner deletes a note: 303, and a GET no longer shows it.

### Success Criteria:

#### Automated Verification:

- HTTP tests pass: `npx vitest run tests/listening-notes-http.test.ts`
- All tests pass: `npm test`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- On a Miks track, a saved note appears at the top with Polish date and time, the equipment, and "Miks", and is still there after a browser refresh and after signing out and in
- Equipment suggestions show earlier equipment while typing
- An empty notes field shows the message and the typed equipment is still in the form
- After switching the track to Master the history is still visible and old notes keep "Miks"
- Deleting a note removes it from the list
- The form and the list are usable at phone width

**Implementation Note**: This is the last phase; after it, run `/10x-impl-review` before archiving.

---

## Testing Strategy

### Unit Tests:

- `tests/listening-notes.test.ts`: input limits and trimming, suggestion de-duplication and cap, Warsaw date formatting in winter and summer time, row stage enum.

### Integration Tests:

- `tests/listening-notes-rls.test.ts`: owner-only select/insert/delete, track ownership on insert, no update, check constraints.
- `tests/listening-notes-http.test.ts`: save and separate read, newest-first order, stage snapshot across a stage change, datalist de-duplication, rejected input keeps text, cross-user denial, delete.

### Manual Testing Steps:

1. Sign in, open a Miks track, save a note with "DT 770" and two lines of text; refresh.
2. Save a second note with "Samochód"; check it is on top and both have dates.
3. Start typing "DT" in equipment and pick the suggestion.
4. Submit with empty notes; check the message and the kept equipment.
5. Switch the track to Master; check the history and the stage on old notes.
6. Delete a note; repeat steps 1–2 on a phone-width window.

## Performance Considerations

The track page adds two small indexed queries that run in parallel with the existing ones; the `(track_id, created_at desc)` index serves the list and the suggestions read is capped at 200 rows. Notes are not paginated; a single track is not expected to collect more than a few dozen notes in the MVP.

## Migration Notes

The migration only adds a table and its policies; existing data is untouched. Production is not migrated by anything in the repo, so it must be applied by hand before deploying. A rollback drops the table and its notes.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-07)
- PRD: `context/foundation/prd.md` (US-01, FR-012, FR-013, Success Criteria, NFR on persistence, privacy, errors, and phone use)
- Test plan: `context/foundation/test-plan.md` (risks #1, #3, #5; §6.2)
- Previous plan: `context/archive/2026-11-03-author-recipe-with-screenshot/plan.md`
- Self-POST form that keeps text: `src/pages/recipes/new.astro`
- Child-of-track RLS: `supabase/migrations/20261101130000_track_recipe_progress.sql:27-44`
- Test style: `tests/recipe-progress-rls.test.ts`, `tests/recipes-in-track-http.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Note model and validation

#### Automated

- [x] 1.1 Note tests pass: `npx vitest run tests/listening-notes.test.ts`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Type checking passes: `npx astro check`

### Phase 2: Listening notes table and row-level security

#### Automated

- [ ] 2.1 Local Supabase applies the migration: `npx supabase migration up --local`
- [ ] 2.2 RLS tests pass: `npx vitest run tests/listening-notes-rls.test.ts`
- [ ] 2.3 Linting passes: `npm run lint`
- [ ] 2.4 Type checking passes: `npx astro check`

### Phase 3: Notes on the track page

#### Automated

- [ ] 3.1 HTTP tests pass: `npx vitest run tests/listening-notes-http.test.ts`
- [ ] 3.2 All tests pass: `npm test`
- [ ] 3.3 Linting passes: `npm run lint`
- [ ] 3.4 Type checking passes: `npx astro check`
- [ ] 3.5 Build passes: `npm run build`

#### Manual

- [ ] 3.6 On a Miks track, a saved note appears at the top with Polish date and time, the equipment, and "Miks", and is still there after a browser refresh and after signing out and in
- [ ] 3.7 Equipment suggestions show earlier equipment while typing
- [ ] 3.8 An empty notes field shows the message and the typed equipment is still in the form
- [ ] 3.9 After switching the track to Master the history is still visible and old notes keep "Miks"
- [ ] 3.10 Deleting a note removes it from the list
- [ ] 3.11 The form and the list are usable at phone width
