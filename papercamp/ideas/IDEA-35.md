---
id: IDEA-35
title: Mirror plans onto GitHub PRs
type: feat
status: planned
created: 2026-07-04
updated: 2026-07-04
tags:
  - ci
  - github
  - plans
---

Scout (the GitHub App the CI workflows act as) is the one identity that can write to GitHub — PRs, labels, comments — from CI. Paper Camp already holds all the structured state (plan `status`, `phases`, `kind`, `tags`, and the `findConsistencyIssues`/audit checks). So Scout can make the **GitHub side a live mirror of the plan file**, turning the methodology's bookkeeping into automation instead of manual habit. This is the highest-leverage Scout use because it removes the exact "index/status is stale" drift that keeps generating review nits.

**What Scout automates (each a small workflow acting as Scout, reusing `src/core`):**

1. **Plan status → PR lifecycle.** When a plan reaches `review` (all phases done), flip its draft PR to *ready for review*. When the PR merges, set the plan `done`, archive the file (`archivePlanFile`), and regenerate the index — so status is never hand-edited. When a plan goes `dropped`, close the PR. The plan file stays the single source of truth; GitHub follows it.
2. **PR body = live plan.** Extend the draft-PR body (which already carries the "Plan: X" line) to render the plan's `### Phases` as a task-list checklist, and tick items as phases get checked off. The PR shows real progress at a glance.
3. **Auto-label PRs from the plan.** Apply labels from the plan's `kind` (feat/fix/…) and `tags` (ci/agent/plans/…) — reusing the same area vocabulary as the commit `scope-enum`, so PRs categorize themselves.
4. **Surface Paper Camp's own checks in the PR.** Post `findConsistencyIssues` results and/or the convergence-audit summary as a PR comment, so the structured checks sit alongside CI and CodeRabbit where review actually happens.

**Wiring:** mostly `workflow_run`/`pull_request`-triggered workflows that mint the Scout token (as `draft-pr.yml`/`release.yml` do) and call the plan parse/serialize/index helpers in `src/core`. The status→lifecycle piece needs the merge event and a plan-file writer; labels need `pull-requests: write` (Scout already has it).

**Related, deliberately out of scope here:** a two-way `open-questions.md` ↔ GitHub issues mirror (assignable questions, a `blocks` question linking to its PR) — noted in [[IDEA-36]]. Complements the git-commit auto-log in [[IDEA-30]] (that keeps `progress.md` in sync; this keeps the PR in sync).

Scout (the GitHub App behind the CI workflows) is the one identity that can write to GitHub from CI, and Paper Camp already holds all the structured state a PR could want: plan `status`, the `### Phases` checklist, `kind`, `tags`, and the `findConsistencyIssues`/convergence-audit checks. This plan makes the GitHub side a live mirror of the plan file — the PR body renders the plan's phases as a task list, labels come from `kind`/`tags`, the draft→ready→merged lifecycle follows plan `status`, and merge closes the loop by marking the plan `done` and archiving it via `archivePlanFile`. The plan file stays the single source of truth; GitHub follows it, which removes exactly the "status/index is stale" drift that keeps generating review nits.

The wiring reuses what exists: each piece is a small `pull_request`/`push`-triggered workflow that mints the Scout token the way `draft-pr.yml` already does and calls the parse/serialize/index helpers in `src/core` (`archivePlanFile`, `formatPlansIndex`, the frontmatter parser). `draft-pr.yml` already stamps a `**Plan:** \`<ID>\`` line into every draft PR body, so resolving which plan a PR mirrors is a body/branch lookup, not new convention. Scout already has `pull-requests: write`; only the merge→archive phase needs `contents: write` added to its token mint so Scout can commit the plan-file change back to main. The two-way `open-questions.md` ↔ issues mirror is deliberately out of scope here ([[IDEA-36]]), and the git-commit auto-log in [[IDEA-30]] complements this — that keeps `progress.md` in sync, this keeps the PR in sync.

### Phases
- [ ] Build the plan↔PR resolver helper
      A small CLI entry in `src/` (invoked from workflows like the existing core consumers) that, given a PR number or branch, resolves the plan id from the `**Plan:**` line `draft-pr.yml` writes (falling back to the branch name), parses `papercamp/plans/<ID>.md` with the `src/core` parser, and prints the fields the later phases need (`status`, `kind`, `tags`, phases with checked state). Every later phase calls this instead of re-implementing resolution.
- [ ] Render plan phases as a PR task list
      On push to a plan branch, rewrite the plan section of the PR body to render `### Phases` as a GitHub task-list checklist, ticking items that are `- [x]` in the file, while preserving the existing `**Plan:**` line. Idempotent — re-running on an unchanged plan produces no edit.
- [ ] Auto-label PRs from kind and tags
      Apply labels derived from the plan's `kind` (feat/fix/…) and `tags`, reusing the same area vocabulary as the commit `scope-enum` so PRs categorize themselves. Create missing labels idempotently; never remove labels a human added by hand.
- [ ] Drive PR lifecycle from plan status
      When a push brings the plan to `review` (all phases checked), flip the draft PR to ready for review; when the plan goes `dropped`, close the PR. Status is read from frontmatter via the resolver — no state is inferred from GitHub itself.
- [ ] Close the loop on merge
      On the `pull_request` closed-and-merged event, set the plan's `status` to `done`, archive it with `archivePlanFile`, regenerate the index with `formatPlansIndex`, and commit the result to main as Scout. This is the one phase that needs `contents: write` on the Scout token mint (currently `read` in `draft-pr.yml`) — grant it only in this workflow.
- [ ] Post consistency checks as a PR comment
      Run `findConsistencyIssues` (and the convergence-audit summary where one exists for the plan) against the PR's branch and upsert a single sticky Scout comment with the results, so Paper Camp's structured checks sit alongside CI and CodeRabbit where review actually happens.
