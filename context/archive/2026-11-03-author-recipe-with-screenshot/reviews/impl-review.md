<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Author a Recipe with a Screenshot

- **Plan**: context/changes/author-recipe-with-screenshot/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 3 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Unknown recipe query still opens the stored card

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/pages/tracks/[id].astro:61
- **Detail**: Phase 4 says `?recipe=<id>` and the stored-progress fallback both search the combined list, and a recipe id that no longer exists shows the list with no card. The lookup uses `find(requested) ?? find(stored)`. A `?recipe=` that is not in the list falls through to whatever recipe still has progress, so a deleted or unknown id can still open a card.
- **Fix A ⭐ Recommended**: Use the stored-progress fallback only when `recipe` is absent. If it is present and not in the combined list, render the list with no card.
  - Strength: Matches the phase contract and the case the HTTP tests do not cover (a bad id plus leftover progress).
  - Tradeoff: A stale link no longer lands on the last used recipe.
  - Confidence: HIGH — the fallback is the two-line expression at lines 61–63.
  - Blind spot: Have not checked whether any test asserts the fall-through.
- **Fix B**: Keep the fall-through and add a plan addendum.
  - Strength: Preserves the previous-card behavior already shipped.
  - Tradeoff: The written contract stays wrong until the addendum lands.
  - Confidence: MEDIUM — the earlier sidechain plan preferred the requested id, but this plan states the no-card outcome.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A

### F2 — The 5 MB cap trusts Content-Length

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/recipes/new.astro:30
- **Detail**: The plan says to reject a Content-Length above 5 MB without reading the body. The page does that only when the header is present and numeric and greater than 5 MB (lines 30–36). A missing, chunked, or understated length still goes to `request.formData()` (line 42), which buffers the body before the 1 MB file check. The HTTP tests cover a 1 MB + 1 byte file, not a missing or spoofed length.
- **Fix A ⭐ Recommended**: Reject the POST before `formData()` when Content-Length is missing or not a finite number, as well as when it is over 5 MB.
  - Strength: Closes the unread-cap hole with the header the plan already names.
  - Tradeoff: A client that omits Content-Length cannot submit the form. Normal browser multipart posts send the header.
  - Confidence: MEDIUM — Workers may strip or rewrite the header; that was not checked against the Cloudflare adapter.
  - Blind spot: No request in the suite omits Content-Length.
- **Fix B**: Read the body through a hard byte limit and stop at 5 MB.
  - Strength: The cap follows the bytes, so a lying header cannot force a full buffer.
  - Tradeoff: Astro's `formData()` does not expose a streaming cap; this is a larger change than the plan's header check.
  - Confidence: LOW — the Workers request body API for this adapter was not proven here.
  - Blind spot: How `request.formData()` behaves on Cloudflare when the header and the body disagree.
- **Decision**: FIXED via Fix A

### F3 — steps has no element shape or length check

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261103120000_recipes.sql:9
- **Detail**: The column check only requires a JSON array of length 1–20. The app schema caps each step at 200 characters and expects `{id, text}`, but an authenticated insert through the Supabase client can store huge or wrong-shaped elements. `z.array(recipeRowSchema)` then fails the whole list, and both `src/pages/recipes/index.astro` and `src/pages/tracks/[id].astro:51` show a load error instead of the other recipes. The form path itself is fine.
- **Fix**: Add a check that every element is an object with a short `id` and `text` (text length ≤ 200), in a new migration.
  - Strength: A bad row can no longer blank the library or the track list, and it matches the zod bounds the form already enforces.
  - Tradeoff: Needs a new migration; existing oversized rows, if any, would have to be cleaned before it applies.
  - Confidence: HIGH — the check is local to `steps` and the form already rejects those values.
  - Blind spot: Local data was not scanned for rows that would fail the new check.
- **Decision**: FIXED

### F4 — Delete trigger function is executable by the API roles

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261103120000_recipes.sql:45
- **Detail**: `recipes_delete_progress` is `SECURITY DEFINER` with an empty `search_path`, which matches the plan, and it is not revoked from `PUBLIC`. PostgREST can expose it. A direct call has no `OLD`, so it is not an ownership bypass. The definer is required because `track_recipe_progress` has no delete grant.
- **Fix**: `REVOKE ALL ON FUNCTION public.recipes_delete_progress() FROM PUBLIC, anon, authenticated` in a follow-up migration. The trigger owner can still run it.
- **Decision**: FIXED

### F5 — The library requests every full screenshot

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/recipes/index.astro:10
- **Detail**: The list query correctly omits `image_data` and adds `created_at` only so it can order newest first. The page then renders an `<img>` per recipe, and each one reads up to about 1 MB in the image route. The plan asked for a small image and ruled out thumbnails, and it set no row cap. This is the cost of that choice once a user has many recipes.
- **Fix**: Leave it. Thumbnails and pagination are outside this plan.
- **Decision**: SKIPPED
