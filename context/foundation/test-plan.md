# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8). Odświeżone ręcznie 2026-11-24 (statusy, §4, §5, §6.4–§6.6, §8).
>
> Last updated: 2026-11-24

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
| 1 | Runner i granica dostępu | Postawić runner i udowodnić, że cudze wiersze oraz ścieżka bez sesji są zamknięte | #1, #4 | Vitest, integracja | complete | context/archive/2026-10-07-testing-runner-access-boundary/ |
| 2 | Dobór narzędzia na karcie | Udowodnić fallback DAW i pierwszeństwo ulubionej wtyczki, bez budowania brakującego produktu | #2 | integracja | complete | context/archive/2026-11-01-in-track-sidechain-card/ |
| 3 | Trwałość zapisu | Udowodnić, że zapis przeżywa odświeżenie, a złe wejście nie udaje sukcesu i nie kasuje tekstu | #3, #5 | integracja | complete | context/archive/2026-11-03-author-recipe-with-screenshot/, context/archive/2026-11-09-track-listening-notes/ |
| 4 | Bramki jakości | Wpiąć suite z etapów 1–3 do CI obok lint, typecheck, build i smoke | cross-cutting | bramki | complete | context/changes/builder-submission-readiness/ |

Etapy 2 i 3 nie miały własnych folderów zmiany `testing-*`. Ich testy wylądowały razem ze slice'ami produktu, których foldery są w ostatniej kolumnie. Etap 4 to wpięcie `npm test` do zadania `smoke` w `.github/workflows/ci.yml`, zrobione w zmianie `builder-submission-readiness`.

### Pokrycie ryzyk testami

Stan na 2026-11-24. Pliki są w `tests/`. Ostatnia kolumna mówi wprost, gdzie dowodu nie ma.

| # | Pliki testów | Co sprawdzają | Czego nie łapią |
|---|--------------|---------------|-----------------|
| 1 | `isolation-probes-rls.test.ts`, `primary-daw-rls.test.ts`, `recipes-rls.test.ts`, `recipe-progress-rls.test.ts`, `listening-notes-rls.test.ts` (selekt i zapis drugiego użytkownika na żywym Supabase); `isolation-access-http.test.ts`, `plugins-tracks-http.test.ts`, `listening-notes-http.test.ts`, `listening-notes-overview-http.test.ts`, `recipe-card-http.test.ts`, `recipes-http.test.ts`, `recipes-in-track-http.test.ts` (cudzy odczyt i zapis kończą się 404, ciało nie zawiera treści właściciela); `recipes-search-http.test.ts`, `primary-daw-http.test.ts` (drugi użytkownik nie widzi treści właściciela) | Drugi użytkownik nie widzi wierszy właściciela na poziomie polityk i na poziomie HTTP, a cudze zapisy są odrzucone | Tabele `plugins` i `tracks` nie mają osobnego testu RLS. Ich izolację dowodzą tylko testy HTTP, a 404 może pochodzić z filtra w handlerze (patrz §6.2) |
| 2 | `recipe-tool-selection.test.ts` (reguła `selectTool`); `recipe-card-http.test.ts` (karta na stronie utworu) | Bez wtyczek karta nazywa natywne narzędzie DAW (np. ReaComp dla REAPER) albo ogólne „natywny kompresor Twojego DAW"; ulubiona wtyczka jest przed wcześniejszą alfabetycznie; każda wtyczka jest przed natywnym narzędziem; usunięcie wybranej wtyczki wraca do automatu | Nazwy narzędzi natywnych sprawdzono dla DAW użytych w testach, nie dla wszystkich |
| 3 | `recipe-card-http.test.ts` (odhaczony krok i wybrane narzędzie po świeżych odczytach); `listening-notes-http.test.ts` (notatka na liście po osobnym GET, od najnowszej); `recipes-http.test.ts` (wgrany obraz wraca bajt w bajt z trasy właściciela); `recipes-in-track-http.test.ts` | Dane zapisane jednym żądaniem są czytane innym żądaniem z tą samą sesją | Brak testu w prawdziwej przeglądarce. „Odświeżenie" to świeży odczyt HTTP, nie przeładowanie strony |
| 4 | `isolation-access-http.test.ts` (`/dashboard` 302, probes 401); `plugins-tracks-http.test.ts` (`/plugins`, `/tracks` 302, POST 401); `primary-daw-http.test.ts`; `listening-notes-overview-http.test.ts` (`/notes` 302); `recipe-card-http.test.ts` (anonimowy POST 401); `recipes-http.test.ts` (obraz 401 bez sesji) | Niezalogowane żądanie nie dostaje danych ani nie zapisuje; zalogowany właściciel dochodzi do własnego utworu (`plugins-tracks-http`, `listening-notes-http`) | Strona `/recipes` bez sesji nie ma własnej asercji przekierowania. Chroni ją `PROTECTED_ROUTES`, a test sprawdza tylko anonimowy odczyt obrazu |
| 5 | `recipes-http.test.ts` (413 dla pliku ponad 1 MB, 400 dla tekstu udającego PNG, 400 bez obrazu i kroków; w odpowiedzi zostaje wpisany tekst); `listening-notes-http.test.ts` (400, zachowany tekst, nic nie zapisane); `recipe-input.test.ts`, `listening-notes.test.ts` (schematy zod i granice); `recipes-rls.test.ts`, `listening-notes-rls.test.ts` (ograniczenia CHECK w bazie); `recipe-card-http.test.ts` (zły krok, narzędzie lub cudza wtyczka nic nie zapisują) | Serwer odrzuca zły plik i złe body, nie raportuje sukcesu, a formularz oddaje wpisany tekst | Zachowanie tekstu jest sprawdzone dla formularzy przepisu i notatki. Formularze wtyczek i utworów sprawdzają odrzucenie (303), ale nie to, czy tekst zostaje. Wklejanie obrazu w przeglądarce ma tylko test logiki (`recipe-image-paste.test.ts`) |

Pliki bez własnego ryzyka z §2 (czysta logika): `recipe-search.test.ts`, `recipe-checklist-markdown.test.ts`, `listening-note-template.test.ts`.

## 4. Stack

Baza testów: **Vitest 4.1.0**, 21 plików w `tests/`, uruchamianych przez `npm test`. Brak Playwright. CI na `master` i na pull requestach uruchamia lint, `astro check` i build, a w zadaniu `smoke` także `npm test` i `npm run smoke` przeciw lokalnemu Supabase. Stos produktu: Astro 7 SSR na workerd, React, TypeScript, Supabase. Płatności, realtime i AI są poza zakresem.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest (`npm test`) | 4.1.0 | Konfiguracja przez `getViteConfig` w `vitest.config.ts`, środowisko `node`, `fileParallelism: false`. Testy HTTP startują własny serwer `astro dev` (`tests/helpers/http-app.ts`) i potrzebują lokalnego Supabase. |
| API mocking | none, celowo | — | Izolacja wierszy i reguły zapisu idą na lokalnym Supabase. Mock własności nie jest sygnałem. |
| e2e | `npm run smoke` (`scripts/smoke.mjs`) | — | W CI przeciw podglądowi builda. Na produkcji: `SMOKE_EMAIL_DOMAIN=mailinator.com BASE_URL=<adres> npm run smoke`. Przeglądarkowy e2e nie jest wybraną warstwą dla ryzyk §2. |
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
| unit + integration | local + CI (zadanie `smoke`) | required (§3 Phase 1, shipped) | regresja granicy dostępu (#1, #4) |
| recipe-tool integration | local + CI (zadanie `smoke`) | required (§3 Phase 2, shipped) | pusta karta, błąd albo zła kolejność wtyczek (#2) |
| persistence integration | local + CI (zadanie `smoke`) | required (§3 Phase 3, shipped) | utrata zapisu i ciche przyjęcie złego wejścia (#3, #5) |
| suite on pull request | CI on PR (`pull_request` na `master`) | required (§3 Phase 4, shipped) | regresje z etapów 1–3 przed mergem |

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
  - anonimowe `GET /api/isolation/probes`: 401, a ciało nie zawiera notatki
  - lista właściciela: 200 i ciało zawiera notatkę
  - lista użytkownika B: 200 i ciało nie zawiera notatki
- `GET /api/isolation/probes/:id` cudzego wiersza zwraca 404 i nie oddaje notatki. Ten 404 nie jest trwałym dowodem polityki: ten sam status da się uzyskać filtrem po `id` albo po `user_id` w handlerze, gdy polityki SELECT już nie ma.
- Czego nie kopiować: mock sprawdzenia własności; sam HTTP 200; samo `ENABLE ROW LEVEL SECURITY`; sam kod 401 bez ciała; sam test strony logowania; traktowanie przekierowania `/dashboard` jako pokrycia `/api/isolation`.

### 6.3 Adding an e2e test

- Brak — żaden etap nie wybiera przeglądarkowego e2e. Istniejące sprawdzenie uruchomionej aplikacji to `npm run smoke`.

### 6.4 Adding a test for recipe tool selection

Dwa poziomy, oba w `tests/`.

- **Reguła** (`recipe-tool-selection.test.ts`): czysta funkcja `selectTool` z `src/lib/recipes.ts`. Sprawdza pierwszeństwo: ulubiona wtyczka, potem inna zgodna wtyczka (remis nazw rozstrzyga `id`), potem natywne narzędzie. Sprawdza też ogólną nazwę natywną bez DAW i zignorowanie wybranej wtyczki, której już nie ma albo która nie pasuje do typu.
- **Karta na stronie** (`recipe-card-http.test.ts`): zalogowany użytkownik na utworze w etapie Miks. Bez wtyczek karta nazywa narzędzie DAW (`ReaComp` dla REAPER) albo „natywny kompresor Twojego DAW" bez ustawionego DAW. Z dwiema wtyczkami ulubiona jest pierwsza. Oczekiwane nazwy są wpisane w teście, nie liczone funkcją doboru.
- Czego nie kopiować: oczekiwanej nazwy wyliczonej tą samą funkcją; testu samej ulubionej wtyczki; pustej karty z kodem 200 uznanej za sukces.

### 6.5 Adding a test for saved work and rejected input

- **Zapis i osobny odczyt**: zapis żądaniem POST, potem świeży GET z tą samą sesją. Krok i narzędzie: `recipe-card-http.test.ts`. Notatka: `listening-notes-http.test.ts`. Obraz: `recipes-http.test.ts` (bajty z trasy `/api/recipes/:id/image` są równe wgranym; cudzy odczyt 404, anonimowy 401).
- **Odrzucone wejście**: serwer zwraca kod błędu (400, 413) albo przekierowanie z `error=`, nic się nie zapisuje, a odpowiedź z błędem zawiera wpisany tekst (`recipes-http.test.ts`, `listening-notes-http.test.ts`). Granice pól: `recipe-input.test.ts`, `listening-notes.test.ts`. Granice w bazie: `recipes-rls.test.ts`, `listening-notes-rls.test.ts`.
- Czego nie kopiować: asercji odpowiedzi, którą zwrócił sam zapis; sprawdzania tylko limitu w przeglądarce.

### 6.6 Per-rollout-phase notes

- Faza 1 (runner i granica dostępu) wysłała dowody z §6.1 i §6.2: `npm test`, selekt `id, note` bez predykatu `user_id` oraz bramki HTTP (dashboard 302 bez zdania dla zalogowanych, anonimowe 401 bez notatki, lista właściciela 200 z notatką, lista użytkownika B 200 bez notatki).
- Fazy 2 i 3 wylądowały razem ze slice'ami S-04, S-05 i S-07 (foldery w archiwum, patrz §3). Dowody opisują §6.4 i §6.5, a mapa plików do ryzyk jest w §3.
- Tabele `primary-daw`, `recipes`, `recipe-progress` i `listening-notes` mają test `*-rls.test.ts`. Wyjątek to `plugins` i `tracks` (patrz tabela w §3).
- Faza 4: zadanie `smoke` w `.github/workflows/ci.yml` uruchamia `npm test`, build i `npm run smoke` na pushu do `master` i na pull requestach. Supabase w CI jest lokalny.
- Nie dodano narzędzia AI-native ani przeglądarkowego e2e. Warstwa wizyjna zostaje niezalecana.

## 7. What We Deliberately Don't Test

- **Strony powitalne i komponenty wyglądu** — snapshoty i przegląd wizyjny łapią szum, nie awarię produktu. Wróć do tej decyzji, gdy zmiana wyglądu zacznie ukrywać to, czy karta nazywa konkretne narzędzie. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§2) last reviewed: 2026-10-07 (bez zmian przy odświeżeniu)
- Statuses, stack, gates and cookbook (§3–§6) refreshed by hand: 2026-11-24
- Stack versions last verified: 2026-11-24 (Vitest 4.1.0 z `package.json`)
- AI-native tool references last verified: 2026-10-07

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
