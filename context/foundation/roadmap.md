---
project: "Sound Intent & Mixing Cookbook CMS"
version: 1
status: draft
created: 2026-09-23
updated: 2026-11-24
prd_version: 1
main_goal: low-complexity
top_blocker: none
milestone_id: paste-and-track-progress
milestone_seq: 3
milestone_status: open
---

# Roadmap: Sound Intent & Mixing Cookbook CMS

> Derived from context/foundation/prd.md (v1), next tranche after M-1 and M-2, + confirmed codebase baseline.
> Edit-in-place; the next milestone continues this file. Archive only when an independent roadmap replaces it.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-3: Paste close-out and track progress** — Status: open

- **Intent:** The required product path and the earlier conveniences are done. This milestone closes out clipboard paste, which is already in the product, then adds the track progress percentage the PRD kept beside the first version because a percentage can pretend to be more precise than the work is.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-016, FR-018

## Vision recap

Solo producent pracujący nad własnym utworem musi odnaleźć się w morzu własnych pluginów oraz narzędzi dostępnych w DAW. W trakcie pracy często wie, że ma odpowiednie narzędzie, ale nie pamięta szybko, którego pluginu użyć, co on dokładnie robi i jak zastosować go w konkretnej sytuacji miksowej.

Przepis miksowy powinien być kontekstowy: połączenie intencji, posiadanych pluginów i fallbacku na natywne narzędzia DAW daje producentowi gotową akcję zamiast kolejnej listy notatek.

## North star

**S-11: User can paste a screenshot from the clipboard into the new-recipe form** — low complexity puts the already-built paste first, so the milestone starts by closing that slice instead of opening a new scoring rule.

> North star means the smallest end-to-end slice whose delivery would prove this milestone's point. It sits first because its prerequisites are already done.

## At a glance

| ID    | Change ID                              | Outcome (user can …)                                              | Prerequisites | PRD refs | Status |
| ----- | -------------------------------------- | ----------------------------------------------------------------- | ------------- | -------- | ------ |
| S-11  | paste-recipe-screenshot-from-clipboard | paste a screenshot from the clipboard into the new-recipe form    | —             | FR-016   | done   |
| S-12  | track-progress-percent                 | see a percentage of completed checklist steps on a track          | —             | FR-018   | ready  |

## Baseline

What's already in place in the codebase as of 2026-11-24 (confirmed; no new foundations).
No foundations are needed: both slices sit on pages and data that already exist.

- **Frontend:** present — recipe form, track page, and recipe card already render
- **Backend / API:** present — server-rendered app with API routes
- **Data:** present — tracks, plugins, recipes, checklist progress, and listening notes, each isolated per signed-in user
- **Auth:** present — session check on protected routes
- **Deploy / infra:** partial — hosting adapter configured; checks run in CI; no automatic production deploy
- **Observability:** partial — no application logging or error tracking

Clipboard paste into the new-recipe form is already implemented and manually checked. The change folder is still open; it is not archived.

## Foundations

None. The Baseline already covers everything these slices need, and no layer would be built ahead of a user-visible slice.

## Slices

### S-11: Paste a screenshot from the clipboard into the new-recipe form

- **Outcome:** User can paste a screenshot from the clipboard into the new-recipe form.
- **Change ID:** paste-recipe-screenshot-from-clipboard
- **PRD refs:** FR-016
- **Prerequisites:** —
- **Parallel with:** S-12
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The behavior is already implemented. Planning it again would duplicate that change. The remaining step is to archive the open change folder.
- **Status:** done

### S-12: See a percentage of completed checklist steps on a track

- **Outcome:** User can see a percentage of completed checklist steps on a track.
- **Change ID:** track-progress-percent
- **PRD refs:** FR-018
- **Prerequisites:** —
- **Parallel with:** S-11
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The PRD allows stages or steps and warns that a percentage can pretend to be more precise than creative work is. This slice uses the checklist steps already stored for the track, and does not invent a score across stages.
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID                              | Suggested issue title                                      | Ready for `/10x-plan` | Notes |
| ---------- | -------------------------------------- | ---------------------------------------------------------- | --------------------- | ----- |
| S-11       | paste-recipe-screenshot-from-clipboard | Paste a screenshot from the clipboard into the recipe form | no                    | Already implemented. Run `/10x-archive paste-recipe-screenshot-from-clipboard`. Do not re-plan. |
| S-12       | track-progress-percent                 | Show a percentage of completed checklist steps on a track  | yes                   | Run `/10x-plan track-progress-percent` after S-11 is archived |

## Open Roadmap Questions

None. The PRD lists no open questions, and these slices add no cross-slice decision.

## Parked

- **Marketplace, ratings, comments, and public recipe sharing** — Why parked: PRD §Non-Goals; the product stays a personal tool.
- **DAW or VST preset file export** — Why parked: PRD §Non-Goals; a recipe stays an instruction and a checklist.
- **A plugin or integration inside the DAW, including parameter automation** — Why parked: PRD §Non-Goals; the DAW is only the context for native-tool names.
- **Popularity ranking or recommendations from other users' plugins** — Why parked: PRD §Non-Goals; matching stays per user.
- **Production auto-deploy** — Why parked: low complexity keeps this milestone on the two remaining product slices; local verification is enough.

## Milestone History

- **M-1: In-track sidechain recipe** (`in-track-sidechain-recipe`) — closed 2026-11-22. A signed-in producer can open a Miks track, get the sidechain recipe card, author own recipes with a screenshot, search recipes by intent, and keep listening notes.
- **M-2: Nice-to-have polish** (`nice-to-have-polish`) — closed 2026-11-24. The producer can insert a listening-note template, copy a recipe checklist as Markdown, and filter listening notes across tracks by reference equipment.

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
| S-10 | filter-notes-by-equipment | 2026-11-23 | User can filter listening notes across all tracks by reference equipment. Archived to `context/archive/2026-11-23-filter-notes-by-equipment/`. Lesson: —. |
| S-11 | paste-recipe-screenshot-from-clipboard | 2026-11-24 | User can paste a screenshot from the clipboard into the new-recipe form. Archived to `context/archive/2026-11-23-paste-recipe-screenshot-from-clipboard/`. Lesson: —. |
