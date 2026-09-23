---
project: sound-intent-mixing-cookbook-cms
researched_at: 2026-09-22
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7 + React 19
  runtime: workerd (Cloudflare Workers)
---

## Recommendation

**Deploy on Cloudflare Workers.**

This MVP is Astro 7.3 SSR (`output: "server"`) with `@astrojs/cloudflare` 14.3 and Wrangler 4.131 already in the repo. Adapter 14 deploys to Workers with static assets; it does not deploy to Cloudflare Pages, so the starter hint `deployment_target: cloudflare-pages` is stale. Workers scored Pass on all five platform criteria. The interview pointed the same way: developer-experience over minimum cost, existing Cloudflare familiarity, and a global audience. Persistent connections are undecided, and the product has no realtime or background jobs, so a request/response isolate is enough. Data stays on Supabase (auth, Postgres, storage); co-location was undecided and is not required.

## Platform Comparison

Checked 2026-09-22 against current docs and, for Wrangler, against `wrangler` 4.131 in this repo. Pass = 2, Partial = 1, Fail = 0. Heavy weight on CLI, managed hosting, and a stable deploy API. Extra weight for global edge and for staying on the adapter already installed.

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / integration | Sum |
|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 10 |
| Vercel | Pass | Pass | Pass | Pass | Partial | 9 |
| Netlify | Partial | Pass | Pass | Pass | Pass | 9 |
| Fly.io | Pass | Pass | Pass | Pass | Partial | 9 |
| Render | Partial | Pass | Pass | Partial | Pass | 8 |
| Railway | Partial | Pass | Pass | Partial | Partial | 7 |

**Cloudflare Workers.** CLI is `npx wrangler deploy`, `npx wrangler rollback [version-id]`, and `npx wrangler tail` (verified in Wrangler 4.131). The platform runs the build; there is no VM to patch. Docs ship as `llms.txt` and markdown. Deploy returns a URL in one command, and rollback is an immediate new deployment of an older version (last 100). Official MCP servers cover docs, Workers, and observability and are documented as generally available. The gap versus the marketing name "Pages" is real: this adapter's deploy target is Workers.

**Vercel.** `vercel`, `vercel --prod`, `vercel rollback`, and `vercel logs` cover the loop. Hosting is managed Functions (Fluid compute is GA). Docs are markdown plus `llms.txt`. Deploy and rollback are one command; on Hobby, rollback only reaches the previous production deployment. The official Vercel MCP is still Public Beta (checked 2026-09-22). Astro 7 is supported via `@astrojs/vercel` v11, which means replacing the Cloudflare adapter.

**Netlify.** `netlify deploy` and `netlify logs` are first-class. Restoring a deploy is an API call (`restoreSiteDeploy`) rather than a single obvious rollback command, so CLI-first is Partial. Functions and CDN are managed. `llms.txt` and per-page markdown exist. The official Netlify MCP has no beta badge. Astro 7 SSR uses `@astrojs/netlify` v8 and runs as regional Functions (default Ohio), which is a poor fit for a global audience.

**Fly.io.** `fly deploy` and `fly logs` are solid; rollback is `fly deploy --image`, not a dedicated rollback command, but it is scriptable. Machines are managed, yet the app must ship a Docker image and swap to `@astrojs/node`. Docs are on `llms.txt` and GitHub. `fly mcp` is marked experimental. There is no ongoing free tier for new accounts (trial only). Multi-region is possible and billed per machine. Dropped from the shortlist because the three-week, after-hours timeline already has a Workers adapter, and persistent processes are not a current requirement.

**Render.** Official CLI can create deploys and tail logs. There is no dedicated rollback command (dashboard or API), so CLI-first and the deploy API are Partial. Web services are managed. Docs expose `llms.txt` and markdown. The hosted MCP at `mcp.render.com` is GA; the docs MCP is experimental. SSR needs `@astrojs/node` and one region per service. Free instances spin down after 15 minutes.

**Railway.** `railway up` and `railway logs` work. Rollback to an older deploy is dashboard-only, so CLI-first and the deploy API are Partial. Railpack can run Node without a hand-written Dockerfile, but Astro still needs `@astrojs/node`. Docs are `llms.txt` plus markdown. Remote MCP is in public testing (2026-04-17). Services are single-region by default, not a global edge.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

It is the only option that is already wired (`astro.config.mjs`, `wrangler.jsonc`, `astro dev` on `workerd`), global by default, and fully operable from Wrangler 4.131. At 10k–100k requests a month the Free plan is enough (100k requests/day, 10 ms CPU per invocation; pricing page updated 2026-08-28). Supabase stays external.

#### 2. Vercel

Best fallback if Workers limits block the MVP. Same shape of job (serverless SSR, CLI, preview URLs, CDN) and a current Astro 7 adapter. The cost of switching is a new adapter and a Node-style function runtime. MCP is still beta, and Hobby is non-commercial.

#### 3. Netlify

Official Astro 7 adapter and a GA MCP, without Docker. SSR is regional, and rollback is less direct than Wrangler or Vercel, so it ranks behind both for a global, DX-first MVP.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. The edge does not move Supabase. Profile, plugin, and recipe reads still travel to one database region, so a producer far from that region can miss the one-second budget on the recipe card.
2. `workerd` is not Node. `nodejs_compat` is required (already set in `wrangler.jsonc`). Native Sharp and unsupported `node:` APIs fail the build. With `@astrojs/cloudflare` 14.3, omitting `imageService` defaults to `cloudflare-binding`, which provisions a Cloudflare Images binding even though screenshots go to Supabase Storage.
3. Unless `session: false` is set, the adapter enables Astro sessions on a KV namespace named `SESSION` and Wrangler can create it on deploy. Login in this app is a Supabase cookie. Two session mechanisms will diverge.
4. `SUPABASE_URL` and `SUPABASE_KEY` are `astro:env/server` secrets. A local `.env` is not uploaded. `wrangler deploy` can succeed and the first protected page can still 500.
5. Guides and the starter hint that say Cloudflare Pages or `wrangler pages deploy` are wrong for this adapter. Zone Auto Minify can break React hydration (`Hydration completed but contains mismatches`).

### Pre-Mortem — How This Could Fail

The team treated the starter hint `deployment_target: cloudflare-pages` as the deploy target. `@astrojs/cloudflare` 14 no longer deploys Pages, so secrets were saved on a Pages project while the Worker booted with empty `astro:env/server` values. Login returned 500 on a green `wrangler deploy`. The default adapter also provisioned a `SESSION` KV namespace and a Cloudflare Images binding, even though auth is a Supabase cookie and screenshots live in Supabase Storage. Recipes felt instant from Europe, where the database sits. Producers on other continents waited on every profile, plugin, and recipe query, and the one-second budget failed despite edge hosting. A later live listening note needed a process between requests. Workers could not keep one, and Durable Objects meant a redesign the MVP never planned. Rolling the Worker back left the Supabase schema and stored files exactly where the bad release had moved them.

### Unknown Unknowns

- `npm run dev` (`astro dev`) already runs on `workerd` since Astro 6 and adapter 13. A separate `wrangler dev` is only a post-build preview, alongside `astro preview`. Adding it as the daily server is redundant.
- `wrangler.jsonc` in this repo is already a Worker (`main` points at `@astrojs/cloudflare/entrypoints/server`, `nodejs_compat`, assets directory `./dist`, observability on). Do not replace it with a Pages project. Astro may treat a bare name-only config as optional; this file also sets `not_found_handling` and observability, so keep it.
- Wrangler 4.131 defaults `--experimental-provision` to true. Combined with the adapter defaults, the first deploy can create `SESSION` KV and an Images binding. Set `session: false` and `imageService: "compile"` first if those resources are unwanted. That provision flag is experimental even though it defaults on (checked 2026-09-22 in this repo).
- `npx wrangler rollback` restores Worker code only, and only among the last 100 versions. It does not roll back Supabase migrations or Storage objects. Rollback is refused if the target version binds a KV namespace, R2 bucket, or queue that no longer exists.
- Since Astro 6, the Cloudflare environment is chosen at build time. `wrangler deploy --env` alone is not enough. A named env requires `CLOUDFLARE_ENV=<name> npm run build && npx wrangler deploy`.

## Operational Story

- **Preview deploys**: `npx wrangler deploy` uploads a version and prints a `workers.dev` URL. Git branch builds use Workers Builds after the repository is connected in the dashboard (Compute > Workers & Pages; build `npx astro build`, deploy `npx wrangler deploy`). Keep production Supabase secrets off preview builds. Fork pull requests must not receive those secrets.
- **Secrets**: Production values live as Worker secrets via `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. `npx wrangler secret list` shows names, not values. Local `workerd` reads gitignored `.dev.vars`. Rotation is another `secret put` for the same key. Anyone who can deploy the Worker can overwrite a secret; the plaintext is not readable back.
- **Rollback**: `npx wrangler versions list`, then `npx wrangler rollback <version-id> --yes`. Traffic switches immediately (seconds) to that version, including a 100% cutover if a split deploy was active. Supabase SQL and stored screenshots stay as they are. Bindings that were deleted since that version block the rollback.
- **Approval**: A human logs in (`npx wrangler login`), connects Git for Workers Builds, runs `wrangler secret put` for production, and approves `npx wrangler deploy` to production. A human also owns Supabase migrations and any deletion of KV or other bindings. An agent may run `npm run build`, `npx wrangler versions list`, and `npx wrangler tail` unattended.
- **Logs**: `npx wrangler tail` streams runtime logs read-only (this repo's Wrangler 4.131). `observability.enabled` is already true in `wrangler.jsonc`. `npx wrangler versions list` is the deploy history. Cloudflare's observability MCP can be attached later; the command above does not need it.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Recipe card exceeds 1s for users far from the Supabase region | Devil's advocate | M | H | Put the Supabase project in the region where most producers are. Keep the track page to a few queries. Time that page from a distant network before treating the latency budget as met. |
| Default Images binding and Sharp/Node incompatibilities on `workerd` | Devil's advocate | H | M | Set `imageService: "compile"` on the Cloudflare adapter. Leave `nodejs_compat` in `wrangler.jsonc`. Store screenshots only in Supabase Storage. |
| Deploy creates an unused `SESSION` KV and splits auth state | Devil's advocate | H | M | Set `session: false` in `astro.config.mjs` before the first deploy. Keep auth on `@supabase/ssr` cookies only. |
| Green deploy, empty runtime secrets, login 500 | Devil's advocate | H | H | Run `npx wrangler secret put` for `SUPABASE_URL` and `SUPABASE_KEY`. Confirm a signed-in request after deploy. Do not rely on `.env` being uploaded. |
| Pages tutorial or starter hint deploys the wrong product | Devil's advocate | H | M | Deploy only with `npm run build && npx wrangler deploy` against the existing Workers `wrangler.jsonc`. Ignore `cloudflare-pages` and `wrangler pages deploy`. |
| Worker rollback leaves schema and files behind | Pre-mortem | M | H | Treat Supabase migrations as forward-only. Do not roll the Worker back across a migration that changed tables the older code cannot read. |
| Live listening later needs a always-on process | Pre-mortem | L | M | MVP stays request/response. If notes become live, choose Durable Objects or an external service before writing that feature. |
| Wrangler auto-provisions bindings (`--experimental-provision` defaults on) | Unknown unknowns | H | M | Set `session: false` and `imageService: "compile"` first. After the first deploy, list bindings and delete any `SESSION` or Images binding that appeared by mistake. |
| Named env built with the wrong `CLOUDFLARE_ENV` | Unknown unknowns | M | M | This app has no named env yet. If preview and production diverge, build each with `CLOUDFLARE_ENV` set, then deploy that build. |
| Auto Minify breaks React hydration | Research finding | L | M | If the console shows a hydration mismatch, turn Auto Minify off for the zone. |

## Getting Started

Versions in this repo: Astro ^7.3.2, `@astrojs/cloudflare` ^14.3.1, Wrangler ^4.131.1 (devDependency). Use `npx wrangler`, not a global install. `npm run dev` already matches production `workerd`; do not add `wrangler dev` as the daily server.

1. In `astro.config.mjs`, set `session: false` and change the adapter to `cloudflare({ imageService: "compile" })`. Auth is Supabase; screenshots are Supabase Storage. This stops the first deploy from provisioning `SESSION` KV and a Cloudflare Images binding.
2. Authenticate: `npx wrangler login`.
3. Create production secrets (prompts for the value; do not commit them): `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. For local `astro dev`, put the same keys in `.dev.vars`.
4. Deploy the existing Worker config: `npm run build && npx wrangler deploy`. Do not run `wrangler pages deploy`.
5. Check the release: `npx wrangler versions list` and `npx wrangler tail`. Sign in once against the printed `workers.dev` URL.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
