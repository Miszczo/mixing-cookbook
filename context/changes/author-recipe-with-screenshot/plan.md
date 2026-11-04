# Author a Recipe with a Screenshot Implementation Plan

## Overview

A signed-in producer can save an own recipe: an intent, a required tool type, a checklist, and an uploaded settings image. The recipe appears in the track's "Potrzebuję przepisu" list beside the starter recipe and opens as the same card with the same tool-selection rule. This is roadmap slice S-05 (FR-006, FR-007); the hard deadline in the PRD is 2026-11-04.

## Current State Analysis

- Recipes are one constant, `RECIPES`, in `src/lib/recipes.ts:11`. The card route and the track page both look recipes up there (`src/pages/api/tracks/[id]/recipes/[recipeId].ts:34`, `src/pages/tracks/[id].astro:69`).
- `RecipeToolType` is only `"compressor"` (`src/lib/recipes.ts:6`) and the native-tool map has a name for the compressor only. The plugin catalog has six types (`src/lib/plugins.ts:3`).
- `track_recipe_progress.recipe_id` is plain text without a foreign key, so an own recipe id fits, but the table has no delete policy or grant (`supabase/migrations/20261101130000_track_recipe_progress.sql`). Deleting a recipe would leave orphaned progress rows.
- Forms are server-rendered Astro forms posting to `/api/...` routes that validate with zod and answer 303 (`src/pages/api/plugins/index.ts`). Errors travel as query parameters. That does not fit a recipe with up to 20 steps.
- CI starts local Supabase with `-x storage-api` (`.github/workflows/ci.yml`) and `supabase/config.toml` defines no bucket, so Supabase Storage is not available to tests.
- The app runs on Cloudflare Workers with `nodejs_compat`. Nothing applies migrations to production.
- Lessons in `context/foundation/lessons.md` apply to process only: do what was asked and stop before the next skill.

## Desired End State

On `/recipes` the user sees own recipes and can open the creation form at `/recipes/new`. A valid form (intent, tool type, one step per line, PNG/JPEG/WebP image up to 1 MB) saves a recipe. On a Miks track, "Potrzebuję przepisu" lists the starter recipe and the own ones; choosing an own recipe shows the card with the user's image, the checklist, and the tool picked by the existing rule. Steps stay checked after a refresh. Deleting a recipe removes it and its stored progress. Another user cannot read the recipe or its image. A too-large or wrong-type image shows a clear message and keeps the typed text.

### Key Discoveries:

- The selection rule `selectTool` is a pure function already shared by the card (`src/lib/recipes.ts:96`); widening its type is enough for own recipes.
- The track page and the progress route both need the same "starter or own" lookup; one resolver avoids drift.
- PostgREST returns `bytea` as hex, which doubles the size and complicates reads, so the image is stored as base64 text with its MIME type.
- A page that handles its own POST can re-render the form with the submitted values, which the query-string pattern cannot do for long text.

## What We're NOT Doing

- Editing a recipe's text, steps, or image. A wrong recipe is deleted and added again.
- Search and filter by intent (S-06), clipboard paste of images (FR-016), Markdown copy (FR-014).
- Supabase Storage, image resizing, thumbnails, SVG or GIF uploads.
- Named native tools for types other than the compressor. Other types use a generic native label.
- A screenshot per DAW, public recipes, or sharing.
- Applying the migration to production.

## Implementation Approach

Keep the starter recipe in code and read own recipes from a new `recipes` table. Both become one `Recipe` shape, so `selectTool`, `RecipeCard.astro`, and the progress route work on either. Image bytes live in the recipe row (base64 text, 1 MB limit), are never selected in list queries, and are served by an authenticated route that relies on RLS. The creation page handles its own POST so a failure can show the form again with the user's text. Phase 1 is pure logic and runs test-first.

## Critical Implementation Details

- **Do not select the image in list queries.** Lists, the track page, and the progress route use `RECIPE_COLUMNS` without `image_data`; only the image route reads it. Otherwise every track page load pulls up to 1.4 MB per recipe.
- **Read the multipart body only within a cap.** Reject a `Content-Length` above 5 MB without reading it; below that, read it so an oversized file (over 1 MB) can still show the typed text. Check the file size after reading, and check the type by magic bytes, not by the browser's `type`.
- **Delete cleanup must be atomic.** The progress cleanup is a `security definer` trigger with an empty `search_path`, because the user has no delete grant on `track_recipe_progress` and a two-step route could leave rows behind.

## Phase 1: Recipe model and validation

### Overview

Make recipes a shared shape for starter and own recipes, make the native fallback depend on the tool type, and add the pure input rules for the form and the image. Delivered test-first with `/10x-tdd`.

### Changes Required:

#### 1. Widen the recipe model

**File**: `src/lib/recipes.ts`

**Intent**: Let any of the six plugin types be a recipe's required type, and give types without a named native tool a generic, non-empty label. Add the row shape that turns a stored recipe into the same `Recipe` the card already uses.

**Contract**:
- `Recipe.requiredType` is `PluginTypeId` (from `@/lib/plugins`); `RecipeToolType` is removed or aliased to it.
- `selectTool` still returns a non-empty `native` label: the named tool when the type is `compressor` and the DAW is known, otherwise a generic label that contains the type's label and the word DAW (compressor with no DAW keeps "natywny kompresor Twojego DAW").
- `recipeRowSchema` (zod: `id` uuid, `intent`, `required_type`, `steps` array of `{id, text}`), `RECIPE_COLUMNS = "id, intent, required_type, steps"`, and `recipeFromRow(row): Recipe`, whose screenshot is `{ src: "/api/recipes/<id>/image", alt: "Zrzut ustawień: <intent>" }`.

#### 2. Form and image rules

**File**: `src/lib/recipe-input.ts` (new)

**Intent**: One place for the limits and parsing used by the creation page and the tests.

**Contract**:
- Constants `MAX_IMAGE_BYTES = 1_048_576`, `MAX_STEPS = 20`, `MAX_STEP_LENGTH = 200`, `MAX_INTENT_LENGTH = 100`.
- `parseStepLines(text: string): string[]`: split on line breaks, trim, drop empty lines.
- `recipeInputSchema`: zod object with `intent` (trimmed, 1–100), `required_type` (`PLUGIN_TYPES` ids), `steps` (1–20 strings of 1–200 characters).
- `buildSteps(lines: string[]): { id: string; text: string }[]` with ids `step-1`, `step-2`, ...
- `sniffImage(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null` by magic bytes (PNG signature, `FF D8 FF`, `RIFF....WEBP`).
- `encodeImage(bytes): string` and `decodeImage(base64): Uint8Array` that work on Workers.

#### 3. Tests

**Files**: `tests/recipe-input.test.ts` (new), `tests/recipe-tool-selection.test.ts` (extend)

**Intent**: Prove the boundaries with expected values written by hand, not copied from the code.

**Contract**: Cases for 20 vs 21 steps, a 200 vs 201 character step, blank lines between steps, an empty intent, each magic-byte signature and a text file renamed `.png`, and an encode/decode round trip. Selection tests add: an EQ recipe with no EQ plugin returns a non-empty generic native label; with an EQ plugin it returns that plugin; a favorite still goes first for a non-compressor type.

### Success Criteria:

#### Automated Verification:

- Input tests pass: `npx vitest run tests/recipe-input.test.ts`
- Selection tests pass: `npx vitest run tests/recipe-tool-selection.test.ts`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`

#### Manual Verification:

- None for this phase; it is pure logic.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 2.

---

## Phase 2: Recipes table and row-level security

### Overview

Store own recipes privately, with the image inside the row, and clean up stored progress when a recipe is deleted.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261103120000_recipes.sql` (new)

**Intent**: Create `public.recipes` with owner-only policies and a delete trigger for progress.

**Contract**:
- Columns: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users on delete cascade`, `intent text` (1–100), `required_type text` (the six plugin types), `steps jsonb` (array of 1–20 elements), `image_data text not null` (check `char_length <= 1400000`), `image_mime text` (`image/png`, `image/jpeg`, `image/webp`), `created_at`, `updated_at`. Index on `user_id`.
- RLS enabled; policies per operation for `authenticated` on `user_id = (select auth.uid())`: select, insert (with check), delete. No update policy; grants are `select, insert, delete` only, after `revoke all ... from anon, authenticated`.
- After-delete row trigger, `security definer`, `set search_path = ''`, that deletes from `public.track_recipe_progress` where `recipe_id = old.id::text and user_id = old.user_id`.

#### 2. RLS tests

**File**: `tests/recipes-rls.test.ts` (new)

**Intent**: Prove isolation and the cleanup, in the style of `tests/recipe-progress-rls.test.ts`.

**Contract**: The owner inserts and reads a recipe; a second user reads zero rows, cannot insert with the owner's `user_id`, and a delete by them removes nothing. An update fails for the owner (no grant). Check constraints reject 0 and 21 steps, a bad MIME type, and an oversized image. Deleting a recipe removes the owner's progress row for that recipe and leaves progress for the starter recipe untouched.

### Success Criteria:

#### Automated Verification:

- Local Supabase applies the migration: `npx supabase migration up --local`
- RLS tests pass: `npx vitest run tests/recipes-rls.test.ts`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`

#### Manual Verification:

- None for this phase; the tests cover the policies.

**Implementation Note**: Pause for confirmation before Phase 3.

---

## Phase 3: Create and list recipes

### Overview

Add the pages and routes to save, list, view the image of, and delete own recipes, with the failure rules from the PRD.

### Changes Required:

#### 1. List page

**File**: `src/pages/recipes/index.astro` (new)

**Intent**: Show own recipes (intent, tool type, step count, small image) newest first, a link to the creation form, and a delete button per recipe. A failed read shows an alert, not "no recipes".

**Contract**: Reads `recipes` with `RECIPE_COLUMNS` only. Delete posts to `/api/recipes/<id>` with `action=delete`. Empty state explains that the starter recipe is available on Miks tracks.

#### 2. Creation page

**File**: `src/pages/recipes/new.astro` (new)

**Intent**: Render the form (intent, tool type, steps textarea with one step per line, image input) and handle its own POST so errors re-render with the user's text.

**Contract**: `enctype="multipart/form-data"`. On POST: reject `Content-Length` over 5 MB with the error and no values; otherwise read `formData`, validate with `recipeInputSchema`, check the file exists, is at most `MAX_IMAGE_BYTES`, and passes `sniffImage`. Success inserts the row (`image_data` from `encodeImage`, `image_mime` from the sniffed type, steps from `buildSteps`) and redirects 303 to `/recipes`. Failure re-renders with status 400 (invalid or missing) or 413 (too large), keeps intent, type and steps, and says the image must be chosen again. A failed insert returns 500 with a message and keeps the text.

#### 3. Image and delete routes

**Files**: `src/pages/api/recipes/[id]/image.ts` (new), `src/pages/api/recipes/[id].ts` (new)

**Intent**: Serve the image only to its owner, and delete a recipe through the same form pattern as plugins.

**Contract**: `GET /api/recipes/<id>/image`: 401 without a session, 404 for an invalid id or a row RLS hides, otherwise the decoded bytes with `Content-Type` from `image_mime`, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-cache`. `POST /api/recipes/<id>` with `action=delete`: 303 to `/recipes`, 404 when no row was deleted, 400 for another action. Both export `prerender = false` and validate the id with zod.

#### 4. Navigation and protection

**Files**: `src/layouts/AppLayout.astro`, `src/middleware.ts`

**Intent**: Make `/recipes` reachable and session-only.

**Contract**: A "Recipes" link in the main navigation; `"/recipes"` added to `PROTECTED_ROUTES`.

#### 5. HTTP tests

**File**: `tests/recipes-http.test.ts` (new)

**Intent**: Prove the flow through the real server, in the style of `tests/recipe-card-http.test.ts`.

**Contract**: A valid multipart post saves and lists a recipe; the owner downloads the exact bytes with the right `Content-Type`; another user gets 404 and an anonymous request 401. A 1 MB + 1 byte file returns 413 with the typed intent and steps in the page; a text file sent as `.png` returns 400 with the text kept; no image and zero steps return 400. Delete returns 303 and the image then returns 404.

### Success Criteria:

#### Automated Verification:

- HTTP tests pass: `npx vitest run tests/recipes-http.test.ts`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- A recipe with a real settings screenshot saves and appears in `/recipes` with its image
- A file over 1 MB shows a clear message and the typed text is still in the form
- Deleting a recipe removes it from the list
- The form and the list are usable at phone width

**Implementation Note**: Pause for confirmation before Phase 4.

---

## Phase 4: Own recipe in the track

### Overview

Make the track page, the progress route, and the card read own recipes from the database next to the starter one.

### Changes Required:

#### 1. Shared recipe lookup

**File**: `src/lib/recipes.ts`

**Intent**: One resolver used by the page and the route, so they cannot disagree about what exists.

**Contract**: `findRecipe(supabase, id: string): Promise<Recipe | null | "error">` returns the starter recipe for its code id, an own recipe for a uuid that RLS lets the user read, `null` for anything else, and an error marker when the query fails (never `null` for a failed read).

#### 2. Track page

**File**: `src/pages/tracks/[id].astro`

**Intent**: List the starter and own recipes in "Potrzebuję przepisu" and open the requested one.

**Contract**: On a Miks track, also read own recipes with `RECIPE_COLUMNS`; a failed read joins the existing "recipe could not be loaded" alert. The list shows starter first, then own recipes newest first. `?recipe=<id>` and the stored-progress fallback search the combined list. A recipe id that no longer exists shows the list with no card.

#### 3. Progress route

**File**: `src/pages/api/tracks/[id]/recipes/[recipeId].ts`

**Intent**: Toggle steps and choose tools for own recipes exactly as for the starter recipe.

**Contract**: Replace the `RECIPES.find` lookup with `findRecipe`; 404 for `null`, 500 for the error marker. Step ids are validated against that recipe's steps; a chosen plugin must match `recipe.requiredType`.

#### 4. Card

**File**: `src/components/recipes/RecipeCard.astro`

**Intent**: Render an own recipe's image, whose size is unknown.

**Contract**: Drop the fixed `width`/`height` attributes on the image (keep `h-auto w-full`); no other change.

#### 5. HTTP tests

**File**: `tests/recipes-in-track-http.test.ts` (new)

**Intent**: Prove the end-to-end value: a saved recipe works as a card on a track.

**Contract**: After creating an own recipe, a Miks track lists it; the card shows the user's intent, its steps, and an `<img>` pointing at its image route. An EQ recipe with no EQ plugin shows a generic native label, not an empty card. With an EQ plugin the card shows that plugin. A toggled step persists on reload. Another user's track and recipe ids return 404. After deleting the recipe the list no longer shows it and its progress row is gone.

### Success Criteria:

#### Automated Verification:

- All tests pass: `npm test`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- On a Miks track, an own recipe is listed and opens a card with the user's image, steps, and a tool
- A checked step remains after a browser refresh
- With no plugin of the required type, the card shows the DAW's native tool, not an empty card
- A deleted recipe disappears from the track's list

**Implementation Note**: This is the last phase; after it, run `/10x-impl-review` before archiving.

---

## Testing Strategy

### Unit Tests:

- `tests/recipe-input.test.ts`: step parsing and limits, schema bounds, magic-byte sniffing, encode/decode round trip.
- `tests/recipe-tool-selection.test.ts`: non-compressor types and generic native labels, favorite order.

### Integration Tests:

- `tests/recipes-rls.test.ts`: owner-only policies, no update, check constraints, progress cleanup on delete.
- `tests/recipes-http.test.ts`: save, list, image privacy, size and type errors keep the text, delete.
- `tests/recipes-in-track-http.test.ts`: own recipe as a card on a track, fallback, persistence, cross-user denial.

### Manual Testing Steps:

1. Sign in, open `/recipes/new`, save a recipe with a real screenshot, and see it in the list.
2. Try a file over 1 MB and a non-image file; check the message and the kept text.
3. Open a Miks track, choose the own recipe, tick two steps, refresh.
4. Delete the recipe and check the track's list.

## Performance Considerations

Lists and the track page never read `image_data`. The image route reads one row at a time; a 1 MB limit keeps a base64 string at about 1.4 MB. The PRD's one-second budget concerns the card, which now adds one small query for the recipe list on Miks tracks.

## Migration Notes

The migration only adds a table, a function, and a trigger. Existing data is untouched and the starter recipe stays in code. Production is not migrated by anything in the repo, so it must be applied by hand before deploying. A rollback drops the trigger, the function, and the table; deleting the table also removes the stored images, but not the progress rows for own recipes, which are then orphaned and harmless.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-05)
- PRD: `context/foundation/prd.md` (FR-006, FR-007, NFR on errors and privacy)
- Previous plan: `context/archive/2026-11-01-in-track-sidechain-card/plan.md`
- Selection rule and starter recipe: `src/lib/recipes.ts:11`, `src/lib/recipes.ts:96`
- Form and route pattern: `src/pages/api/plugins/index.ts`, `src/pages/api/plugins/[id].ts`
- RLS and test style: `supabase/migrations/20261101130000_track_recipe_progress.sql`, `tests/recipe-progress-rls.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Recipe model and validation

#### Automated

- [x] 1.1 Input tests pass: `npx vitest run tests/recipe-input.test.ts` — 2a1fd71
- [x] 1.2 Selection tests pass: `npx vitest run tests/recipe-tool-selection.test.ts` — 2a1fd71
- [x] 1.3 Linting passes: `npm run lint` — 2a1fd71
- [x] 1.4 Type checking passes: `npx astro check` — 2a1fd71

### Phase 2: Recipes table and row-level security

#### Automated

- [x] 2.1 Local Supabase applies the migration: `npx supabase migration up --local` — 2533b20
- [x] 2.2 RLS tests pass: `npx vitest run tests/recipes-rls.test.ts` — 2533b20
- [x] 2.3 Linting passes: `npm run lint` — 2533b20
- [x] 2.4 Type checking passes: `npx astro check` — 2533b20

### Phase 3: Create and list recipes

#### Automated

- [x] 3.1 HTTP tests pass: `npx vitest run tests/recipes-http.test.ts` — 8251d45
- [x] 3.2 Linting passes: `npm run lint` — 8251d45
- [x] 3.3 Type checking passes: `npx astro check` — 8251d45
- [x] 3.4 Build passes: `npm run build` — 8251d45

#### Manual

- [x] 3.5 A recipe with a real settings screenshot saves and appears in `/recipes` with its image — 8251d45
- [x] 3.6 A file over 1 MB shows a clear message and the typed text is still in the form — 8251d45
- [x] 3.7 Deleting a recipe removes it from the list — 8251d45
- [x] 3.8 The form and the list are usable at phone width — 8251d45

### Phase 4: Own recipe in the track

#### Automated

- [x] 4.1 All tests pass: `npm test`
- [x] 4.2 Linting passes: `npm run lint`
- [x] 4.3 Type checking passes: `npx astro check`
- [x] 4.4 Build passes: `npm run build`

#### Manual

- [x] 4.5 On a Miks track, an own recipe is listed and opens a card with the user's image, steps, and a tool
- [x] 4.6 A checked step remains after a browser refresh
- [x] 4.7 With no plugin of the required type, the card shows the DAW's native tool, not an empty card
- [x] 4.8 A deleted recipe disappears from the track's list
