# Paste Recipe Screenshot from Clipboard — Plan Brief

> Full plan: `context/changes/paste-recipe-screenshot-from-clipboard/plan.md`

## What & Why

A producer can paste a screenshot from the clipboard (Ctrl/Cmd+V) into the new-recipe form instead of choosing a file. It is PRD FR-016 (nice-to-have): copying a settings screenshot and pasting it is faster than saving a file first. The PRD warns that paste complicates image handling, so the pasted image must reuse the existing upload path instead of adding a second one.

## Starting Point

`/recipes/new` has one file input and handles its own POST. The server already rejects files over 1 MB and files that are not PNG/JPEG/WebP (by magic bytes), keeps the typed text on error, and stores the image in the `recipes` row under RLS. File upload works and stays.

## Desired End State

Pressing Ctrl/Cmd+V with an image on the clipboard fills the Screenshot field, shows a thumbnail with name and size, and announces it. Saving behaves exactly like an upload. "Remove image" clears it. A clipboard without an image, a GIF/SVG, or an image over 1 MB gives a clear message and keeps what was selected before. Text still pastes normally, and without JavaScript the form works as before.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Mechanism | Put the pasted `File` into the existing `image` input via `DataTransfer` | The POST stays an ordinary upload, so no second validation or storage path | Task + Code |
| Where paste works | Whole form: listener on `document`, acting only when the target is inside the form or is `body` | Works right after load and from any field, without a special zone | Interview |
| Text vs image | Image-only clipboard attaches even from a text field; image plus text in a text field is treated as text | Text paste in Intent and Steps must never break | Plan |
| Replace / preview | Last wins; thumbnail with name and size; "Remove image" button; status announced | The shown image is exactly what will be sent, and it can be removed before saving | Interview |
| Over 1 MB | Reject with a message showing size and limit; keep the previous selection; no compression | Avoids a second image-processing path and blurred knob labels; limit stays 1 MB | Interview |
| Client vs server checks | Client type and size checks are advisory; the server stays authoritative | Test-plan risk #5: client validation proves nothing | Code |
| Limit source | Server renders `data-max-bytes` from `MAX_IMAGE_BYTES` | One definition of the limit, and zod stays out of the browser bundle | Plan |
| Accessibility | File input stays; hint, thumbnail and status appear only with JS; status is `role="status"`; Remove is a real button that returns focus to the input | Paste must not be the only path | Task + Plan |
| Server wording | "Choose the image again" becomes "Choose or paste the image again" | A server error empties the file input, and no test asserts the old text | Plan |
| Database and API | No change | The insert and RLS are untouched, so row isolation is unchanged | Task |

## Scope

**In scope:** paste into `/recipes/new`, thumbnail, remove button, status messages, updated server wording, a pure decision module with unit tests, one HTTP markup test.

**Out of scope:** database, routes, RLS, limits; compression or higher limit; picker-side size check; drag-and-drop; restoring the image after a server error; browser E2E.

## Architecture / Approach

`src/lib/recipe-image-paste.ts` holds a pure `planPaste` (ignore / attach / reject) plus message texts and is tested in `node`. A thin Astro `<script>` in `new.astro` reads the clipboard event, calls `planPaste`, fills the file input, and renders the thumbnail, status and remove button. The form POST and the server code are unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Paste decision logic | `planPaste`, messages and unit tests, test-first | Edge cases: image plus text, the exact 1 MB boundary |
| 2. Paste, preview and remove in the form | Markup, script, new server wording, HTTP test | Browser differences in `DataTransfer`; real screenshots often over 1 MB |

**Prerequisites:** local Supabase running for `npm test`; nothing else.
**Estimated effort:** about 1–2 sessions across 2 phases.

## Open Risks & Assumptions

- Full-screen Retina PNG screenshots often exceed 1 MB, so some pastes will be rejected; the manual test records how often, and compression or a higher limit stays a possible follow-up.
- Assigning `input.files` from a `DataTransfer` is assumed to work in current Chrome, Firefox and Safari; where it throws, the message sends the user to the file picker.
- There is no browser E2E, so the DOM layer is checked manually; the logic is covered by unit tests and the server by existing HTTP tests.

## Success Criteria (Summary)

- A pasted screenshot saves a recipe with the same result as an uploaded one, and can be seen and removed before saving.
- Wrong or oversized clipboard content gives a clear message, never a silent failure and never a lost selection.
- File upload, text pasting and the JavaScript-off form keep working, and `npm test`, lint, type check and build pass.
