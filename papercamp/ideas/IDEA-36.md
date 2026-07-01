---
id: IDEA-36
title: Scheduled repo digest and nudges
---

## IDEA-36: Scheduled repo digest and nudges

Use Scout on a schedule (cron `workflow`s acting as the app) to make the repo proactively report on itself, so keeping the project moving doesn't depend on someone remembering to check. Paper Camp already computes everything needed — `findFocusPlan`, plan statuses, the audit-freshness signal, and `open-questions.md` — so these are thin workflows over `src/core` plus a Scout comment/issue.

**Digest.** A weekly (cron) workflow where Scout posts a self-issue summarizing project state: plans `in-progress`/`review`, plans overdue for a convergence audit (ties to [[IDEA-27]]'s freshness signal), and open questions still blocking a plan. A "standup" the repo writes to itself — zero effort, always current.

**Nudges.** When a plan sits in `review` for more than N days, Scout comments a reminder on its PR to *approve & close* (or drop it). Keeps `review` from becoming a graveyard, and reinforces that `done` only happens via the explicit approval step.

**Open-questions ↔ issues mirror (stretch).** Mirror `open-questions.md` entries as GitHub issues so questions become assignable and trackable in GitHub, and a question whose `blocks` points at a plan links to that plan's PR. Two-way sync is the harder part (source-of-truth conflicts); a one-way `open-questions.md` → issues push is the safe v1. This is the piece [[IDEA-35]] deliberately left out — it lands here because it's issue-centric like the digest.

**Wiring:** `on: schedule` (cron) workflows that mint the Scout token, read `src/core`, and post via `gh` — same pattern as `review.yml`. The issue-based pieces (digest, mirror) need `issues: write` added to Scout's GitHub App permissions; the PR nudge only needs `pull-requests: write` (already granted).
