# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-07

## 1. Strategy

Testy w tym projekcie trzymają się trzech zasad:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src`, `scripts`, `supabase/migrations`. Scoped history has 4 commits in the last 30 days, below the threshold of 5, so likelihood ratings use the roadmap and the Phase 2 interview only.

## 2. Risk Map

Najważniejsze scenariusze awarii, w kolejności wpływ × prawdopodobieństwo. Kolumna Source cytuje dowód, który wyniósł ryzyko, nie miejsce awarii w kodzie.

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | Zalogowany użytkownik widzi pluginy, zrzuty albo notatki kogoś innego | High | High | wywiad Q1; PRD Access Control i NFR o prywatności; roadmapa F-01 (done) oraz S-01–S-07, które zapisują prywatne wiersze |
| 2 | Przy braku pasującego VST karta jest pusta albo kończy się błędem; przy kilku zgodnych wtyczkach ulubiona nie jest pierwsza | High | Medium | wywiad Q1; PRD Guardrails i kryteria US-01; roadmapa S-04 (proposed) |
| 3 | Po odświeżeniu znika notatka odsłuchowa, odhaczony krok albo wgrany zrzut | High | Medium | wywiad Q1; PRD US-01 i NFR o trwaniu zapisu; roadmapa S-07 (proposed) |
| 4 | Niezalogowana osoba otwiera prywatny adres i dostaje dane, albo zalogowana nie może dojść do własnego utworu | High | Medium | PRD FR-001 i Access Control; roadmapa: auth jest w bazie, kolejne slice'y dokładają chronione ścieżki |
| 5 | Zbyt duży plik albo niepoprawne dane zostają przyjęte, a tekst formularza znika przy błędzie | Medium | Medium | PRD NFR o błędzie pliku i sieci; reguła AGENTS.md o walidacji wejścia na API |

Prawdopodobieństwo #1 jest High, bo każdy pozostały slice kamienia milowego zapisuje prywatne dane. Nie wynika z churnu git.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Drugi zalogowany użytkownik nie odczytuje wierszy pierwszego | Sam fakt „RLS włączone” albo sam kod 401 | Sesja dwóch użytkowników i wiersz, który ma właściciela | Integracja na lokalnym Supabase | Mock sprawdzenia własności; sprawdzenie, które patrzy tylko na status 200 |
| #2 | Bez pasującego VST karta nazywa natywne narzędzie wybranego DAW; ulubiona wtyczka jest przed innymi zgodnymi | Pusta karta przy kodzie 200 jest sukcesem | Czy karta już istnieje; skąd bierze się nazwa narzędzia DAW, niezależnie od kodu doboru | Integracja reguły doboru na danych fixture | Wyrocznia skopiowana z funkcji doboru; test samego happy-path z ulubioną wtyczką |
| #3 | Po nowym wejściu na utwór notatka, krok i zrzut nadal są | Kod 200 przy zapisie oznacza, że dane przetrwały | Czy zapis notatki już istnieje; co jest odczytem po odświeżeniu | Integracja: zapis plus osobny odczyt | Asercja tej samej odpowiedzi, którą zwrócił zapis |
| #4 | Niezalogowane żądanie nie dostaje prywatnych danych; zalogowany użytkownik dochodzi do własnego utworu | Przekierowanie jednej strony zamyka też API | Które ścieżki są chronione i jak wygląda sesja | Integracja HTTP | Test tylko strony logowania |
| #5 | Serwer odrzuca zły plik lub złe body i nie ogłasza sukcesu; wpisany tekst zostaje w formularzu | Kontrola rozmiaru w przeglądarce wystarcza | Granica walidacji i to, gdzie żyje tekst formularza | Integracja odrzucenia; osobno stan formularza, jeśli tekst jest tylko w przeglądarce | Test, który ufa walidacji klienta |

## 3. Phased Rollout

Każdy wiersz otwiera własny folder zmiany przez `/10x-new`. Statusy poniżej są literałami parsera.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Runner i granica dostępu | Postawić runner i udowodnić, że cudze wiersze oraz ścieżka bez sesji są zamknięte | #1, #4 | Vitest, integracja | change opened | context/changes/testing-runner-access-boundary/ |
| 2 | Dobór narzędzia na karcie | Udowodnić fallback DAW i pierwszeństwo ulubionej wtyczki, bez budowania brakującego produktu | #2 | integracja | not started | — |
| 3 | Trwałość zapisu | Udowodnić, że zapis przeżywa odświeżenie, a złe wejście nie udaje sukcesu i nie kasuje tekstu | #3, #5 | integracja | not started | — |
| 4 | Bramki jakości | Wpiąć suite z etapów 1–3 do CI obok lint, typecheck, build i smoke | cross-cutting | bramki | not started | — |

## 4. Stack

Baza testów: **none**. Nie ma konfiguracji Vitest, Jest ani Playwright. CI na `master` już uruchamia lint, `astro check`, build i `npm run smoke` przeciw lokalnemu Supabase. Stos produktu: Astro 7 SSR na workerd, React, TypeScript, Supabase. Płatności, realtime i AI są poza zakresem.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | none yet — see §3 Phase 1 | — | Astro docs (checked 2026-10-07) wskazują Vitest przez `getViteConfig`. Testy kontenera komponentów idą w środowisku serwerowym, nie w jsdom. Faza 1 stawia runner. |
| API mocking | none yet — see §3 Phase 1 | — | Izolacja wierszy potrzebuje lokalnego Supabase. Mock własności nie jest sygnałem. |
| e2e | `npm run smoke` | — | Już w CI. Przeglądarkowy e2e nie jest wybraną warstwą dla ryzyk §2. |
| accessibility | eslint-plugin-jsx-a11y | 6.10.2 | Tylko lint. Brak etapu axe; wygląd jest w §7. |
| (optional) AI-native | not recommended — Playwright MCP checked: 2026-10-07 | n/a | Nazwa narzędzia, właściciel wiersza i treść notatki dają się sprawdzić asercją. Warstwa wizyjna nie wchodzi. |

**Stack grounding tools (current session):**
- Docs: Context7 `/withastro/docs` — przewodnik testów Astro: Vitest, `getViteConfig`, `experimental_AstroContainer` w środowisku serwerowym; checked: 2026-10-07
- Search: Exa.ai — not available in current session; WebSearch nieużyty, bo Context7 zwrócił oficjalny przewodnik; checked: 2026-10-07
- Runtime/browser: Playwright MCP i przeglądarka Cursor — dostępne, nieużyte przy odkrywaniu; checked: 2026-10-07
- Provider/platform: brak MCP GitHub, Cloudflare i Supabase w tej sesji; checked: 2026-10-07

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required | dryf składni i typów |
| build | CI | required | zepsuty build serwera |
| smoke | CI on master | required | start aplikacji i obecne asercje skryptu smoke |
| unit + integration | local + CI | required after §3 Phase 1 | regresja granicy dostępu (#1, #4) |
| recipe-tool integration | local + CI | required after §3 Phase 2 | pusta karta, błąd albo zła kolejność wtyczek (#2) |
| persistence integration | local + CI | required after §3 Phase 3 | utrata zapisu i ciche przyjęcie złego wejścia (#3, #5) |
| suite on pull request | CI on PR | required after §3 Phase 4 | regresje z etapów 1–3 przed mergem |

## 6. Cookbook Patterns

Jak dodawać testy w tym projekcie. Podsekcje wypełniają się, gdy etap wdrożenia wyląduje.

### 6.1 Adding a unit test

- Runner: `npm test` uruchamia Vitest przez `getViteConfig` w środowisku `node` (`vitest.config.ts`, `include`: `tests/**/*.test.ts`).
- Granica dostępu nie jest testem jednostki odciętym od sesji. Jej dowód jest integracją w §6.2.

### 6.2 Adding an integration test

Dwa dowody, oba na żywym Supabase i na sesji, nie na mocku. Notatka jest konkretnym ciągiem: w selekcie `rls-note-<stamp>` (przycięty do 200 znaków), w bramkach HTTP `http-note-<stamp>` (tak samo).

- **Selekt drugiego użytkownika.** Właściciel wstawia wiersz i jego `select("id, note")` zawiera ten ciąg. Drugi zalogowany użytkownik robi ten sam `select("id, note")` bez predykatu `user_id`. Jego wynik nie zawiera notatki. To jest trwały dowód polityki: brak wiersza w selekcie sesji B, a nie sam kod HTTP.
- **Bramki HTTP** (`GET`, bez podążania za przekierowaniem):
  - `/dashboard` bez sesji: 302 na `/auth/signin`, a ciało nie zawiera zdania `This page is only for authenticated users.`
  - anonimowe `GET /api/isolation/probes`: 401 z osobnym ciałem `{ error: "unauthorized" }`, bez notatki
  - lista właściciela: 200 i ciało zawiera notatkę
  - lista użytkownika B: 200 i ciało nie zawiera notatki
- `GET /api/isolation/probes/:id` cudzego wiersza zwraca 404 i nie oddaje notatki. Ten 404 nie jest trwałym dowodem polityki: ten sam status da się uzyskać filtrem po `id` albo po `user_id` w handlerze, gdy polityki SELECT już nie ma.
- Czego nie kopiować: mock sprawdzenia własności; sam HTTP 200; samo `ENABLE ROW LEVEL SECURITY`; sam kod 401 bez ciała; sam test strony logowania; traktowanie przekierowania `/dashboard` jako pokrycia `/api/isolation`.

### 6.3 Adding an e2e test

- TBD — żaden etap nie wybiera przeglądarkowego e2e. Istniejące sprawdzenie uruchomionej aplikacji to `npm run smoke`.

### 6.4 Adding a test for recipe tool selection

- TBD — see §3 Phase 2 for the empty-card / native-DAW fallback and favorite-first pattern.

### 6.5 Adding a test for saved work and rejected input

- TBD — see §3 Phase 3 for the note, checklist step, and screenshot surviving refresh, and for rejected input that must not report success or drop typed text.

### 6.6 Per-rollout-phase notes

- Faza 1 (runner i granica dostępu) wysłała dowody z §6.1 i §6.2: `npm test`, selekt `id, note` bez predykatu `user_id` oraz bramki HTTP (dashboard 302 bez zdania dla zalogowanych, anonimowe 401 z ciałem `{ error: "unauthorized" }` bez notatki, lista właściciela 200 z notatką, lista użytkownika B 200 bez notatki).
- `npm run smoke` zostaje istniejącym skryptem end-to-end. Wpięcie suite do CI jest nadal §3 Faza 4.
- Faza 1 nie dodała narzędzia AI-native. Warstwa wizyjna zostaje niezalecana; data sprawdzenia Playwright MCP, 2026-10-07, jest już w §4.

## 7. What We Deliberately Don't Test

- **Strony powitalne i komponenty wyglądu** — snapshoty i przegląd wizyjny łapią szum, nie awarię produktu. Wróć do tej decyzji, gdy zmiana wyglądu zacznie ukrywać to, czy karta nazywa konkretne narzędzie. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-07
- Stack versions last verified: 2026-10-07
- AI-native tool references last verified: 2026-10-07

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
