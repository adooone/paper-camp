---
id: IDEA-36
title: Schedule repo digest and nudges
type: feat
created: 2026-07-04
tags:
  - ci
  - github
  - agent
---

Use Scout on a schedule (cron `workflow`s acting as the app) to make the repo proactively report on itself, so keeping the project moving doesn't depend on someone remembering to check. Paper Camp already computes everything needed — `findFocusPlan`, plan statuses, the audit-freshness signal, and `open-questions.md` — so these are thin workflows over `src/core` plus a Scout comment/issue.

**Digest.** A weekly (cron) workflow where Scout posts a self-issue summarizing project state: plans `in-progress`/`review`, plans overdue for a convergence audit (ties to [[IDEA-27]]'s freshness signal), and open questions still blocking a plan. A "standup" the repo writes to itself — zero effort, always current.

**Nudges.** When a plan sits in `review` for more than N days, Scout comments a reminder on its PR to *approve & close* (or drop it). Keeps `review` from becoming a graveyard, and reinforces that `done` only happens via the explicit approval step.

**Open-questions ↔ issues mirror (stretch).** Mirror `open-questions.md` entries as GitHub issues so questions become assignable and trackable in GitHub, and a question whose `blocks` points at a plan links to that plan's PR. Two-way sync is the harder part (source-of-truth conflicts); a one-way `open-questions.md` → issues push is the safe v1. This is the piece [[IDEA-35]] deliberately left out — it lands here because it's issue-centric like the digest.

**Wiring:** `on: schedule` (cron) workflows that mint the Scout token, read `src/core`, and post via `gh` — same token-minting pattern as `draft-pr.yml`. The issue-based pieces (digest, mirror) need `issues: write` added to Scout's GitHub App permissions; the PR nudge only needs `pull-requests: write` (already granted).

Paper Camp already computes everything a project standup needs — plan statuses, `findFocusPlan`, the content-hash audit-freshness signal ([[IDEA-27]]), and `open-questions.md` — but surfacing any of it still depends on someone opening the dashboard. This plan adds `on: schedule` (cron) workflows where Scout makes the repo report on itself: a weekly digest issue summarizing project state (plans `in-progress`/`review`, plans overdue for a convergence audit, open questions still blocking a plan), and a nudge comment on any PR whose plan has sat in `review` for more than N days, reminding the human to approve & close or drop it — keeping `review` from becoming a graveyard and reinforcing that `done` only happens via the explicit approval step. As a stretch, a one-way `open-questions.md` → GitHub issues mirror makes questions assignable and trackable; two-way sync is deliberately out (source-of-truth conflicts), and the per-PR mirroring of plan state is [[IDEA-35]]'s scope, not this plan's — this one owns the scheduled, issue-centric side.

The wiring is thin: each piece is a cron workflow that mints the Scout token the way `draft-pr.yml` already does, calls a small `src/` CLI entry over the `src/core` helpers to compute its payload, and posts via `gh`. The nudge resolves a plan's PR through the same `**Plan:** \`<ID>\`` body convention IDEA-35's resolver formalizes, so it should reuse that helper once it lands rather than reimplement the lookup. The issue-based pieces (digest, mirror) need `issues: write` added to Scout's GitHub App permissions — a human step in the App settings, since agents can't change it — while the PR nudge only needs the `pull-requests: write` Scout already has.

### Phases
- [ ] Build the digest snapshot helper
      A CLI entry in `src/` (invoked from workflows like the existing core consumers) that reads `papercamp/` via `src/core` — plan statuses, `findFocusPlan`, the audit-freshness signal, and parsed `open-questions.md` — and prints the digest payload: plans `in-progress`/`review` (with days in status), plans overdue for a convergence audit, and open questions whose `blocks` points at a live plan. Pure read/print, no GitHub calls, so it's testable offline.
- [ ] Grant Scout issues write access
      Add `issues: write` to the Scout GitHub App's permissions (a human step in the App settings — flag it, don't fake it) and to the token mint in the new workflows. Verify with a dry-run `gh issue list` call as Scout before the digest workflow depends on it; the nudge phase needs only the `pull-requests: write` already granted.
- [ ] Post the weekly digest issue
      A weekly cron workflow that mints the Scout token like `draft-pr.yml`, runs the snapshot helper, and renders the payload as a self-issue titled by date. Keep it one sticky issue per week (skip or update if the run repeats), label it (e.g. `digest`) so digests are filterable, and close the previous week's digest issue when posting a new one.
- [ ] Nudge stale review PRs
      A daily cron workflow that finds plans in `review` longer than N days (threshold as a workflow env var, default ~5), resolves each plan's PR via the `**Plan:**` body line (reusing IDEA-35's resolver helper if it has landed), and comments a reminder to approve & close or drop. Idempotent — upsert one sticky Scout comment per PR rather than stacking a new nudge every day.
- [ ] Mirror open questions to issues
      Stretch: a one-way push in the same cron pass — each open entry in `open-questions.md` becomes or updates a labeled GitHub issue, a question whose `blocks` names a plan links that plan's PR, and a question that goes `resolved` in the file closes its issue. The file stays the single source of truth; issue-side edits are never synced back.
