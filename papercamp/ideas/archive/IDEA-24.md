---
id: IDEA-24
title: Sync to main guard
type: feat
status: done
created: 2026-07-01
updated: 2026-07-01
tags:
  - git
  - branch
  - ux
---

The sync-to-main guard: a stale merged branch blocks new plan creation, with a Sync-to-main action covering the clean and dirty cases.

### Phases
- [x] Add branch-hygiene helpers to git.ts
      Add `isMergedIntoMain()` (using `git branch --merged main` + upstream-absence check) and a higher-level `getBranchHygieneStatus()` that returns a typed result distinguishing: clean-on-main, stale-merged, stale-no-upstream, dirty, or fine. Define the "merged & deleted" detection rule carefully so a never-pushed local branch is not treated as stale.
- [x] Extend the plan-start gate in api.ts
      In `checkBranchConflictForPlan` (or alongside it), call `getBranchHygieneStatus` and block plan creation/launch when the branch is stale, returning a structured error message: "You're on a merged branch — switch to main first." Decide during implementation whether this is a hard block or an overridable warning for intentional branch-stacking.
- [x] Add /api/git/sync route
      New POST endpoint that accepts `{ mode: 'clean' | 'dirty' }`. Clean mode: `git checkout main && git fetch --prune && git merge --ff-only origin/main` — all inline, no agent. Dirty mode: launch an agent task via `createAgentManager` with a prompt that stashes or commits stray changes, relocates any mis-filed drafts (e.g. content written to the legacy `papercamp/plans.md`), checks out main, fast-forwards, and confirms success; the agent must never `reset --hard` or `clean -fd` uncommitted work without an explicit confirmation step.
- [x] Add "Sync to main" button to stack-panel.tsx
      Place the button in the existing push/commit UI area. On click, read the already-loaded `loadGitStatus` result: if working tree is clean, call `/api/git/sync?mode=clean` inline and show a toast on success; if dirty, call `mode=dirty`, which fires an agent task visible in the activity feed. Disable the button when already on a clean main. Label and icon should be obvious at a glance — "Sync to main" with a merge/sync icon.
- [x] Wire hygiene status into the dashboard header or plan-start flow
      Surface the stale-branch state visually before the user even clicks "New plan" — e.g. a banner or a disabled state on the New Plan button with tooltip "Switch to main first." This makes the gate discoverable rather than just an error after the fact.
