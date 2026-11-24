# Paste Recipe Screenshot from Clipboard Implementation Plan

## Overview

A signed-in producer can paste a screenshot from the clipboard (Ctrl/Cmd+V) into the new-recipe form instead of choosing a file. The pasted image goes into the existing `image` file field, shows a thumbnail with a "Remove image" button, and is validated and stored by the same server code as an uploaded file. This is PRD FR-016 (nice-to-have). File upload stays as the main path.

## Current State Analysis

- `src/pages/recipes/new.astro` renders one plain `<input id="recipe-image" name="image" type="file">` (`new.astro:134-137`) in a `multipart/form-data` form and handles its own POST (`new.astro:29-103`). It rejects a declared body over 5 MB (413), a file over `MAX_IMAGE_BYTES` (413), and a file whose magic bytes are not PNG/JPEG/WebP (400). On any error it re-renders with the typed intent, type and steps, but the file input comes back empty, so the image must be chosen again.
- `src/lib/recipe-input.ts` owns the limits and the type check: `MAX_IMAGE_BYTES = 1_048_576` (`recipe-input.ts:4`) and `sniffImage` by magic bytes (`recipe-input.ts:40`). The browser-reported type is never trusted there.
- `src/pages/api/recipes/[id]/image.ts` only serves a stored image to its owner; it plays no part in saving.
- Client-side behavior in this repo is an Astro `<script>` that reveals a `hidden` control only when JS runs and reports problems in a status element (`src/components/recipes/RecipeCard.astro:127-160`, `src/pages/tracks/[id].astro:328`). There is no React in the recipe pages.
- Vitest runs in `node` with no DOM (`vitest.config.ts`), so browser logic can be unit-tested only if it is a pure function. HTTP tests boot the dev server and read the rendered HTML (`tests/recipes-http.test.ts`).
- `recipe-input.ts` imports zod and `@/lib/plugins`; importing it from a client script would pull them into the browser bundle.
- Row isolation is enforced by RLS on `recipes` (`supabase/migrations/20261103120000_recipes.sql`). Saving still goes through the same insert, so nothing in isolation changes.
- The roadmap has no item with this Change ID; FR-016 sits only in its "parked" list.

## Desired End State

On `/recipes/new` a signed-in user copies a screenshot and presses Ctrl/Cmd+V. It works with the cursor in Intent, Tool type or Steps, with focus on the Save button, and right after the page loads with nothing focused. A thumbnail with the file name and size appears under the Screenshot field, a status line announces "Screenshot pasted.", and saving stores the recipe exactly as an uploaded file does. Pasting text into Intent and Steps behaves as before.

A later paste replaces the chosen file; choosing a file afterwards replaces the pasted image. "Remove image" clears the selection and the thumbnail. A clipboard without an image (outside a text field), a GIF or SVG, or an image over 1 MB shows a clear message, keeps whatever was selected before, and never fails silently. Without JavaScript nothing changes: the file input works and no paste hint or thumbnail is shown. The server rules and messages stay authoritative.

### Key Discoveries:

- The pasted `File` can be placed into the existing input with a `DataTransfer`, so the POST is an ordinary multipart upload and no second validation or storage path is needed (`new.astro:55-61`).
- Right after load the focus is on `body`, so a listener on the `<form>` alone would miss the first Ctrl+V. The listener must be on `document` and act only when the event target is inside the form or is `body`.
- Assigning `input.files` in code does not fire `change`, so the thumbnail must be rendered directly after a paste.
- Server errors drop the image (the file input comes back empty); the current wording "Choose the image again" would not mention pasting (`new.astro:35,69,72,75,78,84,96`).
- No test asserts the wording of the form errors; they check status codes, the typed text and `role="alert"` (`tests/recipes-http.test.ts:152-155`), so the wording can change safely.
- Test-plan risk #5 says client validation proves nothing: the existing server tests (413 over 1 MB, 400 for a text file named `.png`) remain the proof for rejection.

## What We're NOT Doing

- No change to the database, migrations, RLS, `image.ts`, or the server validation and storage path. Limits stay: 1 MB, PNG/JPEG/WebP.
- No compression, resizing or conversion of large screenshots in the browser, and no higher size limit. A too-large paste is rejected with a message; revisit after the manual test shows how often that happens.
- No client-side size or type check for files chosen with the picker; the server keeps that check, as today.
- No drag-and-drop, no paste on any page other than `/recipes/new`, no multiple images per recipe, no editing of a saved recipe's image.
- No restoring of the image after a server error (a browser cannot refill a file input); the message says to choose or paste it again.
- No browser E2E suite; the test plan does not select one (`context/foundation/test-plan.md` §3 and §6.3).

## Implementation Approach

Phase 1 is a pure function that decides what a paste event should do from the clipboard contents, plus the message texts, delivered test-first. Phase 2 wires it into `new.astro` with a thin script: the paste listener, the thumbnail, the remove button and the status line. The size limit reaches the script as a `data-max-bytes` attribute rendered from `MAX_IMAGE_BYTES`, so the limit stays defined in one place and zod stays out of the browser bundle. The existing server tests prove that rejection still happens on the server; one new HTTP test proves the file input and the new markup are on the page.

## Critical Implementation Details

- **Where the listener acts.** `paste` is listened for on `document`, but acts only when the target is inside `#recipe-form` or is `body`; a paste elsewhere (navigation links, other widgets) is ignored. This is what makes "paste right after load" work without a click.
- **Never swallow text.** `preventDefault()` is called only for `attach` and `reject`. When the plan is `ignore`, the native text paste must run untouched. An image-only clipboard attaches even from a focused text field; a clipboard that also carries text is treated as text when the target is a text field.
- **Programmatic files fire no `change`.** After assigning `input.files`, render the thumbnail directly. Revoke the previous object URL on every replacement and removal.
- **The client check is advisory.** `File.type` and `size` only avoid a pointless upload and give a message earlier; `sniffImage` and the size limit on the server decide.

## Phase 1: Paste decision logic

### Overview

One pure, DOM-free module that turns the clipboard contents into an action and a message, so the rules are tested without a browser. Delivered test-first with `/10x-tdd`.

### Changes Required:

#### 1. Paste planner and messages

**File**: `src/lib/recipe-image-paste.ts` (new)

**Intent**: One place for "what does this paste do" and the texts shown to the user, testable in `node`. It must not import `recipe-input.ts` (zod) or anything server-side; the limit is passed in.

**Contract**:
- `planPaste(input: { files: readonly { type: string; size: number }[]; hasText: boolean; targetIsTextField: boolean; maxBytes: number | null }): PastePlan`, where `PastePlan` is `{ action: "ignore" } | { action: "attach"; index: number } | { action: "reject"; reason: "no-image" | "unsupported-type" | "too-large"; size?: number }`.
- Rules, in order: (1) candidates are files whose `type` starts with `image/`. (2) No candidate: `ignore` when `targetIsTextField && hasText`, otherwise `reject("no-image")`. (3) A candidate exists but `targetIsTextField && hasText`: `ignore` (text wins). (4) The first candidate is used: type not `image/png`, `image/jpeg` or `image/webp` is `reject("unsupported-type")`; `size > maxBytes` (when `maxBytes` is not null) is `reject("too-large", size)`; otherwise `attach(index)`. A size exactly equal to `maxBytes` attaches.
- `pasteMessage(plan reject, maxBytes: number | null): string` with these texts: no image: "The clipboard has no image. Copy a screenshot and paste again, or choose a file."; unsupported: "Only PNG, JPEG or WebP images can be pasted. Copy a screenshot, or choose a file."; too large: "The pasted image is X MB; the limit is Y MB. Take a smaller screenshot or choose a smaller file." X is the size in MB rounded up to one decimal, so a size just over the limit never reads as equal to it; Y is the limit in MB without a trailing ".0".
- `pastedFileName(mime): string` returns `pasted-screenshot.png`, `.jpg` or `.webp` by type.
- `formatImageSize(bytes): string` returns "820 KB" below 1 MB and "1.2 MB" at or above it, for the thumbnail line.

#### 2. Unit tests

**File**: `tests/recipe-image-paste.test.ts` (new)

**Intent**: Pin every branch with expected values written by hand, not copied from the code.

**Contract**: Cases: image-only clipboard attaches from a text field and from outside one; image plus text attaches outside a text field but is ignored inside one; text-only clipboard is ignored inside a text field and `no-image` outside; an empty clipboard and a non-image file are `no-image` outside a text field and in a text field without text; `image/gif` and `image/svg+xml` are `unsupported-type`; size exactly `1_048_576` attaches and `1_048_577` is `too-large` with the message "The pasted image is 1.1 MB; the limit is 1 MB." (the message must not contain "1.0 MB"); `maxBytes: null` never rejects for size; several files use the first image and report its index; the three file names and the size formatting at 820 KB, 1.0 MB and 1.2 MB boundaries.

### Success Criteria:

#### Automated Verification:

- Paste logic tests pass: `npx vitest run tests/recipe-image-paste.test.ts`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`

#### Manual Verification:

- None for this phase; it is pure logic.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 2. Phase blocks use plain bullets; the checkboxes live in `## Progress`.

---

## Phase 2: Paste, preview and remove in the recipe form

### Overview

Wire the planner into `/recipes/new`: paste into the existing file field, show a thumbnail with a remove button and an announced status, and update the server messages so they also mention pasting.

### Changes Required:

#### 1. Form markup

**File**: `src/pages/recipes/new.astro`

**Intent**: Give the script stable hooks and keep file upload as the main, always-working path.

**Contract**:
- The `<form>` gets `id="recipe-form"`. The file input keeps `id="recipe-image"`, `name="image"`, `type="file"` and `accept`, and gains `data-max-bytes={MAX_IMAGE_BYTES}` and `aria-describedby` pointing at the hint and the status.
- Below the input: a hint paragraph (`id="recipe-image-help"`, `hidden` until the script runs) reading "Or paste a screenshot with Ctrl/Cmd+V."; a preview block (`id="recipe-image-preview"`, `hidden`) containing an `<img>` with alt "Preview of the selected screenshot", a line with file name and size, and `<button type="button" id="recipe-image-remove">Remove image</button>`; and an always-present empty status element (`id="recipe-image-status"`, `role="status"`) so it exists as a live region at load. Use the existing `field`/`button` classes and `class:list`; do not use `set:html`.

#### 2. Paste, preview and remove script

**File**: `src/pages/recipes/new.astro` (an Astro `<script>` after the form, same pattern as `RecipeCard.astro:127-160`)

**Intent**: A thin DOM layer over `planPaste`; all decisions live in `src/lib/recipe-image-paste.ts`.

**Contract**:
- On load: reveal the hint; read `data-max-bytes` (a non-numeric value becomes `null`, so only the server checks size).
- `paste` on `document`: ignore unless the target is inside `#recipe-form` or is `body`; compute `targetIsTextField` (input types text/search/etc. and textarea, not the file input, select or buttons), `hasText` from `text/plain`, and the files from `clipboardData.files`; call `planPaste`. For `ignore` do nothing. For `attach` and `reject` call `preventDefault()`. On `attach`, wrap the image in a `File` named by `pastedFileName`, put it into the input through a `DataTransfer`, render the thumbnail, and set the status to "Screenshot pasted." or "Pasted screenshot replaced the selected file." when a file was selected before. On `reject`, show `pasteMessage` as an error in the status element and leave the current selection untouched. If building the `DataTransfer` or assigning `files` throws, show "This browser cannot attach a pasted image. Choose a file instead."
- `change` on the input renders the thumbnail for the chosen file (or hides it when cleared) and clears the status.
- "Remove image" clears `input.value`, hides the thumbnail, revokes the object URL, sets the status to "Image removed." and moves focus to the file input.
- Error and info statuses use the same colour toggle as `RecipeCard.astro:147-148` (`text-red-200` for errors). No `console` calls.

#### 3. Server messages mention pasting

**File**: `src/pages/recipes/new.astro` (the `handlePost` messages, currently `new.astro:35,69,72,75,78,84,96`)

**Intent**: After a server error the image is gone from the input, so every "Choose the image again" tells the user to choose or paste it.

**Contract**: Replace "Choose the image again." with "Choose or paste the image again." in all of them, and "…and choose an image." with "…and choose or paste an image." in the missing-fields message. Status codes, conditions and the 5 MB body guard stay unchanged.

#### 4. HTTP tests

**File**: `tests/recipes-http.test.ts` (extend)

**Intent**: Prove the file input and the new hooks are on the page and that the server still rejects, with the new wording.

**Contract**: A signed-in `GET /recipes/new` returns 200 and the body contains `type="file"`, `name="image"`, `data-max-bytes="1048576"`, `id="recipe-image-status"` and `role="status"`, and still contains the "Save recipe" button. The existing 413 and 400 cases additionally expect the body to contain "paste". All existing assertions stay as they are, since the server path is unchanged.

### Success Criteria:

#### Automated Verification:

- Recipe HTTP tests pass: `npx vitest run tests/recipes-http.test.ts`
- All tests pass: `npm test`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- A screenshot pasted with the Intent field focused, and again with nothing focused right after load, shows the thumbnail, and saving puts the recipe with that image in `/recipes`
- Text still pastes normally into Intent and Steps
- Pasting over a chosen file replaces it, and choosing a file after a paste replaces the pasted image; each change is announced in the status line
- "Remove image" clears the thumbnail and the selection, works with the keyboard alone, and returns focus to the file input
- A text-only clipboard outside a text field, a GIF or SVG, and a screenshot over 1 MB each show a clear message and keep the previous selection
- Pasting works in Chrome and at least one of Firefox or Safari; where the browser cannot attach the image, the message points to the file picker
- With JavaScript off, the file input works as before and no paste hint or thumbnail is shown
- The form, thumbnail and Remove button are usable at phone width

**Implementation Note**: This is the last phase; after it, run `/10x-impl-review` before archiving.

---

## Testing Strategy

### Unit Tests:

- `tests/recipe-image-paste.test.ts`: the clipboard decision rules, the boundary at exactly 1 MB and 1 byte over, message texts, file names and size formatting.

### Integration Tests:

- `tests/recipes-http.test.ts`: the page keeps the file input and exposes the paste hooks and limit; the existing 413 (over 1 MB), 400 (text file named `.png`) and missing-image cases keep proving that the server rejects and keeps the typed text, now with the "paste" wording. `tests/recipes-rls.test.ts` and the rest of `npm test` confirm that row isolation is untouched.

### Manual Testing Steps:

1. Sign in, open `/recipes/new`, take a screenshot (Win+Shift+S on Windows, Cmd+Ctrl+Shift+4 on macOS), press Ctrl/Cmd+V with nothing focused, fill the form and save; the recipe appears in `/recipes` with the image.
2. Repeat with the cursor in Intent, then paste plain text into Intent and Steps.
3. Paste an image, choose a file, paste another image; check the thumbnail and the status after each step, then use "Remove image" with the keyboard.
4. Try a copied GIF or SVG, a text-only clipboard with focus on the Save button, and a full-screen Retina screenshot over 1 MB; note how often the size limit blocks real screenshots.
5. Repeat the main flow in a second browser, with JavaScript off, and at phone width.

## Performance Considerations

The thumbnail uses an object URL, not a data URL, and it is revoked on replacement and removal. Nothing changes on the server: the same single multipart POST and the same one insert.

## Migration Notes

None. No database, route or configuration change. A rollback reverts `new.astro`, the new `src/lib` module and the tests.

## References

- PRD: `context/foundation/prd.md:114` (FR-016) and the Socratic note under it
- Previous plan: `context/archive/2026-11-03-author-recipe-with-screenshot/plan.md`
- Form and server validation: `src/pages/recipes/new.astro:29-103`, `src/lib/recipe-input.ts:4`, `src/lib/recipe-input.ts:40`
- Client script pattern: `src/components/recipes/RecipeCard.astro:127-160`; pure-helper-plus-script precedent: `context/archive/2026-11-23-copy-checklist-as-markdown/plan.md`
- Test strategy: `context/foundation/test-plan.md` (risk #5, §6.2)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Paste decision logic

#### Automated

- [x] 1.1 Paste logic tests pass: `npx vitest run tests/recipe-image-paste.test.ts` — bb09553
- [x] 1.2 Linting passes: `npm run lint` — bb09553
- [x] 1.3 Type checking passes: `npx astro check` — bb09553

### Phase 2: Paste, preview and remove in the recipe form

#### Automated

- [x] 2.1 Recipe HTTP tests pass: `npx vitest run tests/recipes-http.test.ts`
- [x] 2.2 All tests pass: `npm test`
- [x] 2.3 Linting passes: `npm run lint`
- [x] 2.4 Type checking passes: `npx astro check`
- [x] 2.5 Build passes: `npm run build`

#### Manual

- [x] 2.6 A screenshot pasted with the Intent field focused, and again with nothing focused right after load, shows the thumbnail, and saving puts the recipe with that image in `/recipes`
- [x] 2.7 Text still pastes normally into Intent and Steps
- [x] 2.8 Pasting over a chosen file replaces it, and choosing a file after a paste replaces the pasted image; each change is announced in the status line
- [x] 2.9 "Remove image" clears the thumbnail and the selection, works with the keyboard alone, and returns focus to the file input
- [x] 2.10 A text-only clipboard outside a text field, a GIF or SVG, and a screenshot over 1 MB each show a clear message and keep the previous selection
- [x] 2.11 Pasting works in Chrome and at least one of Firefox or Safari; where the browser cannot attach the image, the message points to the file picker
- [x] 2.12 With JavaScript off, the file input works as before and no paste hint or thumbnail is shown
- [x] 2.13 The form, thumbnail and Remove button are usable at phone width
