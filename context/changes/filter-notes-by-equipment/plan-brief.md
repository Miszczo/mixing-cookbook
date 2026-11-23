# Filter listening notes by equipment — Plan Brief

> Full plan: `context/changes/filter-notes-by-equipment/plan.md`

## What & Why

Roadmap S-10 (PRD FR-017): the user can filter listening notes across all tracks by reference equipment, so they can compare how mixes sounded on the same headphones, car or speakers without opening each track.

## Starting Point

Listening notes (`listening_notes`, RLS per owner) are shown only on a single track page. Equipment is trimmed free text; `equipmentSuggestions()` already merges names case-insensitively for the datalist. `/recipes` shows the filter pattern: GET form, zod URL schema with fallbacks, pure tested helpers.

## Desired End State

A new **Notes** page (`/notes`, in the main navigation, session required) lists the user's notes from all tracks, newest first, up to 200. An `Equipment` select (`All` + every name used) narrows the list: `DT 770` shows notes saved as `DT 770` or `dt 770`, but not `DT 770 Pro`. Each note shows date, equipment, stage, body and a link to its track.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Matching | Select of distinct names, exact match ignoring case | Same merging as the existing suggestions, no typos, predictable result. |
| Location | New page `/notes` in the navigation | A clean view like `/recipes`, easy to test over HTTP. |
| No filter | All notes, newest first, max 200, with a "more" notice | Useful on entry without building pagination. |
| Note item | Track-page fields + track name link; no delete | Read-only view for comparison; deletion stays on the track. |
| Select order | Alphabetical (Polish collation), newest spelling per name | Easier to scan than recency order. |
| Exact match in DB | Escaped `ilike` prefilter + JS `sameEquipment` re-check before the cap | PostgREST's `ilike` treats `*` as an unescapable wildcard. |
| Unknown URL value | Still filtered, shown as an extra selected option | The form never shows `All` while the list is filtered. |

## Scope

**In scope:** helpers + unit tests in `src/lib/listening-notes.ts`; `/notes` page; nav link; `PROTECTED_ROUTES`; HTTP tests incl. isolation and wildcard escaping.

**Out of scope:** substring matching or merging spelling variants, pagination, delete/add on `/notes`, other filters, any migration or index.

## Architecture / Approach

`src/pages/notes.astro` parses `?equipment=` with `notesFilterSchema`, then reads in parallel: equipment names (up to 1000 rows → `equipmentFilterOptions`) and notes with embedded `tracks(name)` (201 rows, `ilike` when filtered). Rows are re-checked with `sameEquipment`, capped at 200 and rendered like the track page list. Isolation relies on the existing RLS on `listening_notes` and `tracks`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Filter logic | URL schema, dedup/sort/match/escape helpers, unit tests | Changing `equipmentSuggestions` behaviour by accident |
| 2. Notes overview page | `/notes` page, nav, route protection, HTTP tests | Over-matching through `ilike` wildcards; leaking another user's notes |

**Prerequisites:** S-07 listening notes (done); local Supabase for `npm test`.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes Postgres `ilike` folds Polish letters (`Ó`/`ó`) the same way as JS `toLowerCase`; the HTTP test with `SAMOCHÓD` checks it.
- Names used only in notes older than the newest 1000 do not appear in the select (a URL with that name still filters).
- Within one filter only the newest 200 notes are shown.

## Success Criteria (Summary)

- From the navigation the user reaches all their notes and, with one select, sees only those for a chosen piece of equipment across tracks.
- Another user's notes never appear on the page.
