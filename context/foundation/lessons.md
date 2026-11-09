# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Rób tylko to, o co poproszono, i zatrzymaj się przed kolejnym skillem

- **Context**: Każda sesja prowadzona według roadmapy lub listy kroków, zwłaszcza gdy po zakończeniu jednego skilla następny wydaje się oczywisty (np. `/10x-archive`, a potem `/10x-new` i `/10x-plan`).
- **Problem**: 2026-11-01 użytkownik zlecił archiwizację, a potem push, sprawdzenie szkicu z PRD i pobranie atrapy PNG. Agent potraktował odpowiedzi na swoją listę potrzeb do S-04 jako zgodę na start i przeszedł przez `/10x-new`, `/10x-plan`, `/10x-plan-review`, `/10x-tdd` i `/10x-implement` aż do fazy 3. Zgodę „nie czekaj przesadnie”, daną przy archiwizacji, rozciągnął na całą pracę i pominął pytania wymagane przez skille: triage przeglądu planu, tryb realizacji i zatwierdzanie commitów. Powstały 2 commity, niezacommitowana faza 3 i migracja w lokalnej bazie, a użytkownik musiał przerwać pracę i teraz decyduje, czy je cofnąć.
- **Rule**: Wykonuj tylko to, o co użytkownik wyraźnie poprosił, i po skończeniu zatrzymaj się, zanim uruchomisz kolejny skill. Odpowiedź na pytanie o potrzeby nie jest zgodą na start, a przyspieszenie przyznane dla jednego zadania nie obejmuje innych i nie znosi pytań wymaganych przez skille.
- **Applies to**: all

## Najpierw ustal, które repo to projekt, a dopiero potem szukaj w nim `context/`

- **Context**: Początek każdej sesji i każde wywołanie skilli 10x (`/10x-new`, `/10x-plan` itd.), gdy katalog roboczy to `D:\www`, a użytkownik mówi o projekcie po nazwie (np. „mixing cookbook").
- **Problem**: 2026-11-03 `/10x-new` uruchomione w `D:\www` nie znalazło `context/changes/`. Agent zgadł `mixing-cookbook-private`, który ma `.git`, ale nie ma `context/`, i wrócił z błędem. Projekt „mixing cookbook" to w rzeczywistości `D:\www\10xdevs4`: tam są `context/`, kod przepisów i archiwum zmian o DAW, torach i sidechainie. Nazwa folderu nie pasuje do nazwy projektu.
- **Rule**: Gdy nazwa projektu nie wskazuje jednoznacznie folderu, nie zgaduj z nazwy. Sprawdź `find D:/www -maxdepth 3 -name changes -path "*context*"` oraz `git log --since=<dziś>` w repozytoriach, a dopiero potem uruchom skill w tym repo. Mapa: „mixing cookbook" = `D:\www\10xdevs4`, zmiany w `context/changes/`, lekcje w `context/foundation/lessons.md`. `mixing-cookbook-private` to inny, pomocniczy folder bez `context/`.
- **Applies to**: all
