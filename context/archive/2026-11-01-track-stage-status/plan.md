# Track Name and Stage: Short Plan

Roadmap S-03. PRD: FR-010.

> Note: this plan was written alongside the code, without a `/10x-plan` session.

## Outcome

A signed-in producer creates a track with a name and a stage on `/tracks`, opens it at `/tracks/[id]`, and edits both fields. S-04 places the recipe card on that page.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Stages | `aranz`, `miks`, `master` with labels Aranż, Miks, Master | The three stages FR-010 names |
| Delete | Not offered | FR-010 asks for create and edit only, so RLS grants no delete |
| Other users | 404 | RLS returns no row, and the page does not reveal that the track exists |

## Proof

`tests/plugins-tracks-http.test.ts` covers the anonymous redirect, a rejected create that keeps typed text, create, edit after a fresh read, and another user's read and edit attempts.

## Progress

- [x] Migration with RLS and owner policies
- [x] Routes and pages
- [x] Two-user HTTP proof, lint, and type check
- [x] Manual browser check of `/tracks`, confirmed by the project owner on 2026-11-01
