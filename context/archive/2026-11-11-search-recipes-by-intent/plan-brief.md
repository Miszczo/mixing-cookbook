# Search Recipes by Intent — Plan Brief

> Full plan: `context/changes/search-recipes-by-intent/plan.md`

## What & Why

FR-005 (must-have): the user searches and filters the starter recipe and their own recipes by intent. Intent is the main way into the cookbook, and this is the last slice of the milestone (S-06).

## Starting Point

`/recipes` lists only own recipes from Supabase (RLS). The starter recipe is the `RECIPES` constant in code and is visible only as a card on a Miks track.

## Desired End State

`/recipes` has a "Szukaj intencji" field plus plugin type and source filters (All/Starter/Mine). The results include the starter recipe (labelled "Starter", no Delete) and own recipes. "DOL wokal" finds "Czyszczenie dołu w wokalu". The URL with parameters can be bookmarked.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Matching | every word as a substring, ignoring case and Polish characters | forgives "dol" vs "dół" and word order |
| Filters | plugin type + source | the only existing fields; tells starter from own |
| Where | server, GET form, pure function in `src/lib` | no JS, easy to test, Astro per AGENTS.md |
| Starter in results | list row + "Starter" label | no new page; detail view is outside FR-005 |
| Order | starter first, then own from newest | no ranking by relevance |

## Scope

**In scope:** `normalizeIntent`, `filterRecipes`, `recipeSearchSchema`, the form and merged list on `/recipes`, unit tests, a two-user HTTP test.

**Out of scope:** detail page, migrations or searching in Postgres, live React search, searching steps, tags, ranking.

## Architecture / Approach

Astro page → zod parses `q/type/source` (invalid values → "all") → own recipes through RLS + `RECIPES` → `filterRecipes` → render. One matching rule in one place.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Recipe filter | pure function + unit tests | `ł` does not decompose under NFD, so it needs an explicit mapping |
| 2. Search on /recipes | form, starter in list, HTTP test | the starter recipe gets a Delete button or another user's recipe leaks into the results |

**Prerequisites:** local Supabase running for `npm test`.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- In-memory filtering assumes tens of recipes per user.

## Success Criteria (Summary)

- The user finds their recipe or the starter recipe by a fragment of the intent, without worrying about Polish characters.
- Filters narrow the list, and another user's recipes never show up.
