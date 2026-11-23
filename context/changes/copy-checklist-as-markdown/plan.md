# Copy a recipe checklist as Markdown Implementation Plan

## Overview

Add a "Copy as Markdown" button to the recipe card on a Miks track (roadmap S-09, PRD FR-014). It copies the recipe intent, the current tool and the checklist with its done state to the clipboard as Markdown. If the copy fails, the user sees a clear message and a textarea with the text for manual copying.

## Current State Analysis

- The recipe card is server-rendered in `src/components/recipes/RecipeCard.astro`. The checklist is `recipe.steps` (`{ id, text }[]`, `src/lib/recipes.ts:10`), the done state is `completedSteps`, and the shown tool is `selection.tool` (`label`, `kind`).
- The card is rendered only on Miks tracks in `src/pages/tracks/[id].astro:226-237`.
- S-08 set the pattern for small client-side helpers: a pure function in `src/lib/listening-note-template.ts` with a unit test, and a `<script>` in `src/pages/tracks/[id].astro:328-350` that reveals a `hidden` button only when JS runs and reports problems in a `role="status"` element.
- There is no clipboard code anywhere in `src/`.

## Desired End State

On a Miks track with a recipe card, a "Copy as Markdown" button sits above the checklist. Clicking it puts this text on the clipboard (example: step 1 done, plugin tool):

```
## Sidechain stopy z basem

Tool: Pro-C 2

- [x] Wstaw kompresor na bas
- [ ] Ustaw sidechain na stopę
```

A "Copied to clipboard." status appears. If the Clipboard API is missing or rejects the write, a red message says the copy failed and a read-only textarea with the same Markdown appears, already selected. Without JS, no button is shown and the card works as before.

### Key Discoveries:

- The checklist and done state are all known at render time, so the Markdown can be built on the server and passed in a `data-markdown` attribute. The script never calls the API. (`RecipeCard.astro:77-103`)
- A native tool label has no "(native)" suffix in `tool.label`; the card adds it in markup (`RecipeCard.astro:31`). The Markdown must do the same.
- `navigator.clipboard.writeText` exists only in a secure context (localhost counts) and must run inside the click handler.

## What We're NOT Doing

- No copy of the screenshot or the tool-choice form.
- No "copy as plain text" or other formats.
- No change to the step data, the progress table or any API route.
- No button on `/recipes` (the list page); only the in-track card.
- No `document.execCommand("copy")` fallback; the textarea is the fallback.

## Implementation Approach

Pure formatting function in `src/lib` (unit-tested), called in `RecipeCard.astro` at render time to fill a `data-markdown` attribute on the button. A small script on the card writes it to the clipboard and handles success and failure.

## Critical Implementation Details

- **Escaping step text**: a step text may contain line breaks. Collapse every run of whitespace containing a newline to a single space so each step stays on one `- [ ]` line. Do not escape other Markdown characters; the user's text is copied as written.

## Phase 1: Markdown formatting

### Overview

A pure function that turns a recipe, its done steps and the shown tool into the agreed Markdown.

### Changes Required:

#### 1. Formatter

**File**: `src/lib/recipe-checklist-markdown.ts` (new)

**Intent**: One place that defines the copied text, testable without a browser.

**Contract**: `export function recipeChecklistToMarkdown(input: { intent: string; tool: { label: string; kind: "plugin" | "native" }; steps: readonly { id: string; text: string }[]; completedSteps: readonly string[] }): string`. Output: `## <intent>`, blank line, `Tool: <label>` (with ` (native)` appended when `kind === "native"`), blank line, then one `- [x] <text>` or `- [ ] <text>` per step in the given order, joined with `\n`, no trailing newline. Step text with line breaks is flattened to one line. With zero steps, the output ends after the Tool line. Use the `ToolSelection["tool"]` type from `src/lib/recipes.ts` if it matches; otherwise the structural type above.

#### 2. Unit tests

**File**: `tests/recipe-checklist-markdown.test.ts` (new)

**Intent**: Pin the exact format agreed in planning.

**Contract**: cases: mixed done/undone steps (exact string equal to the Desired End State example); native tool gets ` (native)`; step text with `\n` stays on one line; a `completedSteps` id not in `steps` is ignored; zero steps.

### Success Criteria:

#### Automated Verification:

- Formatter unit tests pass: `npx vitest run tests/recipe-checklist-markdown.test.ts`
- Type check passes: `npx astro check`
- Linting passes: `npm run lint`

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 2.

---

## Phase 2: Copy button on the recipe card

### Overview

Render the button, status and fallback textarea on the card, and wire the clipboard script.

### Changes Required:

#### 1. Button, messages and script

**File**: `src/components/recipes/RecipeCard.astro`

**Intent**: Let the user copy the checklist in one click and always end up with the Markdown, even when the clipboard fails.

**Contract**: Above the `<ol>`: `<button type="button" id="recipe-copy-markdown" hidden data-markdown={markdown}>Copy as Markdown</button>` using the existing `button` class, `<p id="recipe-copy-status" role="status" hidden>` and `<textarea id="recipe-copy-fallback" readonly hidden>` (same `field` styling, `aria-label="Recipe checklist as Markdown"`). `markdown` is computed in the frontmatter with `recipeChecklistToMarkdown`. A `<script>` in the component reveals the button; on click, if `navigator.clipboard?.writeText` exists it awaits it. On success: status text "Copied to clipboard.", neutral colour, fallback hidden. On missing API or rejection: status text "Could not copy to the clipboard. Select the text below and copy it manually." in `text-red-200`, fallback shown with the Markdown, focused and selected. The card is rendered at most once per page, so fixed ids are safe.

#### 2. HTTP check

**File**: `tests/recipe-card-http.test.ts`

**Intent**: Confirm the button and its data are in the real rendered card.

**Contract**: one new `it` that opens a Miks track with the recipe card and asserts `id="recipe-copy-markdown"` with `type="button"` and a `data-markdown` attribute starting with `## ` (HTML-escaped as rendered), plus `id="recipe-copy-status"` and `id="recipe-copy-fallback"`.

### Success Criteria:

#### Automated Verification:

- HTTP tests pass (needs local Supabase): `npx vitest run tests/recipe-card-http.test.ts`
- Whole suite passes: `npm test`
- Type check passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- On a Miks track, "Copy as Markdown" copies the heading, the Tool line and the steps; pasted into a Markdown editor, done steps show as checked.
- After toggling a step and reloading, the copied text reflects the new state.
- With a native tool chosen, the Tool line ends with "(native)".
- When the clipboard write fails (e.g. open via LAN IP over http, or block clipboard permission), the red message and a selected textarea with the Markdown appear.
- With JavaScript disabled, no button is shown and the checklist still works.

**Implementation Note**: Pause here for the human to confirm the manual checks.

---

## Testing Strategy

### Unit Tests:

- Exact format, native suffix, multi-line step text, unknown completed ids, empty steps.

### Integration Tests:

- HTTP: the rendered card contains the button with `data-markdown`, the status and the fallback textarea.

### Manual Testing Steps:

1. Open a Miks track, tick one step, click "Copy as Markdown", paste into a Markdown editor.
2. Switch the tool to native, copy again, check the Tool line.
3. Open the app via `http://<LAN-IP>:4321` (not a secure context), click, and check the fallback.
4. Disable JavaScript and reload; no button, checklist still toggles.

## Performance Considerations

None. One string built at render time and a tiny script.

## Migration Notes

None. No data or schema change.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-09, change id `copy-checklist-as-markdown`)
- PRD: `context/foundation/prd.md` FR-014
- Recipe card: `src/components/recipes/RecipeCard.astro:24-104`
- Recipe types: `src/lib/recipes.ts:10-33`
- Similar implementation: `src/lib/listening-note-template.ts`, `src/pages/tracks/[id].astro:328-350`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Markdown formatting

#### Automated

- [x] 1.1 Formatter unit tests pass: `npx vitest run tests/recipe-checklist-markdown.test.ts` — 591fd44
- [x] 1.2 Type check passes: `npx astro check` — 591fd44
- [x] 1.3 Linting passes: `npm run lint` — 591fd44

### Phase 2: Copy button on the recipe card

#### Automated

- [x] 2.1 HTTP tests pass (needs local Supabase): `npx vitest run tests/recipe-card-http.test.ts`
- [x] 2.2 Whole suite passes: `npm test`
- [x] 2.3 Type check passes: `npx astro check`
- [x] 2.4 Linting passes: `npm run lint`
- [x] 2.5 Production build passes: `npm run build`

#### Manual

- [x] 2.6 On a Miks track, "Copy as Markdown" copies the heading, the Tool line and the steps; pasted into a Markdown editor, done steps show as checked.
- [x] 2.7 After toggling a step and reloading, the copied text reflects the new state.
- [x] 2.8 With a native tool chosen, the Tool line ends with "(native)".
- [x] 2.9 When the clipboard write fails (e.g. open via LAN IP over http, or block clipboard permission), the red message and a selected textarea with the Markdown appear.
- [x] 2.10 With JavaScript disabled, no button is shown and the checklist still works.
