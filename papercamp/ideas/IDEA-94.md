---
id: IDEA-94
title: Git actions in the toolbar, agent as fallback
type: feat
status: idea
created: 2026-07-26
updated: 2026-07-29
tags:
  - git
  - app
  - agents
subject: Infrastructure
---

Git is central to the loop but nearly invisible in the app: the only git actions live inside the Stack panel's `commit-section.tsx`, and the StatusBar shows branch and ahead-count as ambient status with a single quick-commit. Sync to main, branch switching, push and pull have no visible home at all — you either dig into the Stack or drop to a terminal, which is exactly what this tool exists to avoid.

**Surface the actions.** Give git a proper action group in the top toolbar: sync to main, push/pull, commit — visible where the work happens, with live state (current branch, ahead/behind, dirty count) attached to the control rather than buried. The Stack panel keeps the detailed commit composer; the toolbar carries the everyday verbs.

**Deterministic first, agent as fallback — never stuck.** Switching to main must always succeed or explain itself. Attempt it in code first, exactly as today: fetch, drop disposable local changes (content already identical to `origin/main`, and generated files like `papercamp/ideas/index.md` that `regenerateIndexes` rebuilds), stash the rest, `merge --ff-only` (falling back to `rebase` when diverged), pop. That path is fast, predictable, and covers the common case.

But when it hits something the deterministic path cannot resolve — a stash that will not pop, files that already exist where the switch wants to write, a rebase conflict on a diverged branch, or any other failure — do not throw the error at the user and stop. Hand the switch to an agent as a job: give it the failure, the working-tree state, and the goal ("get onto the latest main without losing real work"), and let it resolve the mess with judgment. The user's outcome is "I am on latest main", not "here is a git error to go fix by hand".

This follows the house split [[IDEA-67]] settled — deterministic file ops, judgment for agents — and extends it: the deterministic attempt is the fast path, the agent is the recovery path, and the escalation is automatic rather than a separate button. Builds on [[IDEA-24]] (sync guard) and [[IDEA-66]] (sync from a dirty merged branch), both of which handled slices of this by hand.

Worth deciding in the plan: whether the agent escalation asks for confirmation before running (it can discard or rewrite working-tree state) or runs automatically and reports what it did; and whether the same escalate-on-failure shape should wrap push and pull too, or stay scoped to the branch switch first.

Provenance: surfaced 2026-07-25 when Sync to main silently did nothing — the stash popped back over the merged files and aborted the whole sync, leaving main behind with no error visible in the UI. The deterministic drop-disposable-changes fix landed that day; the escalation path is what would have made it self-healing instead of silent.

### Phases
- [x] Expose push / pull as server git actions
      Extend `src/app/server/git.ts` and its routes so push and pull are callable actions returning live state (current branch, ahead/behind, dirty count), reusing the existing sync-to-main path rather than adding a parallel one.
- [x] Build the git action group in the top toolbar
      Add a toolbar group with sync-to-main, push/pull, and commit verbs, each carrying its live state on the control; leave the detailed commit composer in the Stack panel.
- [ ] Keep the deterministic sync as the fast path
      Confirm the code-first attempt (fetch, drop disposable/generated changes, stash, `merge --ff-only` falling back to `rebase` when diverged, pop) runs first and unchanged, and returns a structured failure instead of throwing to the UI when it cannot resolve.
- [ ] Package a deterministic-sync failure as an agent recovery job
      When the fast path fails, assemble the failure, the working-tree state, and the goal ("get onto latest main without losing real work") into an agent job spec.
- [ ] Run the recovery agent and report the outcome
      Launch the job and surface what it did; settle whether it asks for confirmation before touching working-tree state or runs automatically and reports after.
- [ ] Decide whether push/pull share the escalate-on-failure shape
      Settle whether the automatic deterministic→agent escalation wraps push and pull too, or stays scoped to the branch switch for this cut.
- [ ] Type-check and full pass

### Log
- 2026-07-29: I think changes in branch would be hard to maintain, I would keep our current approach for now, so please remove branch edits from this idea and plan.
- 2026-07-29: Also to clean up the space in the toolbar we need to remove current 3 actions in right side - commit, run tests, fix quality as we already have this in the Stack panel
