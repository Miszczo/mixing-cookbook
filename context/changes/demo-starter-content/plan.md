# More Starter Recipes and a Seeded Demo Account Implementation Plan

## Overview

A reviewer who signs in to the demo account today sees one starter recipe, one track and very little else, so most features (search by intent, filter by tool type, source filter, notes by equipment, track stages) show empty or trivial results. This change grows the starter catalog from 1 to 6 recipes, one or more per tool type, and adds a repeatable script that fills the demo account with a realistic data set.

## Current State Analysis

- Starter recipes are a hard-coded array, `RECIPES` (`src/lib/recipes.ts:38-56`), with one entry, `sidechain-kick-bass`. Every user sees it, and its screenshot is a static mock in `public/recipes/sidechain-settings-mock.png`.
- Own recipes live in the `recipes` table and need an image (`image_data text not null`, PNG/JPEG/WebP, `supabase/migrations/20261103120000_recipes.sql`).
- The demo account was created by hand in production during `builder-submission-readiness` (Phase 2, item 4): a primary DAW, a few plugins, one Miks track and one own recipe. No script or seed file recreates it. `supabase/config.toml` points `[db.seed]` at `./seed.sql`, which does not exist.

## Desired End State

- `/recipes` lists 6 starter recipes covering compressor (2), EQ, reverb, delay and saturation. Each has steps and a mock screenshot whose alt text says it is a mock. The type filter returns a result for every type except `other`, and search by intent finds them.
- `npm run seed:demo` signs in as the demo account and replaces all of its data with a fixed set: a DAW, 6 plugins (with favorites), 3 tracks (one per stage), saved progress in one recipe, 2 own recipes and 5 listening notes across 3 pieces of equipment. Running it twice gives the same state.
- The production demo account shows this data in a private window. The README explains how to rerun the script.

### Key Discoveries:

- Starter recipes reach the UI from two places, the recipe list (`src/pages/recipes/index.astro:28`) and the track page (`src/pages/tracks/[id].astro:145`), so new array entries need no page changes.
- Five test files pin `sidechain-kick-bass` and its exact text (`tests/recipe-card-http.test.ts:5-7,94,102,128`, `tests/recipes-search-http.test.ts:8`, `tests/recipes-in-track-http.test.ts:10`, `tests/recipes-rls.test.ts:6`, `tests/recipe-progress-rls.test.ts:6`). None counts starter recipes, so adding entries is safe if the sidechain entry stays byte-identical.
- Named native tools exist only for the compressor (`src/lib/recipes.ts:120-128`). Cards for the new EQ, reverb, delay and saturation recipes show the generic label "natywne narzędzie Twojego DAW (…)" when no plugin matches. That is acceptable for this change.
- Own-recipe steps must be 1–20 objects with an `id` of 1–20 characters and `text` of 1–200 characters (`supabase/migrations/20261104164600_recipes_step_shape.sql`). Track progress stores `recipe_id` as text of 1–100 characters (`20261101130000_track_recipe_progress.sql`), so starter ids must stay stable once released.
- RLS tests create users with `supabase-js` and the anon key (`tests/recipes-rls.test.ts:9-16`). The seed script can work the same way, as an ordinary signed-in user under RLS, with no service-role key.
- Deleting a track cascades to its notes and progress, and deleting an own recipe runs `recipes_delete_progress`. Deleting plugins sets `selected_plugin_id` to null. A full wipe of the demo account's rows therefore needs only three deletes: tracks, recipes, plugins.
- The app stores own-recipe images through `encodeImage` and the type through `sniffImage` (`src/pages/recipes/new.astro:81-93`). The script must write the same encoding.

## What We're NOT Doing

- No real DAW screenshots. All new images are mocks with "(atrapa)" in the alt text.
- No new named native tools for EQ, reverb, delay or saturation (`NATIVE_TOOLS` unchanged).
- No `supabase/seed.sql` and no data loaded on `db reset`, so integration tests keep starting from an empty database.
- No schema or migration changes, and no UI or page changes.
- No demo credentials in the repo. They come only from environment variables.
- The agent does not run the script against production. The user does, following `infrastructure.md` Approval.

## Implementation Approach

The work has two independent parts. The catalog is code: new entries plus static SVG mocks, guarded by a unit test, and shipped through a PR and deploy. The demo data is a Node script that uses `supabase-js` as the demo user. It deletes everything the user owns and inserts a fixed data set, which makes it idempotent and lets it recreate the account after a reset. A local integration test runs it twice against a throwaway user. Production comes last, after the new starter ids are deployed, because the seeded progress row references one of them.

## Critical Implementation Details

**State sequencing** — Run the production seed only after Phase 1 is deployed. Seeded progress may reference a new starter id (for example `drum-bus-glue`), and the track page cannot find that recipe until the code that defines it is live.

**Safety** — The script wipes every row of whichever account it signs in to. It must print the target URL and the account e-mail, and refuse a non-local URL (anything other than `localhost` or `127.0.0.1`) unless `--yes` is passed.

## Phase 1: Starter Recipes

### Overview

Five new starter recipes and their mock images, with a unit test for the catalog.

### Changes Required:

#### 1. Starter catalog

**File**: `src/lib/recipes.ts`

**Intent**: Append five recipes to `RECIPES` after `sidechain-kick-bass` and leave that entry unchanged. Each needs a Polish intent, 4–6 concrete steps in the same tone as the sidechain recipe, and a mock screenshot.

**Contract**: The new entries use the existing `Recipe` shape. Ids, intents and types:

- `drum-bus-glue`: "Klej na sumie perkusji", compressor (ratio ~2:1, attack 10–30 ms, 1–3 dB gain reduction, level-matched makeup)
- `vocal-low-cut`: "Wyczyść dół wokalu", eq (high-pass sweep from ~60 Hz, optional wide 200–400 Hz cut)
- `snare-plate-reverb`: "Pogłos płytowy na werbel", reverb (send/return, plate, pre-delay 10–30 ms, decay ~1–1.5 s, filtered return)
- `vocal-throw-delay`: "Echo na końcówkach fraz wokalu", delay (send, tempo-synced 1/4 or 1/8, feedback 20–35%, filtered return, automated send)
- `bass-saturation`: "Saturacja basu na małe głośniki", saturation (drive, mix 30–50%, level match, check on small speakers)

Step ids are kebab-case and at most 20 characters, so they also fit the own-recipe limit if someone copies them. `screenshot.src` is `/recipes/<id>-mock.svg`, and `screenshot.alt` follows the sidechain pattern: "Przykładowa grafika w miejscu zrzutu ustawień … (atrapa)".

#### 2. Mock images

**File**: `public/recipes/<id>-mock.svg` (5 files)

**Intent**: Lightweight placeholder graphics in the spirit of `sidechain-settings-mock.png`: a plugin-like panel with the tool type and 3–4 labelled knob values from the recipe, clearly a mock.

**Contract**: Static SVG under 20 KB each, with no external fonts or scripts and readable in light and dark page themes.

#### 3. Catalog test

**File**: `tests/starter-recipes.test.ts`

**Intent**: Guard the catalog: ids are unique, step ids within a recipe are unique, every screenshot file exists under `public/`, every type except `other` has at least one starter, and `sidechain-kick-bass` keeps its intent and first and last step (so the pinned HTTP tests do not silently drift).

**Contract**: A pure Vitest unit test with no Supabase or dev server, reading files with `node:fs`.

### Success Criteria:

#### Automated Verification:

- `npm test -- tests/starter-recipes.test.ts` passes
- `npm test` passes against local Supabase (existing sidechain-pinned tests unchanged)
- `npm run lint` and `npx astro check` pass
- `npm run build` succeeds

#### Manual Verification:

- `/recipes` shows 6 starter recipes with their mock images. The type filter for EQ, Reverb, Delay and Saturation returns one each, and Compressor returns two
- Searching "wokal" returns the two vocal recipes
- Opening `vocal-low-cut` inside a Miks track with no EQ plugin shows the generic native-tool label, and the step checklist saves progress

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Demo Seed Script

### Overview

A repeatable script that replaces the demo account's data with a fixed set, plus an idempotency test.

### Changes Required:

#### 1. Seed script

**File**: `scripts/seed-demo.mjs`

**Intent**: Sign in as the demo account and replace all its data. The module exports the seeding function for the test and runs the CLI when executed directly.

**Contract**:

- `export async function seedDemo(client, userId)`: `client` is a signed-in `supabase-js` client. It deletes the user's `tracks`, `recipes` and `plugins` (filtered by `user_id`), upserts `daw_profiles`, then inserts the data set below and returns counts per table. On any Supabase error it throws, naming the table.
- CLI: reads `SUPABASE_URL`, `SUPABASE_KEY`, `DEMO_EMAIL` and `DEMO_PASSWORD`, and exits non-zero with a message if any is missing. It tries `signInWithPassword` and, if the credentials are invalid, falls back to `signUp` (confirmation is off locally and in production). It prints the URL, e-mail and counts, and applies the non-local `--yes` guard from Critical Implementation Details.
- Own-recipe images are read from `public/recipes/sidechain-settings-mock.png` and written in the same encoding as `encodeImage` in the app, with `image_mime` `image/png`.
- Data set:
  - DAW `ableton-live`
  - Plugins: FabFilter Pro-C 2 (compressor, favorite), SSL Bus Compressor (compressor), FabFilter Pro-Q 3 (eq, favorite), Valhalla Plate (reverb, favorite), EchoBoy (delay), Decapitator (saturation)
  - Tracks: "Szkic: Lato" (aranz), "Nocna jazda" (miks), "Kolory" (master)
  - Progress on "Nocna jazda": `sidechain-kick-bass` with 3 of 6 steps done and Pro-C 2 selected, and `drum-bus-glue` with `use_native` true
  - Own recipes: "Równoległa kompresja wokalu" (compressor, 4 steps) and "Szerokie stereo na padzie" (other, 3 steps)
  - Listening notes: 5 notes on "Nocna jazda" and "Kolory", with equipment "Słuchawki DT 770", "Monitory" and "Samochód" and stages miks and master, so the equipment filter returns 2, 2 and 1

#### 2. npm script

**File**: `package.json`

**Intent**: Make the script easy to run with local `.env` values, while explicitly set variables still win for production runs.

**Contract**: `"seed:demo": "node --env-file-if-exists=.env scripts/seed-demo.mjs"` (Node 22.14 per `.nvmrc`; existing environment variables override the file).

#### 3. Idempotency test

**File**: `tests/seed-demo.test.ts`

**Intent**: Prove the script matches the schema, constraints and RLS, and that two runs give the same state. Sign up a throwaway user as the RLS tests do, run `seedDemo` twice, and compare row counts and track names after each run. Also check that a second user sees none of the rows.

**Contract**: Imports `seedDemo` from `../scripts/seed-demo.mjs`. If `npx astro check` rejects the untyped import, add a `scripts/seed-demo.d.mts` declaration rather than converting the script to TypeScript.

### Success Criteria:

#### Automated Verification:

- `npm test -- tests/seed-demo.test.ts` passes against local Supabase
- `npm test` passes
- `npm run lint` and `npx astro check` pass
- `npm run seed:demo` with a non-local `SUPABASE_URL` and no `--yes` exits non-zero without writing

#### Manual Verification:

- Locally, `DEMO_EMAIL=… DEMO_PASSWORD=… npm run seed:demo` run twice prints the same counts, and signing in as that user shows 3 tracks, 6 plugins, 2 own recipes and notes filterable by equipment
- The Miks track "Nocna jazda" opens the sidechain card with 3 steps ticked and Pro-C 2 selected

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Production and README

### Overview

Ship the catalog, seed the production demo account (done by the user), and document the rerun.

### Changes Required:

#### 1. README

**File**: `README.md`

**Intent**: A short "Demo account" section next to the existing production smoke instructions. It explains what `npm run seed:demo` does, warns that it wipes the target account, and shows the production command with variables passed explicitly and `--yes`.

**Contract**: The section shows no credentials, only placeholder variable names. A bash command follows the existing smoke example, and a PowerShell variant follows it.

#### 2. Production run (manual)

**File**: none in repo

**Intent**: After the Phase 1 code is deployed to `workers.dev`, the user runs the seed against the production Supabase project with the demo credentials. Before running, the user copies anything worth keeping from the hand-made own recipe into the script's data set, because the script deletes it.

**Contract**: The production URL and anon key come from the user's environment. Nothing is committed.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- CI on the PR is green (`ci` and `smoke` jobs)

#### Manual Verification:

- The deployed `workers.dev` app lists 6 starter recipes for a freshly signed-up account
- In a private window, the demo account shows the DAW, 6 plugins, 3 tracks on three stages, 2 own recipes, sidechain progress on "Nocna jazda", and the equipment filter on notes
- A second account sees none of the demo account's data
- The README section is accurate and contains no credentials

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `tests/starter-recipes.test.ts`: unique ids, unique step ids per recipe, screenshot files exist, type coverage, sidechain entry unchanged.

### Integration Tests:

- `tests/seed-demo.test.ts`: two runs of `seedDemo` against local Supabase give identical counts, rows satisfy every check constraint, and a second user sees none of them.
- The existing suites stay green unchanged, which shows the sidechain recipe and its pinned text are intact.

### Manual Testing Steps:

1. Locally: run `npm run seed:demo` twice, sign in as the demo user, and walk recipes, tracks, the recipe card and the notes filter.
2. Production: deploy, run the seed with `--yes`, and check the demo account in a private window.
3. Sign in as a second account and confirm the demo data is not visible.

## Performance Considerations

None of note. The catalog grows from 1 to 6 in-memory entries, and the seed writes about 25 rows once.

## Migration Notes

There is no schema migration. The production run replaces the hand-made demo data, so before running, copy anything worth keeping into the script's data set. Starter ids added here become stable identifiers, because progress rows reference them.

## References

- Demo account origin: `context/archive/2026-11-24-builder-submission-readiness/plan.md` (Phase 2, item 4)
- Starter catalog: `src/lib/recipes.ts:38-56`
- User creation pattern: `tests/recipes-rls.test.ts:9-16`
- Own recipe insert: `src/pages/recipes/new.astro:81-93`
- Env/CLI script pattern: `scripts/smoke.mjs:8-14`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Starter Recipes

#### Automated

- [x] 1.1 `npm test -- tests/starter-recipes.test.ts` passes
- [x] 1.2 `npm test` passes against local Supabase (existing sidechain-pinned tests unchanged)
- [x] 1.3 `npm run lint` and `npx astro check` pass
- [x] 1.4 `npm run build` succeeds

#### Manual

- [x] 1.5 `/recipes` shows 6 starter recipes with their mock images. The type filter for EQ, Reverb, Delay and Saturation returns one each, and Compressor returns two
- [x] 1.6 Searching "wokal" returns the two vocal recipes
- [x] 1.7 Opening `vocal-low-cut` inside a Miks track with no EQ plugin shows the generic native-tool label, and the step checklist saves progress

### Phase 2: Demo Seed Script

#### Automated

- [ ] 2.1 `npm test -- tests/seed-demo.test.ts` passes against local Supabase
- [ ] 2.2 `npm test` passes
- [ ] 2.3 `npm run lint` and `npx astro check` pass
- [ ] 2.4 `npm run seed:demo` with a non-local `SUPABASE_URL` and no `--yes` exits non-zero without writing

#### Manual

- [ ] 2.5 Locally, `DEMO_EMAIL=… DEMO_PASSWORD=… npm run seed:demo` run twice prints the same counts, and signing in as that user shows 3 tracks, 6 plugins, 2 own recipes and notes filterable by equipment
- [ ] 2.6 The Miks track "Nocna jazda" opens the sidechain card with 3 steps ticked and Pro-C 2 selected

### Phase 3: Production and README

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 CI on the PR is green (`ci` and `smoke` jobs)

#### Manual

- [ ] 3.3 The deployed `workers.dev` app lists 6 starter recipes for a freshly signed-up account
- [ ] 3.4 In a private window, the demo account shows the DAW, 6 plugins, 3 tracks on three stages, 2 own recipes, sidechain progress on "Nocna jazda", and the equipment filter on notes
- [ ] 3.5 A second account sees none of the demo account's data
- [ ] 3.6 The README section is accurate and contains no credentials
