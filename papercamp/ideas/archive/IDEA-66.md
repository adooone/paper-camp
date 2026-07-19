---
id: IDEA-66
title: Sync from a dirty merged branch
type: fix
status: done
created: 2026-07-16
updated: 2026-07-19
tags:
  - app
  - stack
  - git
  - ux
---

A merged branch with uncommitted changes has no way back to main from the app. The Commit card renders exactly one of three mutually exclusive states — changes → commit form, clean-and-ahead → Push, clean-and-level → Sync/Pull — so "Sync to main" is unreachable the moment the tree is dirty. The backend was built for exactly this case and the client half is dead code: `handleSync` already picks `mode: 'dirty'`, `/api/git/sync` accepts it, and the sync agent's prompt stashes-or-commits (never resets/cleans), checks out main, and ff-merges. Only the button is missing.

This state is common, not exotic: every agent run writes `papercamp/tasks.log` and `.task-logs/`, so a branch is almost never clean right after its PR merges. The server even names the situation — `getBranchHygieneStatus` returns `stale-merged` (merged into main AND main has advanced) and that check deliberately beats `dirty` — so the gate condition already exists on the client as `gitBranchHygiene`.

Show the escape hatch exactly when the branch is done: render a Sync button in the has-changes state, gated on `stale-merged`, reusing `handleSync` untouched. Gating matters — an ungated button in the commit form invites accidental mid-work syncs that stash half-finished work.

### Phases
- [x] Render a gated Sync in the changes view
      In `commit-section.tsx`'s has-changes branch, when `gitBranchHygiene === 'stale-merged'`, render a full-width Sync button (with the existing `syncError` alert) under the Commit button, calling the existing `handleSync` — which already resolves to `mode: 'dirty'` and launches the sync agent.
- [x] Gate and confirm the states
      `tsc --noEmit`, `biome check`, tests green; confirm by inspection that the clean states are untouched and the new button appears only when the tree is dirty AND hygiene is `stale-merged`.
- [x] Replace the commit controls instead of stacking under them
      On a merged branch, committing only strands more work off main — so when hygiene is `stale-merged`, the sync button takes the place of the suggest/title/message/Commit controls entirely (the changed-files list stays visible above). No disabled Commit button to explain; one action, the right one.
