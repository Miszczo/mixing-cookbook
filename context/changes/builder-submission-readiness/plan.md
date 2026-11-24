# Builder Submission Readiness Implementation Plan

## Overview

Bring Mixing Cookbook to a state where it can be submitted for the 10xBuilder badge in certification term 2 (2026-12-06, 23:59). The product code is already complete. The plan closes four gaps around it: red CI, no cloud deployment, stale evidence documents, and a `master` branch that is three weeks behind.

## Current State Analysis

The Builder rules (Circle post, pasted 2026-11-24) require access control, CRUD, one business-logic function, context documents, at least one test set that addresses a risk from the test plan from the user's perspective, and "full-stack MVP with deployment to the cloud". A public URL is listed as nice-to-have, but the deployment itself is part of the pillar definition.

What already meets the rules:

- Access control: Supabase sign-in, RLS on every table, two-user isolation tests (`tests/isolation-*.test.ts`, `tests/*-rls.test.ts`).
- CRUD: plugins have create, list, update, and delete (`src/pages/api/plugins/[id].ts:42`), and tracks have update (`src/pages/api/tracks/[id].ts:39`).
- Business logic: recipe tool selection by DAW and inventory, with a native-tool fallback (`tests/recipe-tool-selection.test.ts`).
- Context documents: `context/foundation/` holds `prd.md`, `roadmap.md`, `test-plan.md`, `infrastructure.md`, `tech-stack.md`, `lessons.md`. There are 13 archived changes with plans and reviews.
- Tests: 21 files in `tests/`, run by `npm test` against local Supabase and by the `smoke` CI job.

What is missing:

- **CI is red.** The last two runs of PR #1 failed in the `smoke` job only. On 2026-11-11 the newest Supabase CLI rejected `[inbucket]` in `supabase/config.toml` ("no longer supported. Use [local_smtp]"). On 2026-11-22 `supabase/setup-cli@v1` with `version: latest` hit a GitHub rate limit. The last green run was 2026-11-01, so CI has never run the tests added since then (recipes, notes, search, template, Markdown copy, paste).
- **No deployment.** `infrastructure.md` recommends Cloudflare Workers, and its Getting Started steps 1–2 are already in `astro.config.mjs` (`session: false`, `imageService: "compile"`). No Supabase Cloud project, Worker secrets, or `workers.dev` address appear anywhere in the repo.
- **Stale evidence.** `test-plan.md` was last updated 2026-10-07. Its phases 2–4 say "not started", §4 says "Baza testów: none", and §6.4–§6.5 are "TBD", even though the tests exist. A reviewer reading it cannot see which test set covers which risk. README has no features list, no address, and no map to the Builder requirements.
- **Branch state.** `master` is at `561234c` (2026-11-01). The work S-01…S-11 sits on `chore/delivery-step-0` (PR #1, 41 commits, mergeable). The local branch is 14 commits ahead of its remote. `context/foundation/roadmap.md` has an uncommitted M-3 opening.

## Desired End State

- PR #1 is merged and CI is green on `master`, with both the `ci` and `smoke` jobs passing.
- The app runs on Cloudflare Workers against a Supabase Cloud project with all migrations applied. A new user can sign up, sign in, and reach the main flow at the `workers.dev` address. A demo account exists for the submission form.
- `test-plan.md` names, for each risk, the test files that cover it. README states the address, the features, and where each Builder requirement is met.
- `/10x-status` shows no drift warnings for this change, and a Builder checklist in this plan is ticked by the user.

Verify by opening the `workers.dev` address in a private window, signing in with the demo account, and checking the latest `master` run in `gh run list`.

### Key Discoveries:

- `.github/workflows/ci.yml:36-38` uses `supabase/setup-cli@v1` with `version: latest`. The local CLI is 2.117.0 and starts the stack with the current `config.toml`, so pinning that version fixes both recorded failures without touching `config.toml`.
- Recipe screenshots are stored in Postgres (`supabase/migrations/20261103120000_recipes.sql:13`, `image_data text`), not in Storage. Production needs no bucket, and the `storage-api` exclusion in CI is safe.
- Local auth has `enable_confirmations = false` (`supabase/config.toml:209`), and `scripts/smoke.mjs` depends on it. Supabase Cloud enables email confirmation by default, and its built-in mail only reaches organisation members, so a reviewer could not confirm an account.
- `src/pages/api/auth/signup.ts` redirects to `/auth/confirm-email` after `signUp`. Phase 2 checks that this page lets a user continue when no confirmation is needed.
- `infrastructure.md` "Approval" assigns login, secrets, production deploy, and Supabase migrations to a human. The agent may run `npm run build`, `npx wrangler versions list`, and `npx wrangler tail`.
- `context/foundation/lessons.md`: do only what was asked and stop before the next skill. Every manual row below is ticked by the user, not inferred from tests.

## What We're NOT Doing

- Not sending the certification form. The user decides the term, because odznaki are submitted once, in one term, with no later additions.
- Not starting 10xArchitect or 10xChampion work. That begins after Builder is closed.
- No browser E2E (Playwright). The rules require a test set that addresses a test-plan risk from the user's perspective, not a browser test. The HTTP integration tests sign in as a user and assert what the user receives.
- Not building S-12 (track progress percentage, FR-018). It stays open in M-3 as a nice-to-have outside the MVP.
- No CI deploy job or Workers Builds. Deployment is a manual `wrangler deploy`. Automated delivery belongs to the Champion track.
- No custom domain, no SMTP setup, no Supabase region migration.
- No changes to product features.

## Implementation Approach

Fix CI first, because every later step depends on it being a trustworthy signal, and the tests added since 2026-11-01 have never run there. Deploy next, because the README and test-plan updates need the real address and the real production auth behaviour. Update the evidence documents on the branch, so that one merge of PR #1 brings code, deployment notes, and documents to `master` together. Finish with a check against the Builder rules.

## Critical Implementation Details

**Timing & lifecycle**: Apply the Supabase Cloud migrations before the first `wrangler deploy` serves traffic, and set both Worker secrets before checking sign-in. `infrastructure.md` records the failure mode: a green deploy with empty secrets returns 500 on the first protected page.

## Phase 1: Green CI on PR #1

### Overview

Make the `smoke` job reliable again, push the local commits, and see the full test suite pass in CI for the first time since 2026-11-01.

### Changes Required:

#### 1. Pin the Supabase CLI in CI

**File**: `.github/workflows/ci.yml`

**Intent**: Replace `version: latest` in the `supabase/setup-cli@v1` step with the version used locally, so CI does not call the releases API and does not pick up a CLI that rejects the current `config.toml`.

**Contract**: `smoke` job, step `uses: supabase/setup-cli@v1`, `with.version: 2.117.0`. No other workflow changes.

#### 2. Commit the roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: Commit the existing uncommitted M-3 opening as it stands. S-11 is `done` and S-12 stays open.

**Contract**: No content edits beyond what is already in the working tree.

#### 3. Fix tests that CI exposes, if any

**File**: `tests/**`, or the code they cover

**Intent**: If the first green-infrastructure run fails a test that passes locally, find the cause (environment, missing service, timing) and fix it at the root. Do not skip the test or loosen its assertion.

**Contract**: The `smoke` job runs `npm test`, `npm run build`, and `npm run smoke` unchanged.

### Success Criteria:

#### Automated Verification:

- Workflow pins the CLI: `.github/workflows/ci.yml` contains `version: 2.117.0` and no `version: latest`
- Local suite passes against local Supabase: `npm test`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Latest PR #1 run has `ci` and `smoke` both successful: `gh run list --branch chore/delivery-step-0 -L 1`

#### Manual Verification:

- You approved the push of `chore/delivery-step-0`, and `git status` shows the branch level with `origin/chore/delivery-step-0`
- In the `smoke` job log, the "Run integration tests" step lists the recipe, notes, and paste test files as passed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Production Deployment

### Overview

Deploy the app to Cloudflare Workers against a new Supabase Cloud project, following `infrastructure.md` Getting Started steps 2–5. The steps that touch accounts are yours; the agent prepares commands and checks the results.

### Changes Required:

#### 1. Supabase Cloud project (manual)

**File**: none in repo (Supabase dashboard and CLI)

**Intent**: Create the production database and auth, apply every migration from `supabase/migrations/`, and set auth so reviewers can sign up without a confirmation email.

**Contract**:
- New Supabase project. Then `npx supabase link --project-ref <ref>` and `npx supabase db push`, which applies all 8 migrations.
- Auth → Providers → Email: "Confirm email" off.
- Auth → URL Configuration: Site URL set to the `workers.dev` address after the first deploy.
- Keep the project URL and anon key for the Worker secrets. Do not put the service-role key anywhere.

#### 2. Worker secrets and deploy (manual)

**File**: none in repo (Wrangler)

**Intent**: Publish the existing Worker config with production secrets.

**Contract**: `npx wrangler login`; `npx wrangler secret put SUPABASE_URL`; `npx wrangler secret put SUPABASE_KEY`; `npm run build && npx wrangler deploy`. Never run `wrangler pages deploy`. After the deploy, confirm that no `SESSION` KV namespace or Images binding was created (`infrastructure.md` risk register).

#### 3. Post-signup page without confirmation

**File**: `src/pages/auth/confirm-email.astro` (only if needed)

**Intent**: With confirmation off, a new user must be able to continue after sign-up. If the page tells the user to wait for an email that never comes, change its text or the signup redirect so the user is sent on to sign in or to the dashboard.

**Contract**: The `src/pages/api/auth/signup.ts` redirect target and the page text. Local behaviour (confirmation off) must match production.

#### 4. Demo account (manual)

**File**: none in repo

**Intent**: Create one demo user in production with a primary DAW, a few plugins, one track in Miks, and one own recipe. A reviewer can then see the main flow without building data.

**Contract**: The credentials go only into the submission form. They are never committed.

### Success Criteria:

#### Automated Verification:

- Production build passes: `npm run build`
- Worker version is listed after deploy: `npx wrangler versions list`
- Smoke flow passes against production: `BASE_URL=https://<worker>.workers.dev npm run smoke`
- No runtime errors while signing in: `npx wrangler tail` shows no exceptions during the manual sign-in below

#### Manual Verification:

- `npx supabase db push` reported all migrations applied, and the tables are visible in the Supabase dashboard
- In a private window, a new e-mail address can sign up and reach `/dashboard` without a confirmation e-mail
- The demo account signs in and shows its DAW, plugins, Miks track, and a recipe card with a tool and steps
- A second account does not see the demo account's plugins, tracks, or recipes
- The Cloudflare dashboard shows no `SESSION` KV namespace or Images binding for this Worker

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Evidence Documents

### Overview

Make the documents tell a reviewer, without reading code, which requirement is met where and which tests cover which risk.

### Changes Required:

#### 1. Refresh the test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Run `/10x-test-plan --refresh` so the rollout statuses, §4 stack, and §6 cookbook reflect the shipped tests. The risk map must name the test files that cover each risk #1–#5.

**Contract**: §3 phase statuses, §4 stack table, §5 gates, §6.4–§6.6, §8 freshness dates. §1 strategy and the §2 risk wording stay unchanged.

#### 2. README for the reviewer

**File**: `README.md`

**Intent**: Add the live address, a short features list, and a "Builder requirements" section that maps each requirement (access control, CRUD, business logic, context documents, tests per risk, deployment, CI) to concrete files or routes. Update the Deployment section with the Supabase Cloud steps from Phase 2.

**Contract**: New sections "Live app", "Features", and "Builder requirements". The existing Local setup, Scripts, and Project layout sections stay. No credentials.

#### 3. Record the deployment

**File**: `context/foundation/infrastructure.md`

**Intent**: Add a short "Deployed" note with the date, the `workers.dev` address, the Supabase Cloud setup (migrations via `db push`, confirmation off and why), and the manual deploy command. The research above it is not rewritten.

**Contract**: New section at the end of the file.

### Success Criteria:

#### Automated Verification:

- No `TBD` or "not started" is left in `test-plan.md` for a risk that has tests: `grep -nE "TBD|not started" context/foundation/test-plan.md`
- Every test file named in `test-plan.md` exists in `tests/`
- README contains the `workers.dev` address: `grep -n "workers.dev" README.md`
- No secrets in the diff: `git diff master --stat` and a scan of README for keys or passwords
- Linting passes: `npm run lint`

#### Manual Verification:

- Reading only README, you can point to where each Builder requirement is met
- The risk → test mapping in `test-plan.md` matches what the tests actually check

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Merge and Final Check

### Overview

Bring everything to `master` with green CI, and check the result against the Builder rules.

### Changes Required:

#### 1. Merge PR #1 (manual)

**File**: none in repo (GitHub)

**Intent**: Merge `chore/delivery-step-0` into `master` after the last PR run is green. You click merge.

**Contract**: PR #1 merged into `master`. The `push` run on `master` must be green.

#### 2. Builder checklist

**File**: `context/changes/builder-submission-readiness/plan.md` (this file, Progress)

**Intent**: Confirm each Builder requirement against the deployed app and the documents, and confirm that course material is not in the public repo (`AGENTS.md`: `.cursor/skills`, `.cursor/prompts`, `10xdevs-lessons` stay ignored).

**Contract**: Manual rows 4.4–4.9 in Progress.

### Success Criteria:

#### Automated Verification:

- Latest run on `master` has `ci` and `smoke` successful: `gh run list --branch master -L 1`
- `/10x-status` shows no ⚠ warning for any change
- Course material is not tracked: `git ls-files 10xdevs-lessons .cursor/skills .cursor/prompts .claude/skills` returns nothing

#### Manual Verification:

- Access control: the demo account sees only its own data, and a signed-out visit to `/dashboard` redirects to sign-in
- CRUD: on the production app you created, edited, and deleted a plugin
- Business logic: with no matching plugin, a recipe card shows the DAW's native tool
- Context documents: `prd.md`, `infrastructure.md`, `roadmap.md`, and `test-plan.md` are on `master`
- Tests: `test-plan.md` names at least one risk with its test set, and that set ran green in the `master` CI run
- Deployment: the `workers.dev` address works in a private window, and the demo credentials are noted for the form

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No new unit tests. The existing suite is the evidence.

### Integration Tests:

- The full `npm test` suite in the CI `smoke` job, against local Supabase, on PR #1 and on `master`.
- `npm run smoke` against the production address in Phase 2.

### Manual Testing Steps:

1. Private window → `workers.dev` → sign up with a new address → reach `/dashboard`.
2. Sign in as the demo account → open the Miks track → open a recipe → see the tool and steps.
3. Remove matching plugins → reopen the card → see the native DAW tool.
4. Sign in as a second account → confirm none of the demo data is visible.

## Performance Considerations

None beyond `infrastructure.md`: place the Supabase project in the region nearest to you (Europe), because every page reads from it.

## Migration Notes

The Supabase Cloud database starts empty, and `db push` applies the 8 repo migrations in order. Migrations are forward-only. A `wrangler rollback` does not roll back the schema.

## References

- Builder rules: Circle post pasted into the planning session, 2026-11-24
- Deployment research: `context/foundation/infrastructure.md`
- Test strategy: `context/foundation/test-plan.md`
- CI failures: GitHub Actions runs 43048346034 (2026-11-11) and 45057952229 (2026-11-22)
- Earlier delivery list: `DELIVERY-ROADMAP.local.md` (local, ignored)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Green CI on PR #1

#### Automated

- [x] 1.1 Workflow pins the CLI: `.github/workflows/ci.yml` contains `version: 2.117.0` and no `version: latest` — 58ce382
- [x] 1.2 Local suite passes against local Supabase: `npm test` — 58ce382
- [x] 1.3 Linting passes: `npm run lint` — 58ce382
- [x] 1.4 Type checking passes: `npx astro check` — 58ce382
- [x] 1.5 Latest PR #1 run has `ci` and `smoke` both successful: `gh run list --branch chore/delivery-step-0 -L 1` — 58ce382

#### Manual

- [x] 1.6 You approved the push of `chore/delivery-step-0`, and `git status` shows the branch level with `origin/chore/delivery-step-0`
- [x] 1.7 In the `smoke` job log, the "Run integration tests" step lists the recipe, notes, and paste test files as passed

### Phase 2: Production Deployment

#### Automated

- [x] 2.1 Production build passes: `npm run build`
- [x] 2.2 Worker version is listed after deploy: `npx wrangler versions list`
- [x] 2.3 Smoke flow passes against production: `BASE_URL=https://<worker>.workers.dev npm run smoke`
- [x] 2.4 No runtime errors while signing in: `npx wrangler tail` shows no exceptions during the manual sign-in below

#### Manual

- [x] 2.5 `npx supabase db push` reported all migrations applied, and the tables are visible in the Supabase dashboard
- [x] 2.6 In a private window, a new e-mail address can sign up and reach `/dashboard` without a confirmation e-mail
- [x] 2.7 The demo account signs in and shows its DAW, plugins, Miks track, and a recipe card with a tool and steps
- [x] 2.8 A second account does not see the demo account's plugins, tracks, or recipes
- [x] 2.9 The Cloudflare dashboard shows no `SESSION` KV namespace or Images binding for this Worker

### Phase 3: Evidence Documents

#### Automated

- [ ] 3.1 No `TBD` or "not started" is left in `test-plan.md` for a risk that has tests: `grep -nE "TBD|not started" context/foundation/test-plan.md`
- [ ] 3.2 Every test file named in `test-plan.md` exists in `tests/`
- [ ] 3.3 README contains the `workers.dev` address: `grep -n "workers.dev" README.md`
- [ ] 3.4 No secrets in the diff: `git diff master --stat` and a scan of README for keys or passwords
- [ ] 3.5 Linting passes: `npm run lint`

#### Manual

- [ ] 3.6 Reading only README, you can point to where each Builder requirement is met
- [ ] 3.7 The risk → test mapping in `test-plan.md` matches what the tests actually check

### Phase 4: Merge and Final Check

#### Automated

- [ ] 4.1 Latest run on `master` has `ci` and `smoke` successful: `gh run list --branch master -L 1`
- [ ] 4.2 `/10x-status` shows no ⚠ warning for any change
- [ ] 4.3 Course material is not tracked: `git ls-files 10xdevs-lessons .cursor/skills .cursor/prompts .claude/skills` returns nothing

#### Manual

- [ ] 4.4 Access control: the demo account sees only its own data, and a signed-out visit to `/dashboard` redirects to sign-in
- [ ] 4.5 CRUD: on the production app you created, edited, and deleted a plugin
- [ ] 4.6 Business logic: with no matching plugin, a recipe card shows the DAW's native tool
- [ ] 4.7 Context documents: `prd.md`, `infrastructure.md`, `roadmap.md`, and `test-plan.md` are on `master`
- [ ] 4.8 Tests: `test-plan.md` names at least one risk with its test set, and that set ran green in the `master` CI run
- [ ] 4.9 Deployment: the `workers.dev` address works in a private window, and the demo credentials are noted for the form
