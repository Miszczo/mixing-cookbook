# Listening-note template Implementation Plan

## Overview

Add an "Insert template" button to the listening-note form on the track page. It appends a five-label listening checklist to the Notes field, so a producer can repeat the same listening routine on every reference system. This is roadmap slice S-08 (FR-015, nice-to-have). Saving, validation and storage stay as they are.

## Current State Analysis

- The note form is a plain Astro `<form method="POST">` in `src/pages/tracks/[id].astro:243-275`, with an `equipment` input and a `<textarea id="note-body" name="body" maxlength={MAX_NOTE_LENGTH}>`.
- The track page ships no client-side JavaScript today. The form works without it and re-renders typed text after a failed save (`noteError`, `bodyValue`).
- Server rules live in `src/lib/listening-notes.ts`: `MAX_NOTE_LENGTH = 2000` and a zod schema that trims `body`. That module imports `zod` and `@/lib/tracks`, so it must not be imported into a client script.
- `context/archive/2026-11-09-track-listening-notes/plan.md:37` parked the template on purpose; nothing in the code anticipates it.
- Tests: pure-function tests in `tests/listening-notes.test.ts`; HTTP tests in `tests/listening-notes-http.test.ts` start the app against local Supabase and use a `notesSection()` helper to assert only on the notes section.

## Desired End State

On every track page the Listening notes form has an "Insert template" button (visible only when JavaScript runs). Clicking it appends this text to the Notes field, after a blank line when the field already has text:

```
Vocals: 
Low end: 
Stereo / width: 
Loudness: 
To fix next: 
```

Text the user already typed is never removed. If the result would exceed 2000 characters, nothing is inserted and a short message says why. Saving a note works exactly as before. Verify with the unit tests, the HTTP test, and the manual checks below.

### Key Discoveries:

- `src/pages/tracks/[id].astro:262-271` — the textarea already carries `maxlength={MAX_NOTE_LENGTH}`, so the client can read the limit from the element instead of importing it.
- `src/lib/listening-notes.ts:1-3` — importing this file in a client script would pull `zod` and the tracks module into the bundle; the template logic goes in its own dependency-free module.
- `tests/listening-notes-http.test.ts:11-19` — `notesSection()` scopes assertions to `id="notes"`, which the new HTTP check reuses.

## What We're NOT Doing

- No change to the API, database, migrations, RLS or the zod schema.
- No template editing, multiple templates, Polish labels, or per-user templates.
- No insertion at the cursor position; the template is always appended at the end.
- No React island and no change to how the form posts or re-renders after an error.
- No browser (Playwright) test; the click is checked manually. Playwright is not set up in this repo.

## Implementation Approach

Put the template text and the append rule in a new pure module with no imports, test it first, then wire a small Astro `<script>` to a `type="button"` control. The button is rendered `hidden` and revealed by the script, so a visitor without JavaScript never sees a dead control.

## Critical Implementation Details

- **Client bundle**: the new module must have no imports (in particular not `@/lib/listening-notes`), otherwise `zod` lands in the page's client bundle. The script gets the limit from `textarea.maxLength`.

## Phase 1: Template logic

### Overview

A dependency-free module holding the template and the append rule, covered by unit tests.

### Changes Required:

#### 1. Template module

**File**: `src/lib/listening-note-template.ts` (new)

**Intent**: Define the template text and the rule for adding it to whatever the user has already typed, so the risk named in the roadmap (overwriting typed text) is enforced in one tested place.

**Contract**: `LISTENING_NOTE_TEMPLATE: string` — the five lines `Vocals: `, `Low end: `, `Stereo / width: `, `Loudness: `, `To fix next: ` joined with `\n`, no trailing newline. `appendListeningNoteTemplate(current: string, max: number): { text: string; inserted: boolean }`:

- `current` empty or whitespace only → `text` is the template.
- otherwise → `text` is `current` with trailing whitespace removed, then `\n\n`, then the template; the original text is otherwise unchanged.
- when `text.length > max` → `inserted: false` and `text` is `current` unchanged.
- no imports.

#### 2. Unit tests

**File**: `tests/listening-note-template.test.ts` (new)

**Intent**: Pin the rule, following the style of `tests/listening-notes.test.ts`.

**Contract**: cases for an empty field, a whitespace-only field, typed text (kept verbatim, blank line before the template, trailing newlines not doubled), a result of exactly `max` characters (inserted) and `max + 1` (refused, text unchanged), and that the template alone fits in 2000 characters.

### Success Criteria:

#### Automated Verification:

- Template unit tests pass: `npx vitest run tests/listening-note-template.test.ts`
- Type check passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- None; this phase has no user-visible change.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 2. Phase blocks use plain bullets; the checkboxes live in `## Progress`.

---

## Phase 2: Insert button on the track page

### Overview

Render the button and a message area in the note form, wire the script, and add an HTTP check that the control is on the page.

### Changes Required:

#### 1. Button, message and script

**File**: `src/pages/tracks/[id].astro`

**Intent**: Let the user append the template to the Notes field with one click, and tell them when it does not fit.

**Contract**: Inside the note form, next to the Notes label: `<button type="button" id="note-template-button" hidden>Insert template</button>`, styled with the existing `button` class list, and `<p id="note-template-message" role="status" hidden>` below the textarea. A `<script>` at the end of the page imports `appendListeningNoteTemplate` from `@/lib/listening-note-template`, reveals the button, and on click calls the function with `textarea.value` and `textarea.maxLength`. When `inserted` is true it sets the value, dispatches an `input` event, focuses the textarea with the caret at the end, and hides the message. When false it shows "The template does not fit: notes are limited to 2000 characters." (limit rendered from `MAX_NOTE_LENGTH`) and leaves the textarea untouched. The button must not submit the form.

#### 2. HTTP check

**File**: `tests/listening-notes-http.test.ts`

**Intent**: Confirm the control is present in the real rendered page and cannot submit the form.

**Contract**: one new `it` that opens a track page and asserts, inside `notesSection(body)`, that `id="note-template-button"` exists with `type="button"` and that `id="note-template-message"` exists.

### Success Criteria:

#### Automated Verification:

- HTTP tests pass (needs local Supabase): `npx vitest run tests/listening-notes-http.test.ts`
- Whole suite passes: `npm test`
- Type check passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- On an empty Notes field, "Insert template" fills in the five labels and the caret is in the field.
- With text already typed, the template is added below it after a blank line and the typed text is unchanged.
- With about 1990 characters typed, clicking shows the "does not fit" message and the field is unchanged.
- A note saved after inserting the template appears in the list with the labels and the user's answers.
- With JavaScript disabled, the form works and no "Insert template" button is shown.

**Implementation Note**: Pause here for the human to confirm the manual checks.

---

## Testing Strategy

### Unit Tests:

- Empty, whitespace-only, typed text, trailing newlines, exact limit and one over the limit.

### Integration Tests:

- HTTP: the rendered notes section contains the button (`type="button"`) and the message element.

### Manual Testing Steps:

1. Open a track, click "Insert template" in an empty form, and check the five labels.
2. Type a sentence, click again, and check the sentence stays above the template.
3. Fill the field to about 1990 characters, click, and check the message and the unchanged text.
4. Fill the labels, save, and check the note in the list.
5. Disable JavaScript and reload; the button is absent and saving still works.

## Performance Considerations

None. The script is a few lines and imports a module with no dependencies.

## Migration Notes

None. No data or schema change.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-08, change id `listening-note-template`)
- PRD: `context/foundation/prd.md` FR-015
- Note form: `src/pages/tracks/[id].astro:243-275`
- Limits and schema: `src/lib/listening-notes.ts:1-12`
- Earlier change that parked the template: `context/archive/2026-11-09-track-listening-notes/plan.md:37`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Template logic

#### Automated

- [x] 1.1 Template unit tests pass: `npx vitest run tests/listening-note-template.test.ts` — 577b0fa
- [x] 1.2 Type check passes: `npx astro check` — 577b0fa
- [x] 1.3 Linting passes: `npm run lint` — 577b0fa

### Phase 2: Insert button on the track page

#### Automated

- [x] 2.1 HTTP tests pass (needs local Supabase): `npx vitest run tests/listening-notes-http.test.ts` — d5c1a61
- [x] 2.2 Whole suite passes: `npm test` — d5c1a61
- [x] 2.3 Type check passes: `npx astro check` — d5c1a61
- [x] 2.4 Linting passes: `npm run lint` — d5c1a61
- [x] 2.5 Production build passes: `npm run build` — d5c1a61

#### Manual

- [x] 2.6 On an empty Notes field, "Insert template" fills in the five labels and the caret is in the field. — d5c1a61
- [x] 2.7 With text already typed, the template is added below it after a blank line and the typed text is unchanged. — d5c1a61
- [x] 2.8 With about 1990 characters typed, clicking shows the "does not fit" message and the field is unchanged. — d5c1a61
- [x] 2.9 A note saved after inserting the template appears in the list with the labels and the user's answers. — d5c1a61
- [x] 2.10 With JavaScript disabled, the form works and no "Insert template" button is shown. — d5c1a61
