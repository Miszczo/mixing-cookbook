# Builder Submission Readiness — Plan Brief

> Full plan: `context/changes/builder-submission-readiness/plan.md`

## What & Why

Make Mixing Cookbook ready to submit for the 10xBuilder badge in certification term 2 (2026-12-06, 23:59). The product meets the feature rules (access control, CRUD, business logic, tests per risk), but Builder also requires a cloud deployment, and the evidence a reviewer sees is red or out of date.

## Starting Point

All product slices S-01…S-11 are archived as done on branch `chore/delivery-step-0` (PR #1, 41 commits). `master` is still at 2026-11-01. CI fails in the `smoke` job because the Supabase CLI is `latest`. There is no deployment. `test-plan.md` dates from 2026-10-07 and still says tests are "not started".

## Desired End State

PR #1 is merged and CI is green on `master`. The app runs on Cloudflare Workers with Supabase Cloud, a reviewer can sign up or use a demo account, and README plus `test-plan.md` show where each Builder requirement is met. Sending the form remains your decision.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Badges now | Builder only; Architect/Champion after Builder is closed | Shortest path to a submittable project. The send date is decided separately, because badges cannot be added after a submission. |
| Deployment | Cloudflare Workers + Supabase Cloud | The adapter, `wrangler.jsonc`, and the `infrastructure.md` risk register are already in place. |
| Browser E2E | None | The rules ask for a test set per test-plan risk from the user's perspective. The HTTP tests already sign in as users. |
| Branch | Merge PR #1 after green CI | Reviewers look at `master`, and CI must be green there. |
| Milestone M-3 | Commit `roadmap.md` as is; S-12 stays open | FR-018 is outside the MVP, and the roadmap honestly shows that. |
| CI fix | Pin Supabase CLI to 2.117.0 | Both recorded failures come from `version: latest`, and the local 2.117.0 accepts the current `config.toml`. |
| Production auth | Email confirmation off + demo account | Supabase's default mail only reaches organisation members, so a reviewer could not confirm an account. |

## Scope

**In scope:**
- CLI pin in `ci.yml`, roadmap commit, push, and root-cause fixes for any test CI exposes
- Supabase Cloud project and migrations, Worker secrets and deploy, the post-signup page, a demo account
- Refreshed `test-plan.md`, README for reviewers, a deployment note in `infrastructure.md`
- Merge of PR #1, the Builder checklist

**Out of scope:**
- Sending the form
- Architect and Champion work
- Playwright
- S-12
- CI deploy job
- Custom domain or SMTP
- Product feature changes

## Architecture / Approach

CI first, so it is a trustworthy signal: tests added since 2026-11-01 have never run there. Deploy second, because the documents need the real address and real auth behaviour. Documents third, still on the branch. A single merge then brings code and evidence to `master`, followed by a check against the Builder rules. Steps that touch accounts (Supabase, Cloudflare, push, merge) are yours.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Green CI on PR #1 | Pinned CLI, pushed branch, full suite green in CI | Tests added since 11-01 may fail in CI for environment reasons |
| 2. Production Deployment | App on `workers.dev` with Supabase Cloud, demo account | Empty secrets or confirmation e-mails blocking sign-in |
| 3. Evidence Documents | Test plan mapped to tests, README for reviewers | Mapping drifts from what the tests actually assert |
| 4. Merge and Final Check | `master` green, Builder checklist ticked | Merge brings an unexpected CI failure on `master` |

**Prerequisites:** Docker with local Supabase; Supabase and Cloudflare accounts; `gh` authenticated; your approval for push and merge.
**Estimated effort:** ~2–3 evening sessions. Phase 2 is the longest because of the account setup.

## Open Risks & Assumptions

- CI may expose a test that only passes locally. Phase 1 fixes it at the root, which can take extra time.
- With confirmation off, anyone can sign up on production. This is accepted for a personal MVP, and RLS keeps each user's data separate.
- `npm run smoke` against production creates test users and rows in the production database.
- The Circle form may ask for something not in the pasted rules. Check it before sending.

## Success Criteria (Summary)

- A reviewer opens the `workers.dev` address, signs in, and walks the main flow.
- The latest `master` CI run is green, with both `ci` and `smoke` passing.
- README and `test-plan.md` show where each Builder requirement and each tested risk lives.
