# Mixing Cookbook

A personal cookbook for solo music producers. You pick a mixing intent, such as "Sidechain stopy z basem", and get one concrete action: a checklist, a settings screenshot, and a suggested tool. The tool is your favorite matching plugin, or your DAW's native tool when you own no match.

Product requirements: [`context/foundation/prd.md`](context/foundation/prd.md). Delivery status: [`context/foundation/roadmap.md`](context/foundation/roadmap.md).

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

## Deployment

The app deploys to Cloudflare Workers:

```bash
npm run build
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
npx wrangler deploy
```

## License

MIT for the code written in this project; see [LICENSE](LICENSE). The project was bootstrapped from [10x-astro-starter](https://github.com/przeprogramowani/10x-astro-starter), which does not declare a license, so the MIT grant does not extend to code taken from that starter.
