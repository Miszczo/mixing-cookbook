# Author a Recipe with a Screenshot — Plan Brief

> Full plan: `context/changes/author-recipe-with-screenshot/plan.md`

## What & Why

A producer can save an own mixing recipe with an intent, a required tool type, a checklist, and an uploaded settings image, and then use it on a Miks track like the starter recipe. This turns the cookbook from one built-in technique into a personal one (FR-006, FR-007), and it must be ready for the 2026-11-04 deadline.

## Starting Point

The sidechain card works for one recipe kept in code (`RECIPES`). The selection rule, stored progress, plugins, DAW profile, and tracks exist. There is no recipes table, no upload, and the native fallback only knows the compressor.

## Desired End State

`/recipes` lists own recipes and `/recipes/new` saves one. On a Miks track the recipe appears next to the starter one and opens a card with the user's image and checklist. Checked steps survive a refresh, deleting a recipe removes its progress, and other users cannot read it or its image. A too-large or wrong-type file shows a clear message and keeps the typed text.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Image storage | Base64 text in the recipe row, 1 MB limit | CI runs without storage-api, and RLS already gives privacy |
| Why not bytea | PostgREST returns it as hex | Hex doubles the size and complicates reads |
| Own recipe in a track | Listed beside the starter recipe | FR-011 and the S-05 value need the recipe to be usable |
| Required type | All six plugin types, generic native label outside the compressor | The card is never empty and no unverified tool names are invented |
| Image rules | Required, PNG/JPEG/WebP by magic bytes, up to 1 MB | The roadmap outcome includes an uploaded image; SVG would add script risk |
| Management scope | Create, list, delete; no editing | Editing steps would break stored progress and the deadline is tomorrow |
| Error handling | The creation page handles its own POST and re-renders | Up to 20 steps do not fit in a query string, and the PRD forbids losing text |
| Checklist input | One textarea, one step per line, 1–20 steps | Needs no JavaScript and matches the server-form pattern |
| Delete cleanup | Security-definer trigger removes progress rows | Users have no delete grant on progress, and the cleanup must be atomic |
| Process | Phase 1 test-first via `/10x-tdd` | It is pure logic with clear boundaries |

## Scope

**In scope:**

- `recipes` table with RLS and progress cleanup
- Create, list, delete, and image-serving routes; navigation and route protection
- Own recipes in the track chooser, progress route, and card
- RLS and HTTP tests

**Out of scope:**

- Editing, search by intent (S-06), clipboard paste, Markdown copy
- Supabase Storage, resizing, thumbnails, SVG
- Named native tools for types other than the compressor
- Applying the migration to production

## Architecture / Approach

Starter recipes stay in code and own recipes come from the database as the same `Recipe` shape, so `selectTool`, `RecipeCard.astro`, and the progress route work on both through one `findRecipe` resolver. Images are never selected in list queries; an authenticated route serves one image from the row under RLS. `/recipes/new` validates with zod, checks the image size and magic bytes, and re-renders with the user's text on failure.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Recipe model and validation | Widened model, input rules, image sniffing, tests | Expectations copied from the code |
| 2. Recipes table and RLS | Migration, policies, cleanup trigger, RLS tests | Cleanup trigger deleting rows it should not |
| 3. Create and list recipes | Pages, image and delete routes, HTTP tests | Oversized upload losing the typed text |
| 4. Own recipe in the track | Chooser, progress route, card, end-to-end test | A failed read looking like "no recipe" |

**Prerequisites:** S-04 is archived and local Supabase is running; any running `astro dev` is stopped before `npm test`.
**Estimated effort:** About 1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Base64 adds about 33% to the stored size; this is acceptable for a small personal dataset but would not scale to many large images.
- Only magic bytes are checked, not a full image decode, so a file with a valid header and broken body can be saved.
- Nothing in the repo applies migrations to production, so the migration needs a manual run before deploying.
- The generic native label for non-compressor types does not name the exact tool for the user's DAW.

## Success Criteria (Summary)

- A producer saves a recipe with a screenshot and uses it on a Miks track with a checklist that persists.
- A second user cannot read the recipe or its image, and deleting a recipe leaves no stored progress.
- `npm test` covers the boundaries (20 vs 21 steps, 1 MB vs 1 MB + 1, wrong file type) and the privacy of the image.
