---
id: IDEA-56
title: Surface PR status in the dashboard
type: feat
status: idea
created: 2026-07-08
tags:
  - app
  - github
  - plans
---

The dashboard is blind to GitHub. When a plan reaches `review` you open its PR, merge it, and the entity just sits in `review` until you remember to approve-close it by hand — and even then there's no in-app sign the PR exists, is still open, or already merged. The one signal the app has (`getBranchHygieneStatus`'s "is this branch merged into main") is a coarse local-git guess, not the PR's real state.

- **PR badge on the entity.** A small GitHub-icon label on the plan detail (and worklist row) showing the PR number and state — draft / open / merged / closed — that links out to the PR on GitHub. At a glance you see "this plan has PR #30, merged" without leaving the app.
- **Read live PR state, server-side.** The dashboard server resolves the PR for the entity from its branch name (or the `**Plan:**` line `draft-pr.yml` stamps) and reads its state via the `gh` CLI / GitHub API, exposed through a `/api/git`-style route and cached so the worklist isn't hammering GitHub. Extends the existing git integration (`git.ts`, `git-api.ts`) rather than inventing a new one.
- **Nudge review → done on merge.** When the entity's PR is merged, surface it — a "PR merged — close this plan?" affordance on the review action, or an auto-advance — so the review→done gap closes itself instead of relying on memory. (Pairs with the just-landed change that lets you approve-close from any branch, so acting on the nudge no longer bounces on the branch guard.)

Complements [[IDEA-35]], which is the **CI/Scout → GitHub** direction (one-way: plan status drives the PR lifecycle, labels, and the merge→`done`+archive automation, explicitly inferring *no* state from GitHub). This idea is the **GitHub → dashboard** direction: the app *reads* live PR state and shows it, giving a visible, local path for the same review→done close when you're working in the dashboard rather than waiting on CI. The two meet at "merge closes the plan" — IDEA-35 does it automatically from CI, this makes the dashboard aware of it.

Open questions for the planning pass: **surface** — badge on the detail view only, or worklist rows too?; **auth/resolution** — rely on the `gh` CLI being installed and authed in the user's environment, or a configured GitHub token, and how to degrade when neither is present (this is a local-first tool that must work with no GitHub at all); **merge action** — auto-advance `review`→`done` vs a one-click nudge; and **freshness** — poll interval / cache TTL for PR state so the worklist stays cheap.
