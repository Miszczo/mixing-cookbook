---
change_id: demo-starter-content
title: More starter recipes and a seeded demo account
status: implementing
created: 2026-11-24
updated: 2026-11-24
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Phase 2 mismatch (accepted by user, "Adapt and continue"): `tracks` has no DELETE grant/policy (migration 20261101120100), so `seedDemo` cannot wipe tracks. It reuses tracks named "Szkic: Lato", "Nocna jazda", "Kolory" (resetting their stage) and creates missing ones. It also deletes `listening_notes`, which the plan did not list. Stray tracks and progress outside the demo set are NOT removed.
- Phase 3 follow-up: the README "Demo account" section must tell the user to delete stray tracks on the demo account by hand before the production run, and the 3.4 check ("3 tracks") depends on it.
