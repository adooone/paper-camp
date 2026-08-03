---
id: IDEA-108
title: Surface a diverged main with a one-click agent fix
type: feat
status: review
created: 2026-07-30
updated: 2026-07-30
tags:
  - git
  - app
  - agent
subject: Infrastructure
---

Local `main` silently diverges from `origin/main` and stays that way until it bites. The cause is structural: bookkeeping commits (archive, run-order, task logs) land on local `main` and sit unpushed, while `origin/main` advances on its own — squash-merged PRs and release-please release commits. Once both sides hold a commit the other doesn't, you're split. Today nothing surfaces it — you find out in a terminal or when Sync fails, and it has recurred for over a week.

Don't auto-reconcile behind the user's back. Instead, make it a visible, one-click fix — the same shape the app already uses for a failing check:

- **Detect** the split: `main` (or the current branch) is both ahead of and behind its remote. The server already knows ahead/behind; expose "diverged" to the store.
- **Surface** it in the Stack panel's commit section, next to the git state — a short line like "main has diverged from origin (1 local, 1 remote)".
- **Fix** it with a link, mirroring "Suggested fix: run biome --write": a "Fix git issues" action that runs an agent to reconcile — reusing the deterministic rebase-then-agent-recovery job [[IDEA-94]] already built for sync failures (rebase local commits onto the remote; hand a conflict to the agent to resolve).

The reconcile machinery exists; this idea is the missing detection + surfacing + trigger so a split is caught early and fixed in one click, not left to rot.

### Phases
- [x] Compute divergence on the server
      Extend `git.ts`'s status to report behind count alongside ahead, and derive a `diverged` flag (both ahead of and behind the remote); expose it through `GET /api/git/status`.
- [x] Carry `diverged` (ahead/behind) into the git store slice
      Thread the new field through `git-api.ts` and the `gitAhead`/`gitBranchHygiene` neighbours in `app-store.ts`'s git slice.
- [x] Surface the split line in the Stack Commit section
      Render a short "main has diverged from origin (N local, N remote)" line next to the git state, matching the existing failing-check pattern.
- [x] Add the "Fix git issues" reconcile trigger
      Wire the surfaced line's action to the existing rebase-then-agent recovery job (`launch-reconcile` / [[IDEA-94]]), mirroring the "Suggested fix: run biome --write" affordance.
- [x] Type-check and full pass
