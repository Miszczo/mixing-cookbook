---
bootstrapped_at: 2026-09-21T17:39:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: sound-intent-mixing-cookbook-cms
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
---
starter_id: 10x-astro-starter
package_manager: npm
project_name: sound-intent-mixing-cookbook-cms
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---
```

## Why this stack

A solo after-hours web app in 3 weeks needs login, private per-user data, and screenshot uploads without standing up a separate backend. The standard JavaScript/TypeScript path for this product type lands on 10x Astro Starter: Astro + React + TypeScript + Supabase already covers auth, Postgres, and file storage, which matches the must-have login and screenshot requirements. Cloudflare Pages is the starter default and fits a small, low-ops audience; GitHub Actions with auto-deploy-on-merge keeps the short timeline moving. Payments, realtime, AI, and background jobs are out of scope. Scaffolding confidence is first-class — mostly smooth, with occasional manual steps.

## Pre-scaffold verification

| Signal             | Value                                                          | Severity | Notes                                                                 |
| ------------------ | -------------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| npm package        | not run                                                        | n/a      | `cmd_template` starts with `git clone`; npm recency check skipped     |
| GitHub repo        | przeprogramowani/10x-astro-starter last pushed 2026-09-12      | fresh    | from card.docs_url; `gh api repos/przeprogramowani/10x-astro-starter` returned `2026-09-12T21:16:08Z` |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 30832 (51 project files + 30781 files under `node_modules/`)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**.bootstrap-scaffold cleanup**: deleted
**Upstream `.git/`**: deleted before move-up
**`context/`**: preserved; the starter shipped no `context/` tree to drop

**CLI output**:

```
Cloning into '.bootstrap-scaffold'...

added 654 packages, and audited 655 packages in 15s

232 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

### Move log

Every project file below was moved silently (no path already existed in the working directory). `node_modules/` (30781 files) was moved as the installed dependency tree.

- `.env.example`
- `.github/workflows/ci.yml`
- `.gitignore`
- `.husky/pre-commit`
- `.nvmrc`
- `.prettierrc.json`
- `.vscode/extensions.json`
- `.vscode/launch.json`
- `.vscode/settings.json`
- `AGENTS.md`
- `astro.config.mjs`
- `CLAUDE.md`
- `components.json`
- `eslint.config.js`
- `package.json`
- `package-lock.json`
- `public/.assetsignore`
- `public/favicon.png`
- `public/template.png`
- `README.md`
- `scripts/smoke.mjs`
- `src/components/auth/FormField.tsx`
- `src/components/auth/PasswordToggle.tsx`
- `src/components/auth/ServerError.tsx`
- `src/components/auth/SignInForm.tsx`
- `src/components/auth/SignUpForm.tsx`
- `src/components/auth/SubmitButton.tsx`
- `src/components/Banner.astro`
- `src/components/Topbar.astro`
- `src/components/ui/button.tsx`
- `src/components/ui/LibBadge.astro`
- `src/components/Welcome.astro`
- `src/env.d.ts`
- `src/layouts/Layout.astro`
- `src/lib/config-status.ts`
- `src/lib/supabase.ts`
- `src/lib/utils.ts`
- `src/middleware.ts`
- `src/pages/api/auth/signin.ts`
- `src/pages/api/auth/signout.ts`
- `src/pages/api/auth/signup.ts`
- `src/pages/auth/confirm-email.astro`
- `src/pages/auth/signin.astro`
- `src/pages/auth/signup.astro`
- `src/pages/dashboard.astro`
- `src/pages/index.astro`
- `src/styles/global.css`
- `supabase/.gitignore`
- `supabase/config.toml`
- `tsconfig.json`
- `wrangler.jsonc`
- `node_modules/**` (30781 files)

Pre-existing paths left untouched: `.10x-cli.json`, `.cursor/`, `context/`, `lessons/`, `research/`.

## Post-scaffold audit

**Tool**: npm audit --json
**Exit code**: 0
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/0/0 direct of total 0/0/0/0. This npm audit JSON omitted `metadata.dependencies.direct`, so direct dependencies were not counted separately. Dependency totals reported: prod 377, dev 269, optional 167, total 804. `vulnerabilities` was an empty object, so no advisory could be classified as direct or transitive.

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

None.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

Each hint below surfaces but does not act on in v1.

| Hint                       | Value              |
| -------------------------- | ------------------ |
| bootstrapper_confidence    | first-class        |
| quality_override           | false              |
| path_taken                 | standard           |
| self_check_answers         | null               |
| team_size                  | solo               |
| deployment_target          | cloudflare-pages   |
| ci_provider                | github-actions     |
| ci_default_flow            | auto-deploy-on-merge |
| has_auth                   | true               |
| has_payments               | false              |
| has_realtime               | false              |
| has_ai                     | false              |
| has_background_jobs        | false              |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
