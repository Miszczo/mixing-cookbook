# In-Track Sidechain Card Implementation Plan

## Overview

Add the "Sidechain stopy z basem" recipe card to the track page. The card suggests one concrete tool, shows a settings screenshot and a checklist, and keeps checked steps and a manual tool choice across refreshes. This is roadmap slice S-04 (PRD: US-01, FR-008, FR-009, FR-011) and the main business rule of the product.

## Current State Analysis

The inputs exist, the card does not. Owned plugins have a type and a favorite flag, the profile holds one of five DAW ids, and `/tracks/[id]` edits a track's name and stage. There is no recipe data, no selection rule, and no stored progress. Own-recipe authoring (S-05) is not a prerequisite, so one starter recipe ships with this slice.

## Desired End State

On a track in the Miks stage, the producer clicks "Potrzebuję przepisu", chooses "Sidechain stopy z basem", and sees a card with a suggested tool, a screenshot, and six steps. They can check steps and replace the tool, and both survive a refresh. Another user cannot read or change any of it.

The suggested tool, for a recipe that requires a compressor:

| The user has | Suggested tool |
| --- | --- |
| One or more favorite compressors | First favorite alphabetically |
| Compressors, none favorite | First compressor alphabetically |
| No compressors, DAW selected | That DAW's native tool |
| No compressors, no DAW selected | "natywny kompresor Twojego DAW" with a link to `/dashboard` |

Verify with `npm test` and the manual steps in Phase 3.

### Key Discoveries:

- `src/lib/plugins.ts:21` already validates `plugin_type` and `is_favorite`; `compressor` is a fixed type id.
- `src/pages/plugins.astro:15` orders by favorite, then name, so the suggestion follows the same rule as `/plugins`: favorites, then name. `selectTool` compares names in JavaScript, so unusual names may sort differently than the database collation; the tests pin the JavaScript comparator.
- `src/lib/primary-daw.ts:1` holds the five DAW ids the native-tool map must cover.
- `src/pages/api/plugins/[id].ts` is the pattern for a POST route with an `action` field and a guarded `formData()`.
- `context/foundation/test-plan.md:51` sets the proof for risk #2: integration on fixture data, with expected values not copied from the selection function, and an empty card must not count as success.
- A foreign key check bypasses RLS on the referenced table, so the progress table's own policies must check track ownership.

## What We're NOT Doing

- A recipes table, own recipes, or upload (S-05). The starter recipe lives in code.
- Search or filtering by intent (S-06). The chooser lists one intent.
- Listening notes (S-07) and clipboard export (FR-014).
- Showing the recipe on Aranż or Master tracks. Stored progress is kept and returns with the Miks stage.
- A screenshot per DAW. One image serves all five.
- Resetting a checklist or deleting progress. RLS grants no delete.
- Browser E2E. It is delivery step 3 and has its own skill.

## Implementation Approach

Keep the rule a pure function so it can be tested first, without a database. Then store progress, then render. The page reads data, calls the function, and renders the result, so the card has one source for its suggestion.

## Critical Implementation Details

- **Failed reads are not empty reads.** The native fallback applies only when the plugin read succeeded and found nothing. If reading plugins, the profile, or progress fails, the page shows an alert in place of the card, because recommending a native tool after a failed query would be wrong.
- **Upsert named columns only.** Each action upserts only the columns it changes, so checking a step cannot clear a tool choice, and the reverse.

## Phase 1: Selection rule and starter recipe

### Overview

Write the recipe data and the pure selection function, test-first (`/10x-tdd`). This phase covers risk #2 without any UI.

### Changes Required:

#### 1. Recipe data and selection rule

**File**: `src/lib/recipes.ts`

**Intent**: Hold the starter recipe, the native tool per DAW, and the rule that picks the tool, so the page and the API share one definition.

**Contract**:

- `RECIPES` holds one recipe: id `sidechain-kick-bass`, intent `Sidechain stopy z basem`, required type `compressor`, six steps with stable string ids, and a screenshot (`src`, `alt`).
- Step text, in order:
  1. Wstaw kompresor na ślad basu.
  2. Ustaw stopę jako wejście sidechain kompresora.
  3. Ustaw ratio na ok. 4:1 i szybki attack, ok. 1–5 ms.
  4. Obniżaj threshold, aż bas ściszy się o ok. 3–6 dB na każdym uderzeniu stopy.
  5. Ustaw release tak, żeby bas wracał przed kolejną stopą.
  6. Sprawdź efekt w całym miksie, włączając i wyłączając kompresor.
- Native compressor labels, typed so all five `PrimaryDawId` values are required: Ableton Live `Compressor`, FL Studio `Fruity Limiter (sekcja kompresji)`, Logic Pro `Compressor`, Bitwig Studio `Compressor`, Reaper `ReaComp`.
- `selectTool({ plugins, dawId, requiredType, choice })` is pure and returns `{ tool, suggested, compatible, native }`:
  - `compatible` holds plugins of the required type: favorites first, then by name, compared case-insensitively, with id breaking a tie.
  - `suggested` is the first compatible plugin, otherwise the native tool.
  - `native` is the DAW's tool, or the generic tool when `dawId` is null. It is never null or empty.
  - `tool` applies `choice` (`auto`, `native`, or a plugin id). A plugin id missing from `compatible` is treated as `auto`, which covers a deleted plugin and a changed type.

#### 2. Selection tests

**File**: `tests/recipe-tool-selection.test.ts`

**Intent**: Prove risk #2 on fixtures, with expected labels written out in the test rather than read from `src/lib/recipes.ts`.

**Contract**: Cases cover each row of the Desired End State table, all five DAWs, two favorites in non-alphabetical input order, a favorite named after a non-favorite alphabetically, plugins of other types only, a stale plugin choice, and a `native` choice while a favorite exists.

### Success Criteria:

#### Automated Verification:

- `npx vitest run tests/recipe-tool-selection.test.ts` passes
- `npm run lint` passes
- `npx astro check` passes

**Implementation Note**: Phase 1 has no manual steps. Continue to Phase 2 once these pass.

---

## Phase 2: Stored progress

### Overview

Store checked steps and the tool choice per track and recipe, behind an owner-only API.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261101130000_track_recipe_progress.sql`

**Intent**: Add one row per track and recipe, owned by a user who must also own the track.

**Contract**: Table `track_recipe_progress`:

- `user_id` references `auth.users`, cascade on delete
- `track_id` references `tracks`, cascade on delete
- `recipe_id` text
- `completed_steps` text array, default empty
- `selected_plugin_id` references `plugins`, set null on delete
- `use_native` boolean, default false
- `updated_at`
- Primary key `(track_id, recipe_id)`, and a check that `selected_plugin_id` and `use_native` are not both set

RLS is enabled, with `select`, `insert`, and `update` policies for `authenticated`. The update policy states both `using` and `with check`, as `20261101120100_tracks.sql` does. Insert and update checks require `user_id = auth.uid()`, that the track belongs to that user, and that `selected_plugin_id` is null or belongs to that user. Both ownership checks are needed because foreign key checks bypass RLS, so a direct PostgREST call could otherwise store another user's id and learn whether it exists. There is no delete policy. All is revoked from `anon` and `authenticated`, then those three operations are granted to `authenticated`.

#### 2. Progress route

**File**: `src/pages/api/tracks/[id]/recipes/[recipeId].ts`

**Intent**: Handle both card actions in one route, following the plugin route's pattern.

**Contract**: `POST` with `prerender = false` and a guarded `formData()`.

- Returns 401 without a user, and 404 for a malformed id, an unknown recipe, or a track RLS does not return.
- A zod discriminated union on `action` accepts `toggle-step` (`step` must be a step id of this recipe, `done` is a boolean) and `choose-tool` (`tool` is `auto`, `native`, or a uuid).
- A plugin uuid must resolve through RLS to the user's plugin of the required type.
- Invalid input redirects 303 to `/tracks/<id>?recipe=<recipeId>&error=invalid_recipe_action` without writing.
- A track outside the Miks stage redirects 303 to `/tracks/<id>` without writing.
- Success redirects 303 to `/tracks/<id>?recipe=<recipeId>`.
- Each write is a single-object upsert on `track_id,recipe_id` carrying `user_id` and `updated_at`, because there is no column default for the owner and no trigger for the timestamp.
- `choose-tool` always writes both `selected_plugin_id` and `use_native`, so switching between a plugin and the native tool cannot violate the check.
- `toggle-step` reads the array, changes one id, and writes it back. Last write wins for one owner on one page; two rapid clicks can lose a step, which a refresh shows and a click repairs.

#### 3. RLS and route tests

**File**: `tests/recipe-progress-rls.test.ts`

**Intent**: Prove ownership at the database, following `tests/primary-daw-rls.test.ts`.

**Contract**: A second user cannot read the row, cannot update it, and cannot insert a row for the first user's track even with their own `user_id`. A user cannot store another user's plugin id. Anonymous access is denied. A blocked `.update()` returns no rows and no error, so prove it by re-reading as the owner. Writing one column preserves the others on conflict.

### Success Criteria:

#### Automated Verification:

- Local Supabase applies the migration: `npx supabase migration up --local`
- `npx vitest run tests/recipe-progress-rls.test.ts` passes
- `npm run lint` passes
- `npx astro check` passes

**Implementation Note**: Phase 2 has no manual steps. Continue to Phase 3 once these pass.

---

## Phase 3: Card on the track page

### Overview

Render the chooser and the card, and prove the whole flow over HTTP.

### Changes Required:

#### 1. Screenshot asset

**File**: `public/recipes/sidechain-settings-mock.png`

**Intent**: Give the card the screenshot the PRD requires until the owner supplies a real one.

**Contract**: A 1200×675 placeholder generated by placehold.co, labelled `MOCK`. The recipe's `alt` says it is a sample image. Replacing it later means swapping this file and the recipe's `src`.

#### 2. Recipe card

**File**: `src/components/recipes/RecipeCard.astro`

**Intent**: Render one recipe from the output of `selectTool` and the stored steps, using server forms and no client JavaScript, like `/plugins`.

**Contract**:

- Props: `trackId`, the recipe, the `selectTool` result, the completed step ids, and whether a DAW is set.
- Shows the active tool. With no DAW and a native tool, it links to `/dashboard`.
- Tells the user they can choose when more than one tool is available.
- A replacement `select` lists automatic selection, compatible plugins with favorites marked, and the native tool.
- Each step is a form that toggles it, shows its state, and has an accessible name containing the step text.
- The screenshot has `alt` text, and the layout works at phone width.

#### 3. Track page

**File**: `src/pages/tracks/[id].astro`

**Intent**: Offer the recipe only in the Miks stage and open the card when asked for or already started.

**Contract**:

- On a Miks track, a `details` element labelled "Potrzebuję przepisu" lists the intent as a link to `?recipe=sidechain-kick-bass`.
- The card opens when that parameter names a known recipe, or when a progress row exists.
- Plugins of the required type, the profile, and progress are read in parallel only for Miks tracks. If any read fails, an alert replaces the card and the edit form still works.
- `?error=invalid_recipe_action` shows an alert.
- Other stages show a short hint to switch to Miks, and no card.
- Saving the track's name or stage redirects to the bare track URL, so a card with no stored progress closes and reopens from the chooser. Nothing is lost, so this stays as is.
- Follow `src/pages/dashboard.astro:10` for the profile read, so a read error or an unknown id is a failed read rather than "no DAW".

#### 4. HTTP test

**File**: `tests/recipe-card-http.test.ts`

**Intent**: Prove the flow against the running app with two users, following `tests/plugins-tracks-http.test.ts`.

**Contract**: Expected labels are written in the test. It covers:

- Native tool with no plugins, and the generic tool plus dashboard link with no DAW; the card has the steps and the image in both cases
- A favorite suggested ahead of an alphabetically earlier non-favorite
- A checked step and a tool choice each surviving a fresh read, and neither clearing the other
- Deleting the chosen plugin returning the card to automatic selection
- No recipe on Aranż or Master, a write refused there, and stored progress returning on Miks
- Anonymous POST returning 401
- A second user getting 404 on read and write
- Invalid `step` and `tool`, a foreign plugin id, and a non-form body writing nothing

Scenarios are split into several tests with explicit timeouts, because one test would exceed the 60 seconds existing tests use. The no-DAW case needs a user who never set one, because `daw_profiles` grants no delete. Assert query strings through `result.location`, because `locationPath` strips them.

#### 5. Test server guard

**File**: `tests/helpers/http-app.ts`

**Intent**: Stop HTTP tests from silently running against another server. With a dev server already running, `astro dev` exits and prints that server's URL, and the helper's URL match accepts it.

**Contract**: The helper rejects a local URL whose port differs from the reserved port, so that situation fails with a clear error. Local `npm test` then requires stopping any running `astro dev`; CI has none.

### Success Criteria:

#### Automated Verification:

- `npm test` passes
- `npm run lint` passes
- `npx astro check` passes
- `npm run build` passes

#### Manual Verification:

- On a Miks track, "Potrzebuję przepisu" and "Sidechain stopy z basem" open a card with a tool, an image, and six steps
- A checked step and a replaced tool remain after a browser refresh
- Removing all compressors shows the native tool of the selected DAW, and the card is not empty
- The card is usable at phone width

**Implementation Note**: After automated verification passes, pause for the owner to confirm the manual steps. Then run `/10x-impl-review`.

---

## Testing Strategy

### Unit Tests:

- `tests/recipe-tool-selection.test.ts` for the rule: all table rows, all DAWs, ordering, and stale choices.

### Integration Tests:

- `tests/recipe-progress-rls.test.ts` for ownership at the database.
- `tests/recipe-card-http.test.ts` for the full flow, persistence, and refusals.

### Manual Testing Steps:

1. Sign in, set a DAW, and open a Miks track with no plugins. Open the recipe and confirm the native tool.
2. Add two compressors and favorite the later one alphabetically. Refresh and confirm the favorite is suggested.
3. Check two steps, replace the tool, and refresh. Confirm both stayed.
4. Switch the track to Master, confirm there is no card, then switch back and confirm progress returned.
5. Repeat step 1 at phone width.

## Performance Considerations

The NFR is under 1 second. The page adds three small indexed reads, run in parallel and only for Miks tracks. No caching is needed.

## Migration Notes

The migration only adds a table. Existing tracks have no row until the first action. CI applies it through `supabase start` on a fresh stack. A running local stack needs `npx supabase migration up --local`. Nothing in the repo applies migrations to production, so a deployment must run them by hand before the new page goes live; otherwise reads on Miks tracks fail and show the alert.

## References

- PRD: `context/foundation/prd.md` (US-01, FR-008, FR-009, FR-011, Guardrails, Business Logic)
- Roadmap: `context/foundation/roadmap.md` (S-04)
- Test plan: `context/foundation/test-plan.md` (risk #2)
- Route pattern: `src/pages/api/plugins/[id].ts`
- Page pattern: `src/pages/plugins.astro`
- RLS test pattern: `tests/primary-daw-rls.test.ts`
- HTTP test pattern: `tests/plugins-tracks-http.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Selection rule and starter recipe

#### Automated

- [x] 1.1 `npx vitest run tests/recipe-tool-selection.test.ts` passes — 51b7742
- [x] 1.2 `npm run lint` passes — 51b7742
- [x] 1.3 `npx astro check` passes — 51b7742

### Phase 2: Stored progress

#### Automated

- [x] 2.1 Local Supabase applies the migration: `npx supabase migration up --local` — 3ed57d8
- [x] 2.2 `npx vitest run tests/recipe-progress-rls.test.ts` passes — 3ed57d8
- [x] 2.3 `npm run lint` passes — 3ed57d8
- [x] 2.4 `npx astro check` passes — 3ed57d8

### Phase 3: Card on the track page

#### Automated

- [x] 3.1 `npm test` passes
- [x] 3.2 `npm run lint` passes
- [x] 3.3 `npx astro check` passes
- [x] 3.4 `npm run build` passes

#### Manual

- [x] 3.5 On a Miks track, "Potrzebuję przepisu" and "Sidechain stopy z basem" open a card with a tool, an image, and six steps
- [x] 3.6 A checked step and a replaced tool remain after a browser refresh
- [x] 3.7 Removing all compressors shows the native tool of the selected DAW, and the card is not empty
- [x] 3.8 The card is usable at phone width
