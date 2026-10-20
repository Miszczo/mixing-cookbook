---
change_id: testing-runner-access-boundary
title: Stand up the runner and prove the access boundary
status: archived
created: 2026-10-07
updated: 2026-10-20
archived_at: 2026-10-20T16:33:48Z
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Runner i granica dostępu".
Risks covered: #1 Zalogowany użytkownik widzi pluginy, zrzuty albo notatki kogoś innego; #4 Niezalogowana osoba otwiera prywatny adres i dostaje dane, albo zalogowana nie może dojść do własnego utworu. Test types planned: Vitest, integracja.
Risk response intent: #1 prove a second signed-in user cannot read the first user's rows; challenge "RLS enabled" or a bare 401; avoid mocking the ownership check and a check that only looks at HTTP 200. #4 prove a signed-out request does not receive private data and a signed-in user can reach their own track; challenge "a redirect on one page also closes the API"; avoid a test that only covers the sign-in page.
After creating the folder, follow the downstream continuation rule.
