---
id: IDEA-57
title: Drive PR review fixes from the app
type: feat
created: 2026-07-10
tags:
  - app
  - github
  - plans
  - agent
---

Working a plan through review still means babysitting a chat session: open the PR, read the CodeRabbit/human comments, decide, edit, re-run checks, repeat. Yet the app already holds the plan↔PR mapping ([[IDEA-56]] resolves every PR to its entity) and already launches headless agent jobs (run-all-phases, reconcile, audit) with visible status. Review is the one loop still done entirely by hand in chat. Make the app the control surface for it: pull the PR's review state in, and launch a fix job out — so a work session is "click the next action on the focus plan," not "compose another prompt."

- **Track review state per PR.** Extend the PR resolver (`resolvePrsByEntity` in `src/core/pr.ts`) to also carry review signal: the PR's review decision (approved / changes-requested / review-required), the count of unresolved review threads, and whether new comments have landed since the last agent pass. Surface it on the plan card next to the existing `PrBadge` — "3 unaddressed comments" visible in the worklist, so a reviewed-but-not-fixed PR stops being invisible until you open GitHub.
- **Launch a "fix review comments" job from the app.** A per-plan action (sibling to run-all-phases) that fetches the PR's unresolved review threads via `gh api`, hands them plus the plan context to a headless agent through the existing launch plumbing and a new `prompts.ts` builder, and lets it address the comments on the plan's own branch and push. Reuse `agent.ts`'s progress/done detection. v1 reads review state and fixes locally; writing back to GitHub (resolving threads, replying) is a deliberate stretch.
- **Minimize chat — the app is the task queue.** Generalize the pattern: the recurring agent tasks (draft, run phases, reconcile, audit, fix-review) all become app-initiated jobs with visible status, so most agent work is dispatched from the dashboard rather than typed into a chat. This is the interactive, on-demand counterpart to the CI/cron automation — it belongs in the app, not a workflow.

Deliberately distinct from the neighboring GitHub ideas: [[IDEA-35]] enriches the PR *from* the plan (one-way plan → PR, Scout-in-CI) and [[IDEA-36]] posts scheduled digests/nudges (cron). This idea is the other direction — PR review state → app → agent — driven interactively from the dashboard. It hangs review-state fetching off [[IDEA-56]]'s resolver, would live in [[IDEA-39]]'s focus cockpit as another ambient action, and follows [[IDEA-55]]'s per-entity job-queue pattern.

### Phases
- [x] Carry review signal in the PR resolver
      Extend `resolvePrsByEntity` (`src/core/pr.ts`) to also return the PR's review decision (approved / changes-requested / review-required), the count of unresolved review threads, and whether comments have landed since the last agent pass — folded into the existing `gh pr list` worklist pass where possible, adding a `gh api` thread query only where the list can't supply it.
- [x] Surface review state on the plan card
      Render the new signal next to the existing `PrBadge` on `PlanCard` — e.g. "3 unaddressed comments" — so a reviewed-but-not-fixed PR is visible in the worklist without opening GitHub. Thread it through the API/store shape the card reads.
- [x] Add the fix-review prompt builder
      A new builder in `prompts.ts` that takes the PR's unresolved threads plus the plan context and produces the agent prompt to address them on the plan's branch, with a `prompts.test.ts` case covering thread rendering and the empty-threads guard.
- [ ] Launch a "fix review comments" job
      A per-plan action sibling to run-all-phases: a `POST /api/agent/launch-fix-review` route that fetches unresolved threads via `gh api`, hands them and the plan context to the headless agent through the existing launch plumbing, and lets it fix and push on the plan's own branch. Reuse `agent.ts`'s progress/done detection; wire the button through `agent-api.ts` and the store's `launch*` actions.
- [ ] Generalize the dashboard job queue
      Fold fix-review into the shared recurring-task pattern (draft, run phases, reconcile, audit) so all agent work dispatches from the dashboard with visible Stack-panel status rather than a typed chat prompt — the on-demand counterpart to the CI/cron automation.
- [ ] Type-check and verification pass
      `tsc --noEmit`, `biome check`, and `vitest run` clean; smoke the resolver against a live PR with open review threads. Writing back to GitHub (resolving threads, replying) stays out of v1 as a deliberate stretch.
