# In-Track Sidechain Card — Plan Brief

> Full plan: `context/changes/in-track-sidechain-card/plan.md`

## What & Why

The track page gets a "Sidechain stopy z basem" recipe card that names one concrete tool for this producer, with a checklist and a settings screenshot. This is the product's core hypothesis: a recipe is useful when intent, owned plugins, and a native DAW fallback produce one action.

## Starting Point

Plugins with a type and favorite flag, a primary DAW, and tracks with a stage all exist. There is no recipe data, selection rule, or stored progress, and own recipes (S-05) are not built.

## Desired End State

On a Miks track, "Potrzebuję przepisu" leads to a card with a suggested tool, an image, and six steps. Checked steps and a replaced tool survive a refresh and stay private. The card is never empty, even with no plugins or no DAW.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Order of tools | Favorite, other compatible plugin, native tool | FR-008 uses native only when no matching plugin exists, and US-01 puts favorites first |
| Two favorites | First alphabetically, id breaks a tie | Same rule as `/plugins`, predictable and testable |
| Stage | Miks only; other stages show a hint and keep progress | The PRD and roadmap describe a track in Miks |
| No DAW and no plugin | Generic "natywny kompresor Twojego DAW" with a link to `/dashboard` | The PRD forbids an empty card, and no tool name is known yet |
| Manual replacement | Saved per track; the list has plugins, native tool, and automatic | It must survive a refresh like the checklist does |
| Recipe storage | In code, `src/lib/recipes.ts` | S-05 adds the recipes table; a seeded table now needs extra policies for no benefit |
| UI | Astro server forms, no React | Same pattern as `/plugins`; no client state is needed |
| Language | PRD strings and recipe text in Polish, other labels in English | The PRD names these strings, and the rest of the UI is English |
| Screenshot | Placeholder PNG labelled `MOCK` | The owner asked for a mock for now |

## Scope

**In scope:**

- One starter recipe, the selection rule, and native tools for five DAWs
- Stored checklist steps and tool choice, with RLS
- Chooser and card on the track page, with HTTP and RLS tests

**Out of scope:**

- A recipes table, own recipes, upload, search, and listening notes
- The recipe on Aranż or Master tracks
- A screenshot per DAW, checklist reset, and browser E2E

## Architecture / Approach

`selectTool` in `src/lib/recipes.ts` is a pure function of plugins, DAW, required type, and stored choice. The track page reads those inputs, calls it, and renders `RecipeCard.astro`. Forms post to one route, `/api/tracks/[id]/recipes/[recipeId]`, which writes one row per track and recipe in `track_recipe_progress`. A failed read shows an alert, never the native fallback.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Selection rule and starter recipe | Tested pure rule and recipe data, via `/10x-tdd` | Test expectations copied from the code |
| 2. Stored progress | Migration, policies, and action route | Inserting a row for another user's track |
| 3. Card on the track page | Chooser, card, mock image, HTTP proof | Treating a failed read as "no plugins" |

**Prerequisites:** S-01, S-02, and S-03 are done, and local Supabase is running.
**Estimated effort:** About one session across 3 phases.

## Open Risks & Assumptions

- The screenshot is a visible mock until the owner replaces it, and the PRD's success criterion expects a real settings screenshot.
- The native tool names and checklist come from general knowledge. The PRD does not list them, and the owner considers them correct.
- One image serves all DAWs, so it cannot match each DAW's interface.
- Nothing in the repo applies migrations to production, so any deployment must run this one by hand.
- Local `npm test` will need any running `astro dev` stopped, because the test helper will refuse to run against another server.

## Success Criteria (Summary)

- A producer with a favorite compressor sees that plugin; one with no plugins sees their DAW's native tool, never an empty card.
- Checked steps and a replaced tool remain after a refresh and are invisible to other users.
- `npm test` covers risk #2 with expected values independent of the selection code.
