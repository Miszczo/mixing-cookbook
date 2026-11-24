# More Starter Recipes and a Seeded Demo Account — Plan Brief

> Full plan: `context/changes/demo-starter-content/plan.md`

## What & Why

A reviewer who signs in to the demo account sees one starter recipe and almost no data, so search, type and source filters, notes by equipment and track stages look empty. This change adds starter content for everyone and fills the demo account, so the main features are visible within the first minute.

## Starting Point

Starter recipes are a hard-coded array with one entry (`sidechain-kick-bass`, `src/lib/recipes.ts:38-56`). The production demo account was filled by hand during `builder-submission-readiness`, and nothing in the repo can recreate it.

## Desired End State

Every user sees 6 starter recipes across compressor, EQ, reverb, delay and saturation, each with a mock screenshot. `npm run seed:demo` replaces the demo account's data with a fixed set: DAW, 6 plugins, 3 tracks on three stages, recipe progress, 2 own recipes and 5 listening notes. Two runs give the same result.

## Key Decisions Made

| Decision                | Choice                                               | Why (1 sentence)                                                                                 |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Where content goes      | Both: starter catalog in code and demo account data  | New users do not see an empty library, and the demo shows every feature.                          |
| Starter recipe count    | 6 in total, covering every type except `other`       | Type filter and intent search return distinct results without a large content review.            |
| Screenshots             | Mock graphics, alt text marked "(atrapa)"            | The agent can deliver everything without DAW work; it matches the existing sidechain mock.        |
| Seeding mechanism       | `scripts/seed-demo.mjs` via `supabase-js` as the user | Repeatable, runs under RLS like a normal user, needs no service-role key, recreates after resets. |
| Idempotency             | Wipe all of the account's rows, then insert          | Three deletes (tracks, recipes, plugins) cascade cleanly, and reruns cannot duplicate data.       |
| Production write        | Run by the user, guarded by `--yes` for non-local URLs | `infrastructure.md` assigns production data writes to a human.                                 |

## Scope

**In scope:**

- 5 new entries in `RECIPES` plus SVG mocks in `public/recipes/`
- Catalog unit test
- Seed script, `npm run seed:demo`, idempotency integration test
- README "Demo account" section
- Production seed run (user)

**Out of scope:**

- Real DAW screenshots
- Named native tools for non-compressor types
- `supabase/seed.sql` or data on `db reset`
- Schema, UI or page changes
- Credentials in the repo

## Architecture / Approach

The catalog is static code. New entries reach `/recipes` and the track page through the existing `RECIPES` spread, so the pages do not change. The seed script exports `seedDemo(client, userId)` for the test. Its CLI signs in with `DEMO_EMAIL`/`DEMO_PASSWORD` (signing up if the account is missing), deletes the user's rows and inserts the fixed set. Own-recipe images reuse the existing PNG mock in the app's encoding.

## Phases at a Glance

| Phase                     | What it delivers                                       | Key risk                                                             |
| ------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| 1. Starter Recipes        | 6 starter recipes with mocks and a catalog test        | Editing the sidechain entry breaks five pinned HTTP tests             |
| 2. Demo Seed Script       | Repeatable `npm run seed:demo` with an idempotency test | Image encoding or step shape mismatching the app's own insert        |
| 3. Production and README  | Seeded production demo account and rerun docs          | Seeding before deploy leaves progress pointing at an unknown recipe |

**Prerequisites:** Local Supabase running. Production Supabase URL, anon key and demo credentials available to the user.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- The production run deletes the hand-made own recipe on the demo account. Copy its content into the data set first if it matters.
- Recipe settings (ratios, times, frequencies) are typical starting points written by the agent. Skim them before release, because reviewers will read them.
- Cards for EQ, reverb, delay and saturation show the generic native-tool label when no plugin matches.

## Success Criteria (Summary)

- A new account sees 6 starter recipes, and every type filter except Other returns a result.
- The demo account in a private window shows plugins, three tracks, progress, own recipes and filterable notes.
- `npm run seed:demo` can rebuild the demo account at any time with the same result.
