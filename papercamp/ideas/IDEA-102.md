---
id: IDEA-102
title: Agent resolves sync-rebase conflicts
type: feat
status: idea
created: 2026-07-28
updated: 2026-07-28
tags:
  - git
  - app
  - agent
  - server
---

The sync/pull flow now reconciles a diverged `main` by rebasing local commits onto `origin/main` instead of failing fast-forward-only (`reconcileOnto` in `src/app/server/git.ts`). When the rebase applies cleanly — or the conflict is in an append-only file like `papercamp/tasks.log` (handled by the `merge=union` driver in `.gitattributes`) — the split repairs itself silently. But a genuine content conflict (e.g. two independent edits to `papercamp/run-order.md`) still aborts the rebase and surfaces an error for the human to resolve at the CLI.

Close that last gap: when `reconcileOnto` aborts on a conflict, offer to hand it to the AI agent — a task kind sibling to `reconcile`/`fix-review` (`agent.runReconcile` and friends in `src/app/server/agent.ts`) that reads the conflicted files, resolves the markers with the same domain judgement a human would (drop finished items from `run-order.md`, union the logs), stages them, and continues the rebase. Surface it as a one-click "Ask the agent to resolve" on the sync-failed toast rather than an automatic run, so a bad auto-merge never lands unseen.

Follow-up to the trunk-style sync work (rebase reconcile + auto-push after commit): the workflow commits on `main` directly and wants divergence repaired automatically, with the agent as the fallback when it can't be done mechanically.

### Phases
- [x] Surface the conflict from `reconcileOnto`
      On a rebase abort, capture the conflicted file list and expose a "conflicted" sync-failure state to the store instead of a bare error.
- [x] Add a `resolve-conflict` agent task kind
      A sibling to `reconcile`/`fix-review` in `src/app/server/agent.ts` that runs against the paused rebase.
- [ ] Prompt the agent to resolve, stage, and continue
      Feed the conflicted files and their markers; instruct the domain judgement (drop finished items from `run-order.md`, union the logs), then `git add` and `git rebase --continue`; abort cleanly on failure.
- [ ] Wire the one-click "Ask the agent to resolve" on the sync-failed toast
      Trigger the task from the toast, not automatically, and reflect its progress/result so a bad merge never lands unseen.
- [ ] Type-check and full pass
