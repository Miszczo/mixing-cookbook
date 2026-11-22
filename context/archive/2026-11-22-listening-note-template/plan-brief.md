# Listening-note template — Plan Brief

> Full plan: `context/changes/listening-note-template/plan.md`

## What & Why

An "Insert template" button on the listening-note form that appends five labels (Vocals, Low end, Stereo / width, Loudness, To fix next) to the Notes field. A fixed checklist makes each listening pass repeatable across headphones, car and speakers. This is roadmap slice S-08 (FR-015, nice-to-have), named in the PRD's secondary success criteria.

## Starting Point

Every track page already has a listening-notes form (`src/pages/tracks/[id].astro`) with an equipment input and a Notes textarea limited to 2000 characters. The page is server-rendered with no client JavaScript, and saving and validation are done on the server.

## Desired End State

The form shows an "Insert template" button when JavaScript runs. One click appends the five labels to the end of the Notes field, after a blank line if text is already there. Typed text is never lost. If the result would pass 2000 characters, nothing is inserted and a message explains why. Saving works as before.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Template content | Five English labels: Vocals, Low end, Stereo / width, Loudness, To fix next | Matches the English UI and gives a repeatable listening layout. |
| Non-empty field | Append at the end after a blank line; refuse with a message if over 2000 characters | The roadmap names overwriting typed text as the main risk. |
| Client wiring | Small Astro `<script>`, button revealed by the script | No React island, and the form is unchanged for visitors without JavaScript. |
| Logic location | New dependency-free `src/lib/listening-note-template.ts` | Keeps `zod` out of the client bundle and makes the rule unit-testable. |
| Tests | Unit tests for the function plus an HTTP check that the button is rendered | Covers the overwrite and limit risks without a browser; the click is checked by hand. |

## Scope

**In scope:**

- Template module and unit tests
- Button, message and script in the track page
- One HTTP check for the rendered button

**Out of scope:**

- API, database, RLS or schema changes
- Editable or multiple templates, Polish labels
- Insertion at the cursor, React island, Playwright test

## Architecture / Approach

A pure function decides the new text from the current text and the field's `maxLength`. A short script on the track page calls it on click and updates the textarea. The button starts `hidden` and is shown by the script, so without JavaScript the page looks and works as it does today.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Template logic | Template constant, append rule, unit tests | Off-by-one at exactly 2000 characters |
| 2. Insert button on the track page | Button, message, script, HTTP check | Importing a module with `zod` into the client bundle |

**Prerequisites:** S-07 (track listening notes) is done and archived; local Supabase is needed for the HTTP test.
**Estimated effort:** ~1 session across 2 small phases.

## Open Risks & Assumptions

- The click behaviour is verified manually; there is no browser test.
- Assumes the five labels are enough for a first template; changing them later is a one-line edit.

## Success Criteria (Summary)

- A producer can fill the Notes field with the template in one click.
- Text already typed is never removed.
- Saving a note with the template works and shows it in the list.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-08)
- PRD: `context/foundation/prd.md` FR-015
