---
id: IDEA-35
title: Mirror plans onto GitHub PRs
type: feat
status: done
created: 2026-07-04
updated: 2026-07-19
tags:
  - ci
  - github
  - plans
---

Scout (the GitHub App the CI workflows act as) is the one identity that can write to GitHub — PRs, labels, comments — from CI. Paper Camp already holds all the structured state (plan `status`, `phases`, `kind`, `tags`, and the `findConsistencyIssues`/audit checks). So Scout can make the **PR a live, self-maintaining view of the plan file** — its phases, labels, and checks — instead of something a human keeps in sync by hand. (Keeping *status* in sync is no longer part of this: [[IDEA-56]] derives status from the PR rather than writing it back, so this plan is purely plan → PR enrichment.)

**What Scout automates (each a small workflow acting as Scout, reusing `src/core`):**

1. **Phases → PR readiness.** When all of a plan's phases are checked (now *derived* `review`, per [[IDEA-56]]), flip its draft PR to *ready for review*; when the file carries the `dropped` override, close the PR. One-way, plan → PR. The reverse — marking a plan `done` when its PR merges — is deliberately **not** done here: [[IDEA-56]] derives `done` from the merged PR instead, so nothing is committed on merge.
2. **PR body = live plan.** Extend the draft-PR body (which already carries the "Plan: X" line) to render the plan's `### Phases` as a task-list checklist, and tick items as phases get checked off. The PR shows real progress at a glance.
3. **Auto-label PRs from the plan.** Apply labels from the plan's `kind` (feat/fix/…) and `tags` (ci/agent/plans/…) — reusing the same area vocabulary as the commit `scope-enum`, so PRs categorize themselves.
4. **Surface Paper Camp's own checks in the PR.** Post `findConsistencyIssues` results and/or the convergence-audit summary as a PR comment, so the structured checks sit alongside CI and CodeRabbit where review actually happens.

**Wiring:** mostly `workflow_run`/`pull_request`-triggered workflows that mint the Scout token (as `draft-pr.yml`/`release.yml` do) and call the plan parse/serialize/index helpers in `src/core`. The status→lifecycle piece needs the merge event and a plan-file writer; labels need `pull-requests: write` (Scout already has it).

**Related, deliberately out of scope here:** a two-way `open-questions.md` ↔ GitHub issues mirror (assignable questions, a `blocks` question linking to its PR) — noted in [[IDEA-36]]. Complements the git-commit auto-log in [[IDEA-30]] (that keeps `progress.md` in sync; this keeps the PR in sync).

Scout (the GitHub App behind the CI workflows) is the one identity that can write to GitHub from CI, and Paper Camp already holds all the structured state a PR could want: plan `status`, the `### Phases` checklist, `kind`, `tags`, and the `findConsistencyIssues`/convergence-audit checks. This plan enriches the PR *from* the plan file — the PR body renders the plan's phases as a task list, labels come from `kind`/`tags`, the draft→ready flip and the close-on-`dropped` follow the plan, and consistency checks post as a comment. It is strictly one-way, plan → PR. The status half of the old loop (merge → `done` + archive) is gone: [[IDEA-56]] *derives* status from the PR rather than writing it, so this plan no longer touches plan-file status at all.

The wiring reuses what exists: each piece is a small `pull_request`/`push`-triggered workflow that mints the Scout token the way `draft-pr.yml` already does and calls the frontmatter parser and the plan↔PR resolver in `src/core`. `draft-pr.yml` already stamps a `**Plan:** \`<ID>\`` line into every draft PR body, so resolving which plan a PR mirrors is a body/branch lookup, not new convention. Scout already has `pull-requests: write`, which is all this plan needs — with the merge→`done` write dropped, nothing here commits back to main, so no `contents: write` and no plan-file writes at all. The two-way `open-questions.md` ↔ issues mirror is deliberately out of scope here ([[IDEA-36]]), and the git-commit auto-log in [[IDEA-30]] complements this — that keeps `progress.md` in sync, this keeps the PR in sync.

### Phases
- [x] Build the plan↔PR resolver helper
      A small CLI entry in `src/` (invoked from workflows like the existing core consumers) that, given a PR number or branch, resolves the plan id from the `**Plan:**` line `draft-pr.yml` writes (falling back to the branch name), parses `papercamp/ideas/<ID>.md` with the `src/core` parser, and prints the fields the later phases need (`kind`, `tags`, phases with checked state). Every later phase calls this instead of re-implementing resolution.
- [x] Render plan phases as a PR task list
      On push to a plan branch, rewrite the plan section of the PR body to render `### Phases` as a GitHub task-list checklist, ticking items that are `- [x]` in the file, while preserving the existing `**Plan:**` line. Idempotent — re-running on an unchanged plan produces no edit.
- [x] Auto-label PRs from kind and tags
      Apply labels derived from the plan's `kind` (feat/fix/…) and `tags`, reusing the same area vocabulary as the commit `scope-enum` so PRs categorize themselves. Create missing labels idempotently; never remove labels a human added by hand.
- [x] Flip PR readiness from phases and the dropped override
      On push, when every phase is checked (derived `review`), flip the draft PR to ready for review; when the file carries the `dropped` override, close the PR. Read from the plan's phases and override via the resolver — one-way plan → PR, and it never writes plan status (marking `done` on merge is [[IDEA-56]]'s derivation, not a write here).
- [x] Post consistency checks as a PR comment
      Run `findConsistencyIssues` (and the convergence-audit summary where one exists for the plan) against the PR's branch and upsert a single sticky Scout comment with the results, so Paper Camp's structured checks sit alongside CI and CodeRabbit where review actually happens.
