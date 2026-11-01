# Repository Guidelines

See @README.md.

## Hard rules

- Keep `output: "server"` (@astro.config.mjs). Hydrate with `client:*` (@src/pages/auth/signin.astro). Do not add `use client`.
- Read `SUPABASE_URL` and `SUPABASE_KEY` only from `astro:env/server`. Copy @.env.example to `.env` or `.dev.vars` (@.gitignore).
- Put session paths in `PROTECTED_ROUTES` (@src/middleware.ts). Other paths stay public. Redirect to `/auth/signin`.
- Merge classes with `cn()` (@src/lib/utils.ts). `set:html` fails lint (@eslint.config.js).
- Export API handlers as `POST` or `GET` (@src/pages/api/auth/signin.ts). API routes must export `const prerender = false` and validate input with zod.

## Commands

Node.js 22.14.0 (@.nvmrc). Scripts: @package.json.

- `npm run dev` — workerd dev server.
- `npx astro check` — CI type check; not an npm script.
- `BASE_URL=http://localhost:4321 npm run smoke` (@scripts/smoke.mjs) against a running server.

Pre-commit: `npx lint-staged` (@package.json).

## Project structure

Astro components for static content and layout; React only when interactivity is needed. Extract hooks to `src/components/hooks/`. Services go in `src/lib/` (or `src/lib/services/`). Shared types (entities, DTOs) go in `src/types.ts`.

shadcn/ui `new-york` files are in `src/components/ui/`; @components.json sets `rsc` to false. Add a component with `npx shadcn@latest add <name>`.

Add tables in `supabase/migrations/` as `YYYYMMDDHHmmss_short_description.sql` and enable RLS with granular per-operation, per-role policies.

This repository is public. Do not commit course material: `.cursor/skills`, `.cursor/prompts`, and `10xdevs-lessons` are local and ignored.

## Coding style

TypeScript, Prettier, and ESLint: @tsconfig.json, @.prettierrc.json, @eslint.config.js. `no-console` warns except under `scripts/**/*.mjs`.

## Testing

`npm test` runs Vitest integration tests from `tests/` against local Supabase. `npm run smoke` (@scripts/smoke.mjs) walks the HTTP flow and needs Supabase reachable with email confirmation disabled. The patterns are in @context/foundation/test-plan.md. In CI, the `smoke` job in @.github/workflows/ci.yml starts local Supabase, builds, and runs the smoke test against `npm run preview`.
## Pull requests

Commit messages use `type(change-id): summary`, for example `feat(primary-daw-profile): ...`.
