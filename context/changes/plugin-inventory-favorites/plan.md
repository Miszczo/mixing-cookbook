# Plugin Inventory and Favorites: Short Plan

Roadmap S-02. PRD: FR-003, FR-004.

> Note: this plan was written alongside the code, without a `/10x-plan` session.

## Outcome

A signed-in producer adds, edits, and deletes owned plugins with a name and a type on `/plugins`, and marks favorites. Favorites list first. This is the full CRUD resource for the project, and S-04 reads it for matching.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Fields | `name`, `plugin_type`, `is_favorite` | FR-003 limits the catalog to what matching needs |
| Types | compressor, eq, reverb, delay, saturation, other | Fixed ids in a check constraint and in `src/lib/plugins.ts` |
| Favorites | Several allowed | FR-004 says "plugins"; S-04 orders them |
| Duplicate names | Allowed | A user may hold two versions, and blocking adds no value |
| UI | Server-rendered Astro forms | No client state is needed |
| Actions | `POST /api/plugins`, `POST /api/plugins/[id]` with `action` | HTML forms send only POST |

## Proof

`tests/plugins-tracks-http.test.ts` covers anonymous rejection, a rejected body that keeps typed text, create, update, favorite, delete, another user's list, and another user's delete attempt.

## Progress

- [x] Migration with RLS and four owner policies
- [x] Routes, page, and navigation
- [x] Two-user HTTP proof, lint, and type check
