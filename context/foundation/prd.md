---
project: "Sound Intent & Mixing Cookbook CMS"
version: 1
status: draft
created: 2026-09-20
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-11-04
  after_hours_only: true
---

## Vision & Problem Statement

Solo producent pracujący nad własnym utworem musi odnaleźć się w morzu własnych pluginów oraz narzędzi dostępnych w DAW. W trakcie pracy często wie, że ma odpowiednie narzędzie, ale nie pamięta szybko, którego pluginu użyć, co on dokładnie robi i jak zastosować go w konkretnej sytuacji miksowej.

Koszt dzisiaj to dodatkowe minuty spędzane na sprawdzaniu zainstalowanych pluginów, przypominaniu sobie technik miksu i odtwarzaniu ustawień, np. co usunąć w basie albo jak ustawić kompresor w sidechainie, żeby bas poprawnie pompował stopę. Przepis miksowy powinien być kontekstowy: połączenie intencji, posiadanych pluginów i fallbacku na natywne narzędzia DAW daje producentowi gotową akcję zamiast kolejnej listy notatek. Przy większej skali reguła doboru pozostaje osobista i oparta o profil danego użytkownika; dane społecznościowe i rankingi popularności pluginów nie wchodzą do MVP.

## User & Persona

Primary persona: solo producent pracujący nad własnymi utworami.

Kontekst: podczas sesji produkcji lub miksu producent chce szybko wrócić do konkretnej techniki, dobrać dostępny plugin albo natywny odpowiednik DAW, wykonać checklistę i zapisać postęp pracy nad utworem. Wspierającym kontekstem jest worklog: etapy takie jak aranż, miks czy perkusja oraz notatki z odsłuchów na konkretnych słuchawkach, kolumnach albo w samochodzie.

## Success Criteria

### Primary

- Zalogowany użytkownik przechodzi od dashboardu z ustawionym DAW i listą pluginów do utworu w statusie "Miks", wybiera intencję "Sidechain stopy z basem" i otrzymuje kartę przepisu z checklistą, zrzutem ekranu oraz właściwą propozycją pluginu.
- Jeśli użytkownik ma pasujący kompresor VST, aplikacja informuje o możliwości wyboru i pozwala potraktować ulubiony plugin jako preferowany; jeśli go nie ma, aplikacja podstawia natywny kompresor DAW.
- Po wykonaniu miksu użytkownik zapisuje w tym samym utworze notatkę odsłuchową z urządzeniem odsłuchowym i statusem.

### Secondary

- W oknie workloga użytkownik może jednym kliknięciem wstawić szablon notatki odsłuchowej:
  ```text
  [Sub / Dół]:
  [Środek / Wokale]:
  [Góra / Stereofonia]:
  [Do poprawy]:
  ```

### Guardrails

- Jeśli profil użytkownika nie ma przypisanej żadnej wtyczki VST albo jest pusty, aplikacja zawsze zwraca natywne narzędzie z DAW; nie pokazuje pustej karty i nie kończy przepływu błędem typu null/undefined.
- Wpisy z odsłuchów, wybrane urządzenia i załączone zrzuty ekranu przetrwają odświeżenie sesji/strony oraz pozostaną widoczne wyłącznie dla zalogowanego autora.

## User Stories

### US-01: User gets a sidechain recipe inside a track and records a listening note

- **Given** a logged-in producer has a selected DAW in their profile, a cataloged list of owned VST plugins or a profile without a dedicated compressor VST, and an existing track "Track A" in the "Miks" stage
- **When** they open "Track A", click "Potrzebuję przepisu", choose the intent "Sidechain stopy z basem", complete the task, and add a listening note in the worklog
- **Then** the system displays a recipe card with an automatically selected plugin, a checklist of steps, and a screenshot of settings, and the user can mark steps as completed and persist a worklog entry with reference equipment and sound notes

#### Acceptance Criteria

- Missing matching VST plugin results in a native DAW fallback, not an empty recipe card.
- A matching favorite plugin appears before other compatible plugins.
- Completed checklist steps can be marked from the recipe card in the track context.
- The listening note remains attached to the track after the page or session is refreshed.

## Functional Requirements

### Access and User Profile

- FR-001: User can register, log in, and safely log out. Priority: must-have
  > Socratic: Counter-argument considered: "Without an account, privacy and data isolation are too weak." Resolution: kept; auth is required because user data is private.
- FR-002: User can choose a primary DAW in their profile so the product can use that DAW's native tool set as the default reference. Priority: must-have
  > Socratic: Counter-argument considered: "DAW choice is necessary because native fallback has no meaning without it." Resolution: kept.

### Plugin Inventory

- FR-003: User can add, edit, and delete owned or installed plugins with at least a name and category/type such as Compressor, EQ, or Reverb. Priority: must-have
  > Socratic: Counter-argument considered: "Manual plugin cataloging can be the biggest friction before the user gets value." Resolution: kept, but constrained to minimal fields needed for matching.
- FR-004: User can mark specific plugins as favorites so they get priority during plugin matching. Priority: must-have
  > Socratic: Counter-argument considered: "Favorites are needed because otherwise the system may recommend tools the user does not want to use." Resolution: kept.

### Cookbook Engine

- FR-005: User can search and filter starter recipes and own recipes by intent, such as "Sidechain stopy z basem" or "Czyszczenie dołu w wokalu". Priority: must-have
  > Socratic: Counter-argument considered: "Intent is the main entry point, so search/filter is core." Resolution: kept.
- FR-006: User can create a recipe with an intent, required plugin type, and checklist of steps. Priority: must-have
  > Socratic: Counter-argument considered: "Own recipes are necessary because the product organizes personal techniques." Resolution: kept.
- FR-007: User can upload an image file as a screenshot for a recipe. Priority: must-have
  > Socratic: Counter-argument considered: "Screenshot settings are key because the user wants to quickly reproduce knob settings." Resolution: kept.
- FR-008: System can automatically present a native DAW tool, such as a native compressor, for supported recipe plugin types when the user does not have a matching VST plugin in their profile. Priority: must-have
  > Socratic: Counter-argument considered: "Mapping plugin types to native tools can be brittle if it covers too many categories." Resolution: narrowed to supported recipe plugin types in the MVP.
- FR-009: User can see compatible plugins from their inventory and manually replace the suggested tool, with favorite plugins prioritized. Priority: must-have
  > Socratic: Counter-argument considered: "The user needs control because the suggestion may not match the current session." Resolution: kept.

### Tracks and Listening Worklog

- FR-010: User can create and edit tracks with a name and stage status such as Aranż, Miks, or Master. Priority: must-have
  > Socratic: Counter-argument considered: "BPM and genre can wait; name and status are enough for MVP." Resolution: narrowed to name and stage status.
- FR-011: User can choose a recipe from inside a track, see an instruction card, and mark recipe steps as completed. Priority: must-have
  > Socratic: Counter-argument considered: "This is the main moment of value inside a track." Resolution: kept.
- FR-012: User can add a listening note to a track with reference equipment, such as headphones, car audio, or speakers, and sound notes. Priority: must-have
  > Socratic: Counter-argument considered: "Worklog is needed as support for real track work." Resolution: kept.
- FR-013: User can view a chronological list of listening notes assigned to a track. Priority: must-have
  > Socratic: Counter-argument considered: "Without history, the worklog loses its value as progress tracking." Resolution: kept.

### Nice-to-Have Additions

- FR-014: User can copy a recipe checklist to the clipboard in Markdown format with one click. Priority: nice-to-have
  > Socratic: Counter-argument considered: "This is a good nice-to-have, but should not block MVP." Resolution: kept as nice-to-have.
- FR-015: User can insert a listening note template into the worklog text field. Priority: nice-to-have
  > Socratic: Counter-argument considered: "The template improves note quality and repeatable listening." Resolution: kept as nice-to-have.
- FR-016: User can paste screenshots directly from the clipboard into the recipe form. Priority: nice-to-have
  > Socratic: Counter-argument considered: "Clipboard paste complicates image handling; file upload is enough for MVP." Resolution: kept as nice-to-have.
- FR-017: User can filter listening notes across all tracks by reference equipment. Priority: nice-to-have
  > Socratic: Counter-argument considered: "Global filtering by equipment is useful only once there are more tracks and notes." Resolution: kept as nice-to-have.
- FR-018: User can see a percentage progress indicator for a track based on completed stages or steps. Priority: nice-to-have
  > Socratic: Counter-argument considered: "A percentage can create false precision in creative work." Resolution: kept as nice-to-have, not part of MVP.

## Non-Functional Requirements

- Widoki utworu, zmiana statusu oraz wygenerowanie karty przepisu z regułą fallbacku odpowiadają użytkownikowi w czasie poniżej 1 sekundy.
- Po kliknięciu "Zapisz" notatka odsłuchowa, odznaczony krok checklisty i wgrany zrzut ekranu pozostają dostępne po zamknięciu przeglądarki, przypadkowym odświeżeniu strony lub wygaszeniu ekranu urządzenia.
- Zalogowany użytkownik widzi wyłącznie swój profil DAW, własne wtyczki, prywatne zrzuty ekranu oraz historię odsłuchów; żaden inny użytkownik nie ma dostępu do jego danych.
- Interfejs pozostaje użyteczny na komputerze podczas edycji przepisów i zarządzania wtyczkami oraz na telefonie lub tablecie podczas dodawania notatek w worklogu, np. podczas odsłuchu w samochodzie.
- Przy błędzie, takim jak zbyt duży plik graficzny lub chwilowy brak sieci, aplikacja pokazuje zrozumiały komunikat i nie traci tekstu wpisanego przez użytkownika w formularzu.

## Business Logic

Gdy wybrany przepis wymaga konkretnego typu narzędzia, aplikacja dynamicznie dobiera do niego wtyczkę z priorytetowej listy użytkownika, a w przypadku jej braku automatycznie wyznacza i konfiguruje natywny odpowiednik ze wskazanego DAW-a.

Reguła bierze pod uwagę profil DAW użytkownika, jego spersonalizowaną bazę zainstalowanych wtyczek VST, flagę ulubionych oraz wymagany typ narzędzia zdefiniowany w wybranym przepisie miksowym.

Wynikiem działania reguły jest dynamicznie wygenerowana karta przepisu, w której system wskazuje konkretne rekomendowane narzędzie: priorytetowo ulubioną wtyczkę VST użytkownika, a w przypadku jej braku natywny odpowiednik z jego DAW-a.

Użytkownik napotyka tę regułę, gdy otwiera konkretny utwór, klika "Potrzebuję przepisu" i wybiera z listy interesującą go intencję miksową.

## Access Control

Użytkownik loguje się do aplikacji, aby mieć dostęp do swoich prywatnych przepisów, pluginów, worklogów i notatek odsłuchowych.

Model dostępu w MVP jest płaski: każdy zalogowany użytkownik jest zwykłym użytkownikiem i widzi wyłącznie swoje dane. Pierwsza wersja nie zakłada ról takich jak admin, member czy guest.

## Non-Goals

- MVP nie buduje marketplace'u, ocen, komentarzy ani publicznego udostępniania przepisów; produkt pozostaje osobistym narzędziem pracy.
- MVP nie generuje plików presetów DAW/VST, takich jak `.vstpreset` albo `.adv`; przepis pozostaje instrukcją i checklistą, nie eksportem ustawień.
- MVP nie tworzy wtyczki ani integracji działającej bezpośrednio wewnątrz DAW, M4L ani automatyzacji parametrów; DAW jest używany tylko jako kontekst mapowania narzędzi natywnych.
- MVP nie wykorzystuje społecznościowego rankingu popularnych pluginów ani rekomendacji opartych o dane innych użytkowników; dobór pluginu pozostaje per-user.

## Open Questions

No open questions.
