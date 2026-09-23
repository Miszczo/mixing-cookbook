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

## Why this stack

A solo after-hours web app in 3 weeks needs login, private per-user data, and screenshot uploads without standing up a separate backend. The standard JavaScript/TypeScript path for this product type lands on 10x Astro Starter: Astro + React + TypeScript + Supabase already covers auth, Postgres, and file storage, which matches the must-have login and screenshot requirements. Cloudflare Pages is the starter default and fits a small, low-ops audience; GitHub Actions with auto-deploy-on-merge keeps the short timeline moving. Payments, realtime, AI, and background jobs are out of scope. Scaffolding confidence is first-class — mostly smooth, with occasional manual steps.
