---
id: IDEA-35
title: Scout ↔ GitHub plan sync
---

## IDEA-35: Scout ↔ GitHub plan sync

Scout (the GitHub App the CI workflows act as) is the one identity that can write to GitHub — PRs, labels, comments — from CI. Paper Camp already holds all the structured state (plan `status`, `phases`, `kind`, `tags`, and the `findConsistencyIssues`/audit checks). So Scout can make the **GitHub side a live mirror of the plan file**, turning the methodology's bookkeeping into automation instead of manual habit. This is the highest-leverage Scout use because it removes the exact "index/status is stale" drift that keeps generating review nits.

**What Scout automates (each a small workflow acting as Scout, reusing `src/core`):**

1. **Plan status → PR lifecycle.** When a plan reaches `review` (all phases done), flip its draft PR to *ready for review*. When the PR merges, set the plan `done`, archive the file (`archivePlanFile`), and regenerate the index — so status is never hand-edited. When a plan goes `dropped`, close the PR. The plan file stays the single source of truth; GitHub follows it.
2. **PR body = live plan.** Extend the draft-PR body (which already carries the "Plan: X" line) to render the plan's `### Phases` as a task-list checklist, and tick items as phases get checked off. The PR shows real progress at a glance.
3. **Auto-label PRs from the plan.** Apply labels from the plan's `kind` (feat/fix/…) and `tags` (ci/agent/plans/…) — reusing the same area vocabulary as the commit `scope-enum`, so PRs categorize themselves.
4. **Surface Paper Camp's own checks in the PR.** Post `findConsistencyIssues` results and/or the convergence-audit summary as a PR comment, so the structured checks sit alongside CI and CodeRabbit where review actually happens.

**Wiring:** mostly `workflow_run`/`pull_request`-triggered workflows that mint the Scout token (as `draft-pr.yml`/`review.yml` do) and call the plan parse/serialize/index helpers in `src/core`. The status→lifecycle piece needs the merge event and a plan-file writer; labels need `pull-requests: write` (Scout already has it).

**Related, deliberately out of scope here:** a two-way `open-questions.md` ↔ GitHub issues mirror (assignable questions, a `blocks` question linking to its PR) — noted in [[IDEA-36]]. Complements the git-commit auto-log in [[IDEA-30]] (that keeps `progress.md` in sync; this keeps the PR in sync).
