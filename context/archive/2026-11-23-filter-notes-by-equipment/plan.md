# Filter listening notes by equipment Implementation Plan

## Overview

Roadmap S-10 (PRD FR-017): a signed-in user can open a new `/notes` page that lists their listening notes from all tracks, newest first, and narrow the list to one piece of reference equipment chosen from a list of the names they have used. Matching is exact on the name, ignoring letter case.

## Current State Analysis

- Listening notes are stored in `public.listening_notes` (`supabase/migrations/20261109120000_listening_notes.sql`) with `equipment` as free text (1–100 chars), `body`, `stage`, `created_at`, `track_id` → `tracks`, and `user_id`. RLS `listening_notes_select_own` limits reads to the caller's rows; there is an index on `user_id`, none on `equipment`.
- Notes are visible only on a single track page (`src/pages/tracks/[id].astro:100-111`), filtered by `track_id`. There is no cross-track view.
- Equipment values are trimmed before insert (`listeningNoteInputSchema`, `src/lib/listening-notes.ts:8-11`), so stored values have no surrounding whitespace.
- `equipmentSuggestions()` (`src/lib/listening-notes.ts:26-39`) already deduplicates names case-insensitively, keeping the newest spelling, capped at 20 for the datalist.
- The filter pattern to follow is `/recipes` (`src/pages/recipes/index.astro`): GET form, URL params parsed by a zod schema with `.catch()` defaults (`recipeSearchSchema`, `src/lib/recipes.ts:65-77`), and a pure filter function covered by unit tests.
- Navigation links live in `src/layouts/AppLayout.astro:9-14`; protected paths in `PROTECTED_ROUTES` (`src/middleware.ts:4`).

## Desired End State

- `Notes` appears in the main navigation and links to `/notes`; without a session `/notes` redirects to `/auth/signin`.
- `/notes` shows a GET form with an `Equipment` select: `All` plus every distinct equipment name the user has used (newest spelling per case-insensitive name, sorted alphabetically), and a `Filter` button.
- With `All` (no `equipment` param): up to the 200 newest notes across all tracks. With `?equipment=DT 770`: only notes whose equipment equals `DT 770` ignoring case — `DT 770` and `dt 770` match, `DT 770 Pro` does not.
- Each item shows the date (`formatNoteDate`), equipment, stage badge, body, and the track name as a link to `/tracks/<id>#notes`. No delete button.
- When more than 200 notes match, a line says only the 200 newest are shown and suggests choosing equipment.
- Empty states: "No listening notes yet." (no notes at all) and "No notes for this equipment." (filter with no match). A failed notes read shows an alert, never an empty state.
- Another user's notes never appear, neither in the list nor in the select.

Verification: unit tests for the pure helpers, HTTP tests against the running app and local Supabase, manual click-through.

### Key Discoveries:

- RLS already scopes `select` to the owner (`20261109120000_listening_notes.sql:20-24`), and `tracks` has its own owner policy, so an embedded `tracks(name)` read stays isolated — no migration needed.
- The FK `listening_notes.track_id → tracks(id)` lets PostgREST embed the track name in the same query.
- Error-state convention: a failed read must not look like "empty" (`src/pages/tracks/[id].astro:127-130`).
- The equipment-only read on the track page uses `limit(200)` (`src/pages/tracks/[id].astro:109`); the filter's select needs a wider read because it must list all names.

## What We're NOT Doing

- Substring / partial matching or merging spelling variants such as `DT770` vs `DT 770`.
- Pagination, or showing notes older than the newest 200 within a single filter.
- Deleting or adding notes from `/notes` (the delete endpoint redirects to the track page and stays as is).
- Filtering by track, stage or date; text search in note bodies.
- Database changes (no migration, no index on `equipment`, no RPC).
- Changes to the track page beyond reusing the shared helper.

## Implementation Approach

Pure logic first in `src/lib/listening-notes.ts` (testable without a server), then a server-rendered Astro page that follows the `/recipes` GET-form pattern. The page runs two reads in parallel: equipment names (for the select) and the notes (filtered in the database when an equipment is chosen). The database filter is a case-insensitive `ilike` prefilter with an escaped pattern; an exact case-insensitive comparison in JS then removes any over-match before the 200-note cap is applied.

## Critical Implementation Details

**Exact matching through PostgREST.** `ilike` treats `%` and `_` as wildcards (escape them and `\` with a backslash), and PostgREST also turns every `*` into `%` with no way to escape it. So `ilike` is only a superset prefilter; `sameEquipment()` in JS must re-check every returned row before the cap. Fetch `LIMIT + 1` rows to know whether there are more than 200.

**Unknown filter value.** If the URL carries an equipment name that is not in the select options (stale link, typo, failed names read), still apply the filter and render that value as an extra selected option, so the form never silently shows `All` while the list is filtered.

## Phase 1: Filter logic

### Overview

Pure helpers and the URL schema for the notes view, with unit tests. Suitable for `/10x-tdd`.

### Changes Required:

#### 1. Notes view helpers

**File**: `src/lib/listening-notes.ts`

**Intent**: Add the pieces the `/notes` page needs and make the existing suggestion helper reuse the new deduplication, so both views agree on what "the same equipment" means.

**Contract**:
- `MAX_NOTES_OVERVIEW = 200` and `MAX_EQUIPMENT_SCAN = 1000` (rows read to build the select).
- `notesFilterSchema`: zod object `{ equipment: string }`, trimmed, capped at `MAX_EQUIPMENT_LENGTH`, default `""`, `.catch("")`; empty means "All".
- `distinctEquipment(values: string[]): string[]` — input newest first; trims, drops empty, deduplicates case-insensitively keeping the newest spelling; no cap.
- `equipmentSuggestions(values)` becomes `distinctEquipment(values).slice(0, MAX_EQUIPMENT_SUGGESTIONS)`; behaviour unchanged.
- `equipmentFilterOptions(values: string[]): string[]` — `distinctEquipment` sorted with `localeCompare(…, "pl", { sensitivity: "base" })`.
- `sameEquipment(a: string, b: string): boolean` — `a.trim().toLowerCase() === b.trim().toLowerCase()`.
- `escapeLikePattern(value: string): string` — prefixes `\`, `%`, `_` with `\`.
- `listeningNoteOverviewRowSchema` — `listeningNoteRowSchema` extended with `track_id: z.uuid()` and `tracks: z.object({ name: z.string() })`; `LISTENING_NOTE_OVERVIEW_COLUMNS = "id, equipment, body, stage, created_at, track_id, tracks(name)"`.

#### 2. Unit tests

**File**: `tests/listening-notes.test.ts`

**Intent**: Cover the new helpers and guard the existing `equipmentSuggestions` behaviour.

**Contract**: New `describe` blocks for `notesFilterSchema` (missing/blank/over-long/non-string → `""` or capped), `distinctEquipment` (`["DT 770", "dt 770 ", "Samochód", "", "DT 770 Pro"]` → `["DT 770", "Samochód", "DT 770 Pro"]`, no cap at 20), `equipmentFilterOptions` (alphabetical, Polish letters), `sameEquipment` (`"DT 770"` vs `"dt 770"` true, vs `"DT 770 Pro"` false, `"SAMOCHÓD"` vs `"samochód"` true), `escapeLikePattern` (`"50% _x\\"` → `"50\\% \\_x\\\\"`), and `listeningNoteOverviewRowSchema` (accepts a row with embedded track, rejects a missing `tracks`). Existing `equipmentSuggestions` tests stay green.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run tests/listening-notes.test.ts`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`

#### Manual Verification:

- The track page datalist still offers the same suggestions as before

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Notes overview page

### Overview

The `/notes` page, its navigation entry and route protection, plus HTTP tests including isolation.

### Changes Required:

#### 1. Notes page

**File**: `src/pages/notes.astro` (new)

**Intent**: Server-rendered, read-only view of the user's notes across tracks with an equipment filter, following `/recipes` and the notes list markup from the track page.

**Contract**:
- Parse `notesFilterSchema` from `Astro.url.searchParams`.
- In parallel: (a) `listening_notes.select("equipment").order("created_at", desc).limit(MAX_EQUIPMENT_SCAN)`; (b) `listening_notes.select(LISTENING_NOTE_OVERVIEW_COLUMNS).order("created_at", desc).order("id", desc).limit(MAX_NOTES_OVERVIEW + 1)`, plus `.ilike("equipment", escapeLikePattern(filter))` when a filter is set.
- Validate with zod; keep rows where `sameEquipment` holds (when filtered), then show the first 200 and set a "more" flag when there were more.
- Form: `<form method="get" action="/notes">`, `<select id="notes-equipment" name="equipment">` with `All` (value `""`) and `equipmentFilterOptions(...)`, selected by `sameEquipment`; the unknown value is added as an extra selected option; submit button `Filter`.
- List: `<section id="notes-overview">` with `<li>` items showing `<time>` + `formatNoteDate`, equipment, `trackStageLabel(stage)` badge, a track link `href="/tracks/<track_id>#notes"` with the track name, and the body (`whitespace-pre-line`).
- States: notes read failed → `role="alert"` "Listening notes could not be loaded. Refresh the page to try again."; names read failed → `role="alert"` "The equipment list could not be loaded." (the list still renders); no notes and no filter → "No listening notes yet."; filter with no match → "No notes for this equipment."; more than 200 → "Showing the 200 newest notes. Choose equipment to narrow the list."

#### 2. Navigation and protection

**File**: `src/layouts/AppLayout.astro`, `src/middleware.ts`

**Intent**: Make the page reachable and keep it behind a session.

**Contract**: Add `{ href: "/notes", label: "Notes" }` after `Tracks` in `links`; add `"/notes"` to `PROTECTED_ROUTES`.

#### 3. HTTP tests

**File**: `tests/listening-notes-overview-http.test.ts` (new)

**Intent**: Prove the filter semantics and isolation against the real app, reusing the helpers and style of `tests/listening-notes-http.test.ts`.

**Contract**: Scenarios:
- Owner with two tracks adds notes `DT 770` (track A), `dt 770` (track B), `DT 770 Pro` (A), `Samochód` (B). `/notes` → 4 items newest first, each with its track name and `/tracks/<id>#notes` link; select options are `All` + `dt 770`, `DT 770 Pro`, `Samochód` in this alphabetical order (`dt 770` is the newest spelling of the DT 770 pair).
- `/notes?equipment=DT%20770` → exactly the two DT 770 notes (both tracks), not `DT 770 Pro`; the matching option is `selected`.
- `/notes?equipment=SAMOCHÓD` → the `Samochód` note.
- `/notes?equipment=Nieznany` → "No notes for this equipment." and `Nieznany` rendered as a selected option.
- A separate user with notes `50%` and `500`: `/notes?equipment=50%25` → only the `50%` note (wildcard escaped).
- A second user sees "No listening notes yet.", an empty select, and none of the owner's text in the page, also with `?equipment=DT%20770`.
- Without a session `/notes` → redirect to `/auth/signin`.

### Success Criteria:

#### Automated Verification:

- All tests pass against local Supabase: `npm test`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build succeeds: `npm run build`

#### Manual Verification:

- "Notes" in the navigation opens the overview; choosing equipment and pressing Filter narrows the list and keeps the choice selected after reload
- Track links open the right track at the notes section
- The page is readable on a phone-width window

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Case-insensitive deduplication keeps the newest spelling; no cap in `distinctEquipment`, cap kept in `equipmentSuggestions`.
- `sameEquipment` with Polish letters and surrounding spaces.
- LIKE escaping of `%`, `_`, `\`.
- URL schema fallbacks.

### Integration Tests:

- Cross-track listing with track links, exact case-insensitive filter, unknown filter value, wildcard escaping, isolation between users, session redirect.

### Manual Testing Steps:

1. Sign in, add notes on two tracks with `DT 770`, `dt 770` and `DT 770 Pro`.
2. Open Notes, check all appear newest first with track names.
3. Choose `dt 770`, press Filter: two notes, `DT 770 Pro` absent.
4. Click a track link: track page opens at Listening notes.
5. Sign out and open `/notes`: redirected to sign-in.

## Performance Considerations

Two reads per page view, each bounded (`1000` equipment strings, `201` notes with an embedded track name). Both use the `user_id` index through RLS; no `equipment` index is needed at a personal tool's scale.

## Migration Notes

None. No schema or data changes.

## References

- Roadmap: `context/foundation/roadmap.md` (S-10), PRD FR-017
- Notes table and RLS: `supabase/migrations/20261109120000_listening_notes.sql`
- Notes list markup: `src/pages/tracks/[id].astro:289-318`
- Filter pattern: `src/pages/recipes/index.astro`, `src/lib/recipes.ts:65-94`
- Existing helpers and tests: `src/lib/listening-notes.ts`, `tests/listening-notes.test.ts`, `tests/listening-notes-http.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Filter logic

#### Automated

- [x] 1.1 Unit tests pass: `npx vitest run tests/listening-notes.test.ts` — e26e069
- [x] 1.2 Linting passes: `npm run lint` — e26e069
- [x] 1.3 Type checking passes: `npx astro check` — e26e069

#### Manual

- [x] 1.4 The track page datalist still offers the same suggestions as before — e26e069

### Phase 2: Notes overview page

#### Automated

- [x] 2.1 All tests pass against local Supabase: `npm test` — e633f2e
- [x] 2.2 Linting passes: `npm run lint` — e633f2e
- [x] 2.3 Type checking passes: `npx astro check` — e633f2e
- [x] 2.4 Build succeeds: `npm run build` — e633f2e

#### Manual

- [x] 2.5 "Notes" in the navigation opens the overview; choosing equipment and pressing Filter narrows the list and keeps the choice selected after reload — e633f2e
- [x] 2.6 Track links open the right track at the notes section — e633f2e
- [x] 2.7 The page is readable on a phone-width window — e633f2e
