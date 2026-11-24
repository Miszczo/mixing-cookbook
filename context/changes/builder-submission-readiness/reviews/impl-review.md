<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Builder Submission Readiness

- **Plan**: context/changes/builder-submission-readiness/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-24
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Commity fazy 4 nie są na `master` ani na zdalnym repo

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (git: `chore/delivery-step-0` jest 2 commity przed `origin`)
- **Detail**: PR #1 został zmergowany jako 97ac348 na etapie 4e39b0b. Commity 133a681 (p4) i 6afc6b7 (epilog) istnieją tylko lokalnie. Na `master` plan ma więc nieodhaczone wiersze 4.1–4.9, a `change.md` ma `status: implementing`. Recenzent publicznego repo zobaczy niedomknięty plan. Kryterium 4.7 („dokumenty są na `master`”) jest spełnione tylko częściowo.
- **Fix**: Po triage wypchnąć gałąź i zmergować mały PR #2 (razem z tym raportem) do `master`, a potem sprawdzić, że run na `master` jest zielony.
- **Decision**: FIXED — Phase 4 commits and review fixes pushed in a follow-up PR to master

### F2 — Smoke na produkcji zostawia konta ze stałym hasłem z publicznego repo

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs:8-11, README.md (Deployment), context/foundation/infrastructure.md:128
- **Detail**: Udokumentowane polecenie smoke na produkcji tworzy przy każdym uruchomieniu dwa trwałe konta `smoke-<ts>@mailinator.com`. Hasło `Smoke-Test-Passw0rd!` jest zakodowane na stałe w publicznym repo, a skrzynki Mailinatora są publiczne. Każdy, kto zna repo, może zalogować się na te konta. RLS ogranicza szkody do śmieciowych danych, ale konta zostają i z każdym uruchomieniem jest ich więcej. Według komunikatu 133a681 dotychczasowe konta testowe usunięto, ale kolejne uruchomienia znowu je utworzą.
- **Fix**: Brać hasło z `SMOKE_PASSWORD`, a domyślnie losować je przez `crypto.randomUUID()`. W README i infrastructure.md dopisać krok sprzątania (usunięcie użytkowników `smoke-%` w dashboardzie Supabase).
- **Decision**: FIXED — smoke.mjs reads SMOKE_PASSWORD, random by default; cleanup step in README and infrastructure.md

### F3 — Nieplanowana zmiana `scripts/smoke.mjs` (SMOKE_EMAIL_DOMAIN)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: scripts/smoke.mjs:7-10 (85cfd2b)
- **Detail**: Plik nie występuje w „Changes Required”. Zmiana jest uzasadniona: hostowany Supabase odrzuca `example.com`, a bez niej nie przeszłoby kryterium 2.3. Domyślna wartość `example.com` zostawia CI bez zmian. Zmiana jest opisana w README, infrastructure.md i test-plan §4, ale nie w planie.
- **Fix**: Dopisać do fazy 2 planu krótką notę (addendum) o zmianie w smoke.mjs.
- **Decision**: FIXED — addendum in plan.md Phase 2

### F4 — Lokalny `npm test` nie przeszedł w środowisku przeglądu

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A
- **Detail**: Uruchomienie podczas przeglądu: 14 z 21 plików i 31 ze 154 testów nie przeszło. Błąd to `signin failed with status 302 location /auth/signin`. Z powłoki przeglądu nie dało się połączyć z `127.0.0.1:54321`, mimo że kontenery Supabase raportują `healthy`. Wygląda to na problem środowiska (sieć sandboksa lub Dockera albo limit `sign_in_sign_ups = 30` na 5 minut), a nie kodu: run CI 45430553554 na `master` wykonał `npm test` na zielono. Lint i `astro check` przechodzą (0 błędów).
- **Fix**: Uruchomić lokalnie `npx supabase stop && npx supabase start`, a potem `npm test`, i potwierdzić wynik.
- **Decision**: SKIPPED

### F5 — Cytowania CRUD w README są nieprecyzyjne dla przepisów i notatek

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: README.md (Builder requirements → CRUD)
- **Detail**: `src/pages/api/recipes/[id].ts` obsługuje tylko usuwanie, a przepisy nie mają edycji, więc pokrycie to create/read/delete. Notatki tworzy POST do `src/pages/tracks/[id].astro:57`, a `[noteId].ts` obsługuje tylko usuwanie. Wymóg Builder jest spełniony przez pluginy (pełny CRUD), ale recenzent może sprawdzić cytowania.
- **Fix**: Doprecyzować w README: pełny CRUD to pluginy; przepisy i notatki to create/read/delete, z poprawną ścieżką tworzenia notatek.
- **Decision**: FIXED — README CRUD row lists the operations per entity and the notes create path

### F6 — Otwarta rejestracja bez potwierdzenia e-mail i bez CAPTCHA

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/foundation/infrastructure.md:125
- **Detail**: Plan świadomie wyłączył potwierdzanie e-mail. Skutek: każdy może zakładać dowolną liczbę kont na cudze adresy. Chroni tylko limit per IP Supabase. Endpointy `/api/isolation/*` są dostępne na produkcji, ale wymagają logowania, a pole `note` walidują przez zod (max 200 znaków). To akceptowalne dla MVP, ale ryzyko nie jest nigdzie zapisane.
- **Fix**: Dopisać ryzyko do rejestru ryzyk w infrastructure.md: włączyć Turnstile lub CAPTCHA w Supabase Auth po zamknięciu Buildera.
- **Decision**: FIXED — known-risk note in infrastructure.md Deployed section

### F7 — Strona po rejestracji zależy od wyłączonego potwierdzania

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/auth/confirm-email.astro:4-10
- **Detail**: Strona zawsze pokazuje „Registration successful… You can now sign in”. Przy wyłączonym potwierdzaniu `signUp` już ustawia sesję, więc prośba o logowanie jest zbędna. Jeśli potwierdzanie zostanie ponownie włączone, strona wprowadzi użytkownika w błąd. Zależność opisuje tylko komentarz w kodzie. Strona jest spójna wizualnie z signin i signup.
- **Fix**: Brak zmiany teraz. Przy ponownym włączeniu potwierdzania przywrócić gałąź „Check your email”. Notę o tej zależności dopisać w infrastructure.md razem z F6.
- **Decision**: FIXED — coupling note in infrastructure.md Deployed section

### F8 — `signup.ts` łamie regułę AGENTS.md dla API (wcześniejszy problem)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/auth/signup.ts:5-7
- **Detail**: Problem istniał przed tą zmianą. Endpoint, który jest teraz publicznie otwarty, czyta `email` i `password` przez `as string`, bez walidacji zod, i nie eksportuje `prerender = false`. AGENTS.md wymaga obu rzeczy.
- **Fix**: Dodać schemat zod i `export const prerender = false`, wzorując się na innych endpointach API, jako osobny follow-up.
- **Decision**: SKIPPED
