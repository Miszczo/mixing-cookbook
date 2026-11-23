---
project: "Sound Intent & Mixing Cookbook CMS"
version: 1
status: draft
created: 2026-09-23
updated: 2026-11-23
prd_version: 1
main_goal: speed
top_blocker: capacity
milestone_id: nice-to-have-polish
milestone_seq: 2
milestone_status: open
---

# Roadmap: Sound Intent & Mixing Cookbook CMS

> Derived from context/foundation/prd.md (v1) + auto-researched codebase baseline.
> Edit-in-place; the next milestone continues this file. Archive only when an independent roadmap replaces it.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-2: Nice-to-have polish** — Status: open

- **Intent:** The required product path from M-1 is done; this milestone adds three small conveniences from the PRD's nice-to-have list that make everyday use faster: a ready listening-note template, a one-click Markdown copy of a recipe checklist, and a filter of listening notes by reference equipment.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-014, FR-015, FR-017

## Vision recap

Solo producent pracujący nad własnym utworem musi odnaleźć się w morzu własnych pluginów oraz narzędzi dostępnych w DAW. W trakcie pracy często wie, że ma odpowiednie narzędzie, ale nie pamięta szybko, którego pluginu użyć, co on dokładnie robi i jak zastosować go w konkretnej sytuacji miksowej.

Przepis miksowy powinien być kontekstowy: połączenie intencji, posiadanych pluginów i fallbacku na natywne narzędzia DAW daje producentowi gotową akcję zamiast kolejnej listy notatek.

## North star

**S-08: User can insert a listening-note template into the worklog text field** — speed puts this first: the PRD names the template in its secondary success criteria, so it is the only slice here that serves a stated success criterion.

> North star means the smallest end-to-end slice whose delivery would prove the milestone's main point. It sits first because its prerequisites are already done.

## At a glance

| ID    | Change ID                      | Outcome (user can …)                                           | Prerequisites | PRD refs | Status |
| ----- | ------------------------------ | -------------------------------------------------------------- | ------------- | -------- | ------ |
| S-08  | listening-note-template        | insert a listening-note template into the note field           | S-07          | FR-015   | done        |
| S-09  | copy-checklist-as-markdown     | copy a recipe checklist to the clipboard as Markdown           | S-04          | FR-014   | done |
| S-10  | filter-notes-by-equipment      | filter listening notes across all tracks by reference equipment | S-07          | FR-017   | in-progress |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below.

| Stream | Theme            | Chain   | Note                                                        |
| ------ | ---------------- | ------- | ----------------------------------------------------------- |
| A      | Listening worklog | `S-08`  | Serves the secondary success criterion; first for speed.    |
| B      | Recipe card      | `S-09`  | Standalone on the S-04 recipe card.                         |
| C      | Notes overview   | `S-10`  | Reads the notes from S-07 across tracks; standalone.        |

## Baseline

What's already in place in the codebase as of 2026-11-22 (all M-1 slices archived and done).
No foundations are needed: every slice below builds on pages and data that already exist.

- **Frontend:** present — Astro + React + Tailwind, track pages and recipe card (`src/pages/tracks/[id].astro`, `src/pages/recipes/index.astro`)
- **Backend / API:** present — server-rendered app with API routes
- **Data:** present — tracks, plugins, recipes and listening notes with per-user row isolation (`supabase/migrations/`)
- **Auth:** present — session middleware on protected routes (`src/middleware.ts`)
- **Deploy / infra:** partial — hosting adapter configured; CI checks, builds, smoke-tests, no auto-deploy
- **Observability:** partial — no application logging or error tracking

## Foundations

None. The Baseline already covers everything these slices need, and no layer would be built ahead of a user-visible slice.

## Slices

### S-08: Insert a listening-note template into the note field

- **Outcome:** User can insert a listening-note template into the note field.
- **Change ID:** listening-note-template
- **PRD refs:** FR-015
- **Prerequisites:** S-07
- **Parallel with:** S-09, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Small change on the existing note form; the risk is overwriting text the user already typed, so insertion must keep it.
- **Status:** done

### S-09: Copy a recipe checklist to the clipboard as Markdown

- **Outcome:** User can copy a recipe checklist to the clipboard as Markdown.
- **Change ID:** copy-checklist-as-markdown
- **PRD refs:** FR-014
- **Prerequisites:** S-04
- **Parallel with:** S-08, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Clipboard access needs a secure context and a user click; a failed copy must show a clear message.
- **Status:** done

### S-10: Filter listening notes across all tracks by reference equipment

- **Outcome:** User can filter listening notes across all tracks by reference equipment.
- **Change ID:** filter-notes-by-equipment
- **PRD refs:** FR-017
- **Prerequisites:** S-07
- **Parallel with:** S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Needs a view over notes from all tracks; the risk is leaking another user's notes, so it must stay under the same row isolation.
- **Status:** in-progress

## Backlog Handoff

| Roadmap ID | Change ID                  | Suggested issue title                                  | Ready for `/10x-plan` | Notes |
| ---------- | -------------------------- | ------------------------------------------------------ | --------------------- | ----- |
| S-08       | listening-note-template    | Insert a listening-note template into the note field   | yes                   | Run `/10x-plan listening-note-template` |
| S-09       | copy-checklist-as-markdown | Copy a recipe checklist as Markdown                    | yes                   | Parallel with S-08 and S-10 |
| S-10       | filter-notes-by-equipment  | Filter listening notes across tracks by equipment      | yes                   | Parallel with S-08 and S-09 |

## Open Roadmap Questions

None. The PRD lists no open questions, and these slices add no cross-slice decision.

## Parked

- **Marketplace, ratings, comments, and public recipe sharing** — Why parked: PRD §Non-Goals; the product stays a personal tool.
- **DAW or VST preset file export** — Why parked: PRD §Non-Goals; a recipe stays an instruction and a checklist.
- **A plugin or integration inside the DAW, including parameter automation** — Why parked: PRD §Non-Goals; the DAW is only the context for native-tool names.
- **Popularity ranking or recommendations from other users' plugins** — Why parked: PRD §Non-Goals; matching stays per user.
- **FR-016: Paste a screenshot from the clipboard** — Why parked: nice-to-have; PRD notes it complicates image handling and file upload is enough.
- **FR-018: Percentage progress on a track** — Why parked: nice-to-have; PRD keeps it out of the MVP because it creates false precision.
- **Production auto-deploy** — Why parked: capacity and speed keep this milestone on small product slices; local verification is enough.

## Milestone History

- **M-1: In-track sidechain recipe** (`in-track-sidechain-recipe`) — closed 2026-11-22. A signed-in producer can open a Miks track, get the sidechain recipe card, author own recipes with a screenshot, search recipes by intent, and keep listening notes.

## Done

| Roadmap ID | Change ID              | Archived | Note |
| ---------- | ---------------------- | -------- | ---- |
| F-01 | per-user-row-isolation | 2026-11-01 | (foundation) New application rows are stored so a signed-in user can read and write only their own; product tables are still created by the first slice that needs each one. Archived to `context/archive/2026-09-23-per-user-row-isolation/`. Lesson: —. |
| S-01       | primary-daw-profile          | 2026-11-01 | User can sign in and choose a primary DAW. Archived to `context/archive/2026-10-20-primary-daw-profile/`. Lesson: —. |
| S-02 | plugin-inventory-favorites | 2026-11-01 | User can add, edit, and delete owned plugins with a name and a type, and can mark favorites. Archived to `context/archive/2026-11-01-plugin-inventory-favorites/`. Lesson: —. |
| S-03 | track-stage-status | 2026-11-01 | User can create and edit a track with a name and a stage such as Aranż, Miks, or Master. Archived to `context/archive/2026-11-01-track-stage-status/`. Lesson: —. |
| S-04 | in-track-sidechain-card | 2026-11-03 | User can open a Miks track, choose "Sidechain stopy z basem" and see a recipe card with a checklist, a screenshot and a suggested tool. Archived to `context/archive/2026-11-01-in-track-sidechain-card/`. Lesson: —. |
| S-05 | author-recipe-with-screenshot | 2026-11-09 | User can create a recipe with an intent, a required plugin type, a checklist, and an uploaded settings image. Archived to `context/archive/2026-11-03-author-recipe-with-screenshot/`. Lesson: —. |
| S-07 | track-listening-notes | 2026-11-11 | User can add a listening note to a track with reference equipment and sound notes, and can read that track's notes in chronological order after a refresh. Archived to `context/archive/2026-11-09-track-listening-notes/`. Lesson: —. |
| S-06 | search-recipes-by-intent | 2026-11-22 | User can search and filter starter recipes and their own recipes by intent. Archived to `context/archive/2026-11-11-search-recipes-by-intent/`. Lesson: —. |
| S-08 | listening-note-template | 2026-11-22 | User can insert a listening-note template into the note field. Archived to `context/archive/2026-11-22-listening-note-template/`. Lesson: —. |
| S-09 | copy-checklist-as-markdown | 2026-11-23 | User can copy a recipe checklist to the clipboard as Markdown. Archived to `context/archive/2026-11-23-copy-checklist-as-markdown/`. Lesson: —. |
