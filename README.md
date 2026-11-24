# Mixing Cookbook

A personal cookbook for solo music producers. You pick a mixing intent, such as "Sidechain stopy z basem", and get one concrete action: a checklist, a settings screenshot, and a suggested tool. The tool is your favorite matching plugin, or your DAW's native tool when you own no match.

Product requirements: [`context/foundation/prd.md`](context/foundation/prd.md). Delivery status: [`context/foundation/roadmap.md`](context/foundation/roadmap.md).

## Live app

https://mixing-cookbook.mcglowack.workers.dev

Sign up with a real email address and a password (hosted Supabase rejects some test domains such as example.com). Email confirmation is off, so you can use the app right after sign-up.

## Features

- Sign up, sign in, and sign out with Supabase Auth.
- Choose a primary DAW in the dashboard.
- Keep a plugin inventory with a name, a type, and favorites.
- Create and edit tracks with a stage: Aranż, Miks, or Master.
- Open a recipe card inside a Miks track: a step checklist, a settings screenshot, and a suggested tool. The tool is your favorite matching plugin, another matching plugin, or the native tool of your DAW.
- Mark steps as done and choose a different tool. Progress is saved per track.
- Write your own recipes with an uploaded or pasted screenshot, and search recipes by intent.
- Copy a recipe checklist as Markdown.
- Add listening notes to a track, insert a note template, and filter all notes by reference equipment.

## Tech stack

Astro 7 (server output), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Supabase (auth, Postgres with row-level security), and Cloudflare Workers.

## Local setup

Requires Node.js 22.14.0 (`.nvmrc`) and Docker.

```bash
npm install
cp .env.example .env
npx supabase start
```

Copy the API URL and anon key printed by the CLI into `.env`, then copy the file for the Workers runtime:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key>
```

```bash
cp .env .dev.vars
npm run dev
```

Migrations in `supabase/migrations/` apply on `supabase start`. After pulling a new one, run `npx supabase db reset`. Studio runs at `http://localhost:54323`.

## Scripts

- `npm run dev`: start the development server on the workerd runtime
- `npm run build`, `npm run preview`: build and preview production output
- `npm run lint`, `npx astro check`: lint and type check
- `npm test`: run Vitest integration tests (needs local Supabase)
- `npm run smoke`: run the HTTP smoke test against a running server (`BASE_URL`, default `http://localhost:4321`)

## Project layout

```
src/pages/        pages and API routes (src/pages/api)
src/components/   Astro and React components
src/lib/          services and Supabase client
src/middleware.ts session lookup and PROTECTED_ROUTES
supabase/         config and SQL migrations with RLS
tests/            Vitest integration tests
scripts/          smoke test
context/          PRD, roadmap, test plan, plans, and reviews for each change
```

## Builder requirements

Where each requirement of the builder submission is met.

| Requirement       | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Access control    | Supabase sign-in: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`, `src/pages/auth/`. `PROTECTED_ROUTES` in `src/middleware.ts` redirects `/dashboard`, `/plugins`, `/tracks`, `/notes`, and `/recipes` to sign-in. Row-level security on every table: `supabase/migrations/`. Tests: `tests/isolation-access-http.test.ts`, `tests/isolation-probes-rls.test.ts`, and `tests/*-rls.test.ts`.                                                                                                                                                                                                                                                                               |
| CRUD              | Full CRUD (create, list, update, delete): plugins, `src/pages/api/plugins/index.ts`, `src/pages/api/plugins/[id].ts`, page `/plugins`. Tracks: `src/pages/api/tracks/index.ts`, `src/pages/api/tracks/[id].ts`, pages `/tracks` and `/tracks/[id]`. Recipes (create, read, delete; no edit): create in `src/pages/recipes/new.astro`, delete in `src/pages/api/recipes/[id].ts`. Listening notes (create, read, delete): create on the track page `src/pages/tracks/[id].astro`, delete in `src/pages/api/tracks/[id]/notes/[noteId].ts`.                                                                                                                                                  |
| Business logic    | `selectTool` in `src/lib/recipes.ts` picks the tool for a recipe card. A favorite plugin comes first, then any matching plugin, then the native tool of the user's DAW. Test: `tests/recipe-tool-selection.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Context documents | [`context/foundation/prd.md`](context/foundation/prd.md), [`roadmap.md`](context/foundation/roadmap.md), [`test-plan.md`](context/foundation/test-plan.md), [`infrastructure.md`](context/foundation/infrastructure.md), and [`AGENTS.md`](AGENTS.md). Plans and reviews for each change are in `context/changes/` and `context/archive/`.                                                                                                                                                                                                                                                                                                                                                 |
| Tests per risk    | [`test-plan.md`](context/foundation/test-plan.md) §2 lists five risks. Section §3 maps each to test files: #1 data of another user, `tests/*-rls.test.ts` and `tests/isolation-access-http.test.ts`; #2 empty or wrongly ordered tool card, `tests/recipe-tool-selection.test.ts` and `tests/recipe-card-http.test.ts`; #3 lost saved work, `tests/recipe-card-http.test.ts`, `tests/listening-notes-http.test.ts`, and `tests/recipes-http.test.ts`; #4 private routes without a session, `tests/plugins-tracks-http.test.ts` and `tests/isolation-access-http.test.ts`; #5 bad input accepted or typed text lost, `tests/recipes-http.test.ts` and `tests/listening-notes-http.test.ts`. |
| Deployment        | Cloudflare Workers at the address above; steps in Deployment below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CI                | `.github/workflows/ci.yml`: the `ci` job runs lint, `astro check`, and build. The `smoke` job starts local Supabase, runs `npm test`, builds, and runs `npm run smoke` against the preview. Both run on pushes to `master` and on pull requests.                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Deployment

The app runs on Cloudflare Workers with Supabase Cloud (project in eu-west-2) as the backend.

Supabase Cloud:

1. Create a project and link it: `npx supabase link --project-ref <ref>`.
2. Apply the migrations: `npx supabase db push`.
3. In Auth, open Email and turn "Confirm email" off. The built-in Supabase mail reaches only organization members, so sign-up would stall for everyone else.
4. In Auth, set Site URL to the workers.dev address.

Worker:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
npm run build && npx wrangler deploy
```

`SUPABASE_KEY` is the anon key only. Never use the service role key. Deploy with `wrangler deploy`, never `wrangler pages deploy`: the adapter targets Workers.

Smoke test against production. Hosted Supabase rejects `example.com`, so pass another domain:

```bash
SMOKE_EMAIL_DOMAIN=mailinator.com BASE_URL=https://mixing-cookbook.mcglowack.workers.dev npm run smoke
```

The password is random unless you set `SMOKE_PASSWORD`. Each run leaves two `smoke-*` accounts; delete them afterwards in Supabase → Authentication → Users (filter `smoke-`).

Deployment notes and platform research: [`context/foundation/infrastructure.md`](context/foundation/infrastructure.md).

## License

MIT for the code written in this project; see [LICENSE](LICENSE). The project was bootstrapped from [10x-astro-starter](https://github.com/przeprogramowani/10x-astro-starter), which does not declare a license, so the MIT grant does not extend to code taken from that starter.
