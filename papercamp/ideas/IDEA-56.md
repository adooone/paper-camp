---
id: IDEA-56
title: Derive status from git and PR state
type: feat
status: dropped
created: 2026-07-08
updated: 2026-07-09
tags:
  - app
  - github
  - plans
  - core
---

Absorbed into [[IDEA-72]] (display-time effective status + one-click archive) — same thesis, narrower and shippable; this file stays as the original reasoning.

Status is a stored frontmatter field, so keeping it honest means writing files: a plan reaching review, a branch being cut, the PR merging — each is a hand edit or an agent/CI commit, and the classic failure is drift (the index says `in-progress`, the file says `review`, the PR is already merged, and nobody updated anything). [[IDEA-35]] and the first cut of this idea both tried to *sync* the stored field from GitHub, which still means a commit on every merge. The better move is to stop storing the lifecycle status at all and **derive it from signals that already exist** — the phases, the branch, and the PR — so it can't go stale because there's nothing to keep in sync.

Derivation ladder, each rung a pure function of observable state:

- **idea** — no plan yet (no `### Phases`).
- **planned** — has phases, no branch.
- **in-progress** — a branch for the entity exists (matched by the `feat/idea-N-…` naming convention `branchEntityId` already parses). Branch *existence*, not "is it checked out": status must read the same on every clone, so "is it the current branch" stays a purely-local signal that only drives the active-plan highlight.
- **review** — the branch exists and every phase is checked.
- **done** — the entity's PR is merged, read from a live GitHub lookup (`gh`/API) and cached, so nothing is written on merge. A squash-merge deletes the branch and drops its commits from `main`'s history, so GitHub is the only reliable "was this merged" source.

Two things reality can't express, which keep a *minimal stored override*: **dropped** (abandonment leaves no branch and no merge) and closing a **planless idea or `note`** that never gets a branch or PR. This is a local-first tool, so that override doubles as the **offline / no-GitHub fallback**: with git but no GitHub, idea→review still derive locally and `done` falls back to the stored marker; with no git at all, everything falls back to stored. So `status:` doesn't disappear — it demotes from source-of-truth to override-plus-fallback.

The visible face is the **PR badge** from this idea's first cut: a GitHub-icon label showing the PR number and state (draft / open / merged) that links out — now the surface of the *derived* review/done rather than a separate merge nudge.

This reshapes more than a badge. `entityFrontmatterSchema`'s `status` becomes an optional override, `readEntities`/`entityToPlan` compute the derived value, the index is fully generated from it, and the worklist grouping, filters, and branch-guards all read derived status. It revises logged decisions ("Status: review is the human gate" — review now *is* all-phases-checked; done *is* merged) and moots [[IDEA-35]]'s merge→`done`+archive phase. It also questions `archive/`: if done is derived, moving a file there is itself a needless commit — done entities could just render as done wherever they sit.

Open questions for the planning pass: **PR resolution + auth** — resolve the PR from the branch / the `**Plan:**` line via `gh` CLI vs a configured token, and how to degrade cleanly when neither is present; **freshness** — cache TTL / refresh trigger for PR state so the worklist stays cheap; **override editing** — how `dropped` / manual-close is set now that `status` isn't the primary field; **archive** — keep the `archive/` move (a commit) or derive "archived-ness" too; and **migration** — the ~55 existing entities carry a stored `status:` that becomes an override, so decide which to clear versus keep.

### Phases
- [x] Turn `status` into an optional override in the schema
      Make `status` optional in `entityFrontmatterSchema`, narrowing its stored meaning to the un-derivable values (`dropped`, and closing a planless idea / `note`) plus the offline fallback. Nothing else derives yet — this just stops requiring the field and keeps existing values parsing.
- [x] Derive idea → review locally from phases and branch existence
      Add a pure `deriveStatus` helper walking the ladder from observable state: `idea` (no `### Phases`), `planned` (phases, no branch), `in-progress` (a `feat/idea-N-…` branch exists via `branchEntityId`), `review` (branch + all phases checked). Keep "is it the current branch" separate as the local active-plan highlight only. Wire it into `readEntities`/`entityToPlan` for these four rungs, falling back to the stored override when git is absent.
- [x] Resolve and cache the PR to derive `done`
      Resolve each entity's PR from its branch / `**Plan:**` line via `gh` CLI or a configured token, read merged-state from the live lookup, and cache it with a TTL so the worklist stays cheap. `done` = PR merged; degrade to the stored marker when GitHub is unreachable, so idea→review still derive locally offline.
- [x] Rebuild the index, worklist, and branch-guards on derived status
      Regenerate the index fully from the derived value and point worklist grouping, filters, and the branch-guards at derived status instead of the stored field, so nothing reads the demoted `status:` as source-of-truth.
- [x] Surface the PR badge and the override editor in the UI
      Render the GitHub-icon PR badge (number + draft/open/merged, linking out) as the visible face of derived review/done, and give the UI a way to set the `dropped` / manual-close override now that `status:` isn't the primary field.
- [x] Migrate stored statuses and settle `archive/`
      Sweep the ~55 existing entities: clear stored `status:` values that now derive cleanly, keep only the ones that must stay as overrides. Decide whether `archive/` survives — moving a done file there is itself a commit, so either drop the move or derive "archived-ness" too — and update the logged decisions the derivation revises.
- [x] Type-check and full pass
      `tsc` and `biome` clean, tests updated for the derived-status paths and the offline fallback.
