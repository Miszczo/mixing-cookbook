# Search Recipes by Intent Implementation Plan

## Overview

Roadmap S-06 / FR-005: on `/recipes` the user can search the starter recipe and their own recipes by intent and filter them by plugin type and source. Search runs on the server through a GET form (`q`, `type`, `source`). A pure function in `src/lib/recipes.ts` does the filtering.

## Current State Analysis

- Starter recipes are a code constant `RECIPES` (`src/lib/recipes.ts:38`), not rows in the database. Today they show up only as a card on a Miks track.
- `/recipes` (`src/pages/recipes/index.astro:7-12`) reads only own recipes (`RECIPE_COLUMNS`, RLS `recipes_select_own`), ordered by `created_at desc`, and shows Delete for each one.
- A recipe has `intent` (1–100 characters), `requiredType` (6 `PLUGIN_TYPES`, `src/lib/plugins.ts:3`) and `steps`. It has no tags or categories.
- `/recipes` is already in `PROTECTED_ROUTES` (`src/middleware.ts:4`).
- HTTP tests start the app and sign users in with helpers from `tests/helpers/http-app.ts` (pattern: `tests/recipes-http.test.ts`).

## Desired End State

`/recipes` shows a form with a text field "Szukaj intencji", a plugin type select (All + 6 types) and a source choice (All / Starter / Mine). The list holds the starter recipes (labelled "Starter", no Delete) and the user's own recipes, filtered by the three parameters. The URL `/recipes?q=dol+wokal&type=eq&source=own` can be bookmarked. When nothing matches, the page says no recipe matches and keeps the entered values in the form.

### Key Discoveries:

- `RECIPES` and `recipeFromRow` already give one shared `Recipe` type, so merging the two sources is trivial (`src/lib/recipes.ts:6-36`).
- The list page never reads `image_data` (`RECIPE_COLUMNS`), so filtering in memory stays cheap.
- An empty own-recipe list currently shows "No recipes yet. The starter recipe is available on Miks tracks." (`index.astro:27`). With the starter recipe now in the list, that branch changes.

## What We're NOT Doing

- No recipe detail page (`/recipes/[id]`) and no jump from a result to a track card.
- No migration, no searching in Postgres (`ilike`/`unaccent`), no full-text index.
- No live React search; the form is plain GET HTML.
- No searching inside steps; only `intent`.
- No ranking by relevance. Order: starter recipes first, then own recipes from newest.
- No tags or categories for intents.

## Implementation Approach

A pure function filters an array of `Recipe` tagged with its source. The Astro page parses the parameters with zod (invalid values fall back to "all"), fetches own recipes as it does today, prepends `RECIPES`, and renders the result. Matching: normalize to lower case, strip diacritics (NFD + remove combining marks, plus explicit `ł→l`, since `ł` does not decompose), split the query on whitespace; every word must appear as a substring of the normalized intent. An empty query matches everything.

## Phase 1: Recipe filter

### Overview

Pure search and filter logic with unit tests, with no UI.

### Changes Required:

#### 1. Normalization and filter

**File**: `src/lib/recipes.ts`

**Intent**: Add a text normalization function and a recipe filter so the page and the tests share one matching rule.

**Contract**: `export type RecipeSource = "starter" | "own"`; `export interface ListedRecipe { recipe: Recipe; source: RecipeSource }`; `export const recipeSearchSchema` (zod: `q` string trimmed to at most 100 characters, default `""`; `type` an enum of `PLUGIN_TYPE_IDS` or `"all"`; `source` `"all" | "starter" | "own"`; an invalid value → `"all"` through `.catch`); `export function normalizeIntent(text: string): string`; `export function filterRecipes(items: readonly ListedRecipe[], search: RecipeSearch): ListedRecipe[]`, which preserves input order.

#### 2. Unit tests

**File**: `tests/recipe-search.test.ts`

**Intent**: Pin down the matching rule with concrete cases.

**Contract**: cases: "DOL wokal" matches "Czyszczenie dołu w wokalu"; "stopy sidechain" (different word order) matches "Sidechain stopy z basem"; "reverb" matches neither intent; an empty query returns everything; `type=compressor` keeps only compressors; `source=own` drops starter recipes; invalid `type=xyz` → `"all"`; output order equals input order.

### Success Criteria:

#### Automated Verification:

- Search tests pass: `npx vitest run tests/recipe-search.test.ts`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`

---

## Phase 2: Search on /recipes

### Overview

Form, merging with the starter recipes, rendering the results, and HTTP proof with two users.

### Changes Required:

#### 1. Recipes page

**File**: `src/pages/recipes/index.astro`

**Intent**: Read `Astro.url.searchParams` through `recipeSearchSchema`, merge `RECIPES` (source `starter`) with own recipes (source `own`), and render `filterRecipes`. Add a GET form whose fields are pre-filled from the parameters.

**Contract**: form `method="get" action="/recipes"`, fields `q`, `type`, `source`, an accessible `<label>` for each. A starter row gets the label "Starter", has no Delete form, and shows `screenshot.src` for the mock image. If own recipes fail to load, keep the existing `role="alert"` message. No matches → "No recipes match your search." Leave the "New recipe" link unchanged.

#### 2. HTTP tests

**File**: `tests/recipes-search-http.test.ts`

**Intent**: Prove the search runs on the server and does not reveal another user's recipes.

**Contract**: user A creates the recipe "Czyszczenie dołu w wokalu" (EQ). Checks: A `GET /recipes?q=dol+wokal` → 200 containing that intent and not containing "Sidechain stopy z basem"; A `?source=starter` → contains "Sidechain stopy z basem" and not A's recipe; A `?type=compressor` → does not contain A's recipe; user B `?q=dol+wokal` → 200 without A's intent and with the no-matches message; signed out `GET /recipes?q=x` → 302 to `/auth/signin`.

### Success Criteria:

#### Automated Verification:

- Search HTTP tests pass: `npx vitest run tests/recipes-search-http.test.ts`
- All tests pass: `npm test`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Typing "dol wokal" on `/recipes` finds the own recipe "Czyszczenie dołu w wokalu", and the field keeps its value after submitting
- The starter recipe is listed with the label "Starter" and no Delete button
- Combining type and source filters narrows the list, and a search with no matches shows the message
- The form and the list are usable at phone width

**Implementation Note**: After the automated checks, pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- Normalization (case, diacritics, `ł`), multiple words in any order, empty query, each filter, fallback for invalid parameters.

### Integration Tests:

- HTTP with two users: owner isolation under every combination of `q`/`source`/`type`, plus the signed-out redirect.

### Manual Testing Steps:

1. Sign in, add the recipe "Czyszczenie dołu w wokalu" (EQ).
2. Search "DOL wokal" → one result; "sidechain" → the starter recipe.
3. Source "Mine" + type "Compressor" → no results and the message.
4. Check at phone width.

## Performance Considerations

Filtering in memory over the user's full list without images. Fine at the expected scale of tens of recipes.

## Migration Notes

None. No schema change.

## References

- Roadmap: `context/foundation/roadmap.md` S-06; PRD FR-005
- Similar implementation: `src/pages/recipes/index.astro:7-12`, `tests/recipes-http.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Recipe filter

#### Automated

- [x] 1.1 Search tests pass: `npx vitest run tests/recipe-search.test.ts` — 6eaf470
- [x] 1.2 Linting passes: `npm run lint` — 6eaf470
- [x] 1.3 Type checking passes: `npx astro check` — 6eaf470

### Phase 2: Search on /recipes

#### Automated

- [x] 2.1 Search HTTP tests pass: `npx vitest run tests/recipes-search-http.test.ts` — 92f8ecc
- [x] 2.2 All tests pass: `npm test` — 92f8ecc
- [x] 2.3 Linting passes: `npm run lint` — 92f8ecc
- [x] 2.4 Type checking passes: `npx astro check` — 92f8ecc
- [x] 2.5 Build passes: `npm run build` — 92f8ecc

#### Manual

- [x] 2.6 Typing "dol wokal" on `/recipes` finds the own recipe "Czyszczenie dołu w wokalu", and the field keeps its value after submitting — 92f8ecc
- [x] 2.7 The starter recipe is listed with the label "Starter" and no Delete button — 92f8ecc
- [x] 2.8 Combining type and source filters narrows the list, and a search with no matches shows the message — 92f8ecc
- [x] 2.9 The form and the list are usable at phone width — 92f8ecc
