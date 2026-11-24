# Copy a recipe checklist as Markdown — Plan Brief

> Full plan: `context/changes/copy-checklist-as-markdown/plan.md`

## What & Why

Roadmap S-09 (PRD FR-014): the user can copy a recipe checklist to the clipboard as Markdown, so it can go into a session note, Obsidian or a task list without retyping.

## Starting Point

The recipe card on a Miks track (`src/components/recipes/RecipeCard.astro`) shows the intent, the chosen tool and a checklist whose done state is stored per track. There is no clipboard code yet. S-08 left a pattern: a pure function in `src/lib` plus a small page script that reveals a hidden button.

## Desired End State

A "Copy as Markdown" button above the checklist copies:

```
## Sidechain stopy z basem

Tool: Pro-C 2

- [x] Wstaw kompresor na bas
- [ ] Ustaw sidechain na stopę
```

Success shows "Copied to clipboard.". Failure shows a red message and a selected textarea with the same text. Without JS the card works as before.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Markdown content | Heading + `Tool:` line + steps with `[x]`/`[ ]` | A self-contained note that keeps progress. |
| Feedback | Status on success; red message + selectable textarea on failure | The user always gets the text, even without clipboard access. |
| Where Markdown is built | Server, at render, into `data-markdown` | All data is known at render; no API call from the script. |
| Native tool | `Tool: <label> (native)` | Matches what the card shows. |
| Multi-line step text | Flattened to one line | Keeps one step per list item. |

## Scope

**In scope:** formatter + unit tests, button/status/fallback on the in-track card, HTTP check.

**Out of scope:** screenshot copy, other formats, button on `/recipes`, `execCommand` fallback, any data/API change.

## Architecture / Approach

`recipeChecklistToMarkdown()` in `src/lib/recipe-checklist-markdown.ts` is called in `RecipeCard.astro` frontmatter; its result is put on the button. A component `<script>` calls `navigator.clipboard.writeText` and switches between the success status and the fallback.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Markdown formatting | Pure formatter with exact-format unit tests | Format drift from the agreed example |
| 2. Copy button on the recipe card | Button, clipboard write, status, fallback, HTTP check | Clipboard unavailable outside a secure context |

**Prerequisites:** S-04 card (done); local Supabase for HTTP tests.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes the card is rendered at most once per page (fixed element ids).
- Clipboard failure can only be checked manually (LAN IP over http or blocked permission).

## Success Criteria (Summary)

- Pasting the copied text into a Markdown editor shows the recipe heading, tool and a checklist with the right boxes ticked.
- A failed copy never leaves the user without the text.
