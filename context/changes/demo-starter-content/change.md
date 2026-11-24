---
change_id: demo-starter-content
title: More starter recipes and a seeded demo account
status: implemented
created: 2026-11-24
updated: 2026-11-24
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Phase 2 mismatch (accepted by user, "Adapt and continue"): `tracks` has no DELETE grant/policy (migration 20261101120100), so `seedDemo` cannot wipe tracks. It reuses tracks named "Szkic: Lato", "Nocna jazda", "Kolory" (resetting their stage) and creates missing ones. It also deletes `listening_notes`, which the plan did not list. Stray tracks and progress outside the demo set are NOT removed.
- Phase 3 follow-up: the README "Demo account" section must tell the user to delete stray tracks on the demo account by hand before the production run, and the 3.4 check ("3 tracks") depends on it.
- Closed without the production seed run (user decision, 2026-11-24): the 10xBuilder requirements do not need a demo account, and a reviewer can sign up on `workers.dev`. 3.4 and 3.5 stay unchecked. The script is ready in the repo if the submission form later asks for demo credentials. Deployed Worker version `35dc2975` (from `master` at `5d32263`).
