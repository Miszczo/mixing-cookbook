---
project: "Sound Intent & Mixing Cookbook CMS"
version: 1
status: draft
created: 2026-09-23
updated: 2026-09-23
prd_version: 1
main_goal: speed
top_blocker: capacity
milestone_id: in-track-sidechain-recipe
milestone_seq: 1
milestone_status: open
---

# Roadmap: Sound Intent & Mixing Cookbook CMS

> Derived from context/foundation/prd.md (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: In-track sidechain recipe** — Status: open

- **Intent:** A signed-in producer can open a track in the Miks stage, choose the intent "Sidechain stopy z basem", and get one recipe card with a checklist, a settings screenshot, and a concrete tool — a favorite matching plugin, or the DAW's native tool when no match exists. Listening notes on a track ship in the same milestone because they are required, but they are not the first proof.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-001–FR-013, US-01

## Vision recap

Solo producent pracujący nad własnym utworem musi odnaleźć się w morzu własnych pluginów oraz narzędzi dostępnych w DAW. W trakcie pracy często wie, że ma odpowiednie narzędzie, ale nie pamięta szybko, którego pluginu użyć, co on dokładnie robi i jak zastosować go w konkretnej sytuacji miksowej.

Przepis miksowy powinien być kontekstowy: połączenie intencji, posiadanych pluginów i fallbacku na natywne narzędzia DAW daje producentowi gotową akcję zamiast kolejnej listy notatek.

## North star

**S-04: User can open a Miks track, choose "Sidechain stopy z basem", and get a matched recipe card** — speed puts this first among user-visible work, because the required path should prove the product before own-recipe browsing and the listening worklog.

> North star means the smallest end-to-end slice whose delivery would prove the core hypothesis — the belief that a recipe is useful only when intent, owned plugins, and a native DAW fallback produce one concrete action. It sits as early as its prerequisites allow, because the other slices matter only if this works.

## At a glance

| ID    | Change ID                     | Outcome (user can …)                                      | Prerequisites           | PRD refs                  | Status   |
| ----- | ----------------------------- | --------------------------------------------------------- | ----------------------- | ------------------------- | -------- |
| F-01  | per-user-row-isolation        | (foundation) per-user row isolation for new app data      | —                       | FR-001                    | in-progress |
| S-01  | primary-daw-profile           | sign in and choose a primary DAW                          | F-01                    | FR-001, FR-002            | proposed |
| S-02  | plugin-inventory-favorites    | add, edit, and delete plugins, and mark favorites         | F-01                    | FR-003, FR-004            | proposed |
| S-03  | track-stage-status            | create and edit a track with a name and stage             | F-01                    | FR-010                    | proposed |
| S-04  | in-track-sidechain-card       | get a matched sidechain recipe card inside a Miks track   | S-01, S-02, S-03        | US-01, FR-008, FR-009, FR-011 | proposed |
| S-05  | author-recipe-with-screenshot | save an own recipe with checklist and screenshot          | F-01                    | FR-006, FR-007            | proposed |
| S-06  | search-recipes-by-intent      | search and filter starter and own recipes by intent       | S-04, S-05              | FR-005                    | proposed |
| S-07  | track-listening-notes         | add a listening note to a track and read them in order    | S-03                    | US-01, FR-012, FR-013     | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                 | Chain                    | Note                                                                                          |
| ------ | --------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| A      | In-track recipe       | `F-01` → `S-01` → `S-04` | Shortest required path to the card; `S-04` is where streams B and C join.                    |
| B      | Plugin inventory      | `S-02`                   | Runs beside stream A after `F-01`; joins stream A at `S-04`.                                 |
| C      | Tracks and listening  | `S-03` → `S-07`          | Joins stream A at `S-04`; the listening note stays off the card's critical path.             |
| D      | Own cookbook          | `S-05` → `S-06`          | Joins stream A at `S-04`, because search includes the starter recipe the card already shows. |

## Baseline

What's already in place in the codebase as of 2026-09-23 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro + React + Tailwind, file-based pages, shadcn/ui (`package.json`, `astro.config.mjs`, `src/pages/index.astro`, `components.json`)
- **Backend / API:** present — server-rendered app with wired sign-in, sign-up, and sign-out handlers (`astro.config.mjs`, `src/pages/api/auth/`)
- **Data:** partial — database client exists; no application tables or migrations (`src/lib/supabase.ts`, `supabase/config.toml` only)
- **Auth:** present — sign-in issues a session and middleware checks it on protected routes (`src/pages/api/auth/signin.ts`, `src/middleware.ts`)
- **Deploy / infra:** partial — hosting adapter is configured; CI checks, builds, and smoke-tests, and does not deploy (`wrangler.jsonc`, `.github/workflows/ci.yml`)
- **Observability:** partial — no application logging or error tracking; platform observability flag only (`wrangler.jsonc`)

## Foundations

### F-01: Per-user row isolation

- **Outcome:** (foundation) New application rows are stored so a signed-in user can read and write only their own; product tables are still created by the first slice that needs each one.
- **Change ID:** per-user-row-isolation
- **PRD refs:** FR-001, Access Control
- **Unlocks:** S-01, S-02, S-03, S-04, S-05, S-07; verification path that a second signed-in user cannot read the first user's rows
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because every later slice stores private data and the baseline has no application tables; the isolation rule is fixed once here so those slices do not invent their own.
- **Status:** in-progress

## Slices

### S-01: Primary DAW on the profile

- **Outcome:** User can sign in and choose a primary DAW so later recipes can name that DAW's native tools.
- **Change ID:** primary-daw-profile
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** F-01
- **Parallel with:** S-02, S-03, S-05, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sign-in already exists, so this slice only adds the DAW choice; without it the native fallback in S-04 has nothing to name.
- **Status:** proposed

### S-02: Plugin inventory and favorites

- **Outcome:** User can add, edit, and delete owned plugins with a name and a type, and can mark favorites.
- **Change ID:** plugin-inventory-favorites
- **PRD refs:** FR-003, FR-004
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-03, S-05, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Catalog fields stay limited to what matching needs; an empty inventory is valid and is what S-04's native fallback is for.
- **Status:** proposed

### S-03: Track name and stage

- **Outcome:** User can create and edit a track with a name and a stage such as Aranż, Miks, or Master.
- **Change ID:** track-stage-status
- **PRD refs:** FR-010
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The card in S-04 and the listening note in S-07 both need a track; stage is enough, and tempo or genre stay out.
- **Status:** proposed

### S-04: Sidechain recipe card inside a track

- **Outcome:** User can open a track in the Miks stage, choose "Sidechain stopy z basem", and see a recipe card with a checklist, a settings screenshot, and a suggested tool — a favorite matching plugin first, otherwise the primary DAW's native tool — then mark checklist steps done.
- **Change ID:** in-track-sidechain-card
- **PRD refs:** US-01, FR-008, FR-009, FR-011
- **Prerequisites:** S-01, S-02, S-03
- **Parallel with:** S-05, S-07
- **Blockers:** —
- **Unknowns:**
  - Which DAW names and native-tool labels belong in the first fallback map — Owner: user. Block: no.
  - Checklist text and settings screenshot for the starter "Sidechain stopy z basem" recipe — Owner: user. Block: no.
- **Risk:** This is the earliest slice that exercises matching; own-recipe authoring is not a prerequisite, so a starter recipe is seeded here rather than waiting on S-05.
- **Status:** proposed

### S-05: Author a recipe with a screenshot

- **Outcome:** User can create a recipe with an intent, a required plugin type, a checklist, and an uploaded settings image.
- **Change ID:** author-recipe-with-screenshot
- **PRD refs:** FR-006, FR-007
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-03, S-04, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Authoring can run beside the card because the starter recipe already proves S-04; image upload starts here, where the user first supplies a file.
- **Status:** proposed

### S-06: Search recipes by intent

- **Outcome:** User can search and filter starter recipes and their own recipes by intent.
- **Change ID:** search-recipes-by-intent
- **PRD refs:** FR-005
- **Prerequisites:** S-04, S-05
- **Parallel with:** S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Search waits until both the starter card and an own recipe exist, so the filter is not an empty browser shipped before the card.
- **Status:** proposed

### S-07: Listening notes on a track

- **Outcome:** User can add a listening note to a track with reference equipment and sound notes, and can read that track's notes in chronological order after a refresh.
- **Change ID:** track-listening-notes
- **PRD refs:** US-01, FR-012, FR-013
- **Prerequisites:** S-03
- **Parallel with:** S-01, S-02, S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The note is required, but it does not feed the card, so it stays off the path into S-04 and can run as soon as a track exists.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                     | Suggested issue title                                      | Ready for `/10x-plan` | Notes                                      |
| ---------- | ----------------------------- | ---------------------------------------------------------- | --------------------- | ------------------------------------------ |
| F-01       | per-user-row-isolation        | Isolate each signed-in user's application rows             | yes                   | Run `/10x-plan per-user-row-isolation`     |
| S-01       | primary-daw-profile           | Let the user choose a primary DAW                          | no                    | After F-01                                 |
| S-02       | plugin-inventory-favorites    | Let the user catalog plugins and mark favorites            | no                    | After F-01; parallel with S-01 and S-03    |
| S-03       | track-stage-status            | Let the user create a track with a stage                   | no                    | After F-01; parallel with S-01 and S-02    |
| S-04       | in-track-sidechain-card       | Show a matched sidechain recipe card inside a Miks track   | no                    | After S-01, S-02, and S-03                 |
| S-05       | author-recipe-with-screenshot | Let the user save a recipe with a checklist and screenshot | no                    | After F-01; parallel with the card path    |
| S-06       | search-recipes-by-intent      | Let the user search recipes by intent                      | no                    | After S-04 and S-05                        |
| S-07       | track-listening-notes         | Let the user keep ordered listening notes on a track       | no                    | After S-03; parallel with the card path    |

## Open Roadmap Questions

None. The PRD lists no open questions, and sequencing did not add a cross-slice decision. Per-slice unknowns stay on S-04 and do not gate planning.

## Parked

- **Marketplace, ratings, comments, and public recipe sharing** — Why parked: PRD §Non-Goals; the product stays a personal tool.
- **DAW or VST preset file export** — Why parked: PRD §Non-Goals; a recipe stays an instruction and a checklist.
- **A plugin or integration inside the DAW, including parameter automation** — Why parked: PRD §Non-Goals; the DAW is only the context for native-tool names.
- **Popularity ranking or recommendations from other users' plugins** — Why parked: PRD §Non-Goals; matching stays per user.
- **FR-014: Copy a checklist to the clipboard as Markdown** — Why parked: nice-to-have; speed keeps it off the required path.
- **FR-015: Insert a listening-note template** — Why parked: nice-to-have, including the secondary success criterion; speed keeps it off the required path.
- **FR-016: Paste a screenshot from the clipboard** — Why parked: nice-to-have; file upload in S-05 is enough.
- **FR-017: Filter listening notes across tracks by equipment** — Why parked: nice-to-have; per-track history in S-07 is enough.
- **FR-018: Percentage progress on a track** — Why parked: nice-to-have; the PRD keeps it out of the first version.
- **Production auto-deploy** — Why parked: hosting config exists and CI already checks the app; capacity and speed keep this milestone on the required product path, with local verification enough for these slices.

## Milestone History

(Empty on the first milestone.)

## Done

(Empty on first generation. `/10x-archive` appends an entry here when a change whose Change ID matches an item is archived.)
