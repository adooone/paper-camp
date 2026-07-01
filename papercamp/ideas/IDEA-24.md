---
id: IDEA-24
title: Sync to main before new plan
---

## IDEA-24: Sync to main before new plan

When you go to start a new plan, you're often still sitting on the *previous* feature branch — whose PR has already merged and whose remote branch was deleted. Nothing in the dashboard notices: today's only guard, `checkBranchConflictForPlan` (`src/app/server/api.ts`), reads the plan id out of the branch name (`getFeatureBranchPlanId`) and blocks a launch only while *that plan's status* is unfinished — it passes `done`/`dropped` straight through. So once the old plan is closed, you can draft and start working on top of a stale, already-merged branch, tangling the new feature into leftover local history. (Concretely: this just bit us — a draft agent wrote FEAT-25/FEAT-26 into the legacy `plans.md` while on a merged branch, and switching to main needed a manual stash → checkout → fast-forward → pop to recover.)

Two parts:

**1. Gate new plans on a clean, current `main`.** Before creating or launching a new plan, detect when the current branch is stale — merged into `main` and/or its upstream is gone (deleted after merge) — and refuse with a clear "switch to main first" message instead of proceeding. This is an extension of the existing branch-conflict guard, not a new system: add a helper in `git.ts` (alongside `getCurrentBranch`/`getFeatureBranchPlanId`/`hasUpstream`/`getAheadCount`) that reports branch hygiene — e.g. `isMergedIntoMain()` via `git branch --merged main` / `git cherry`, plus "upstream gone" detection — and have the plan-start path surface it.

**2. A "Sync to main" control in the Stack git section.** Next to the existing push/commit UI (`stack-panel.tsx`), add a button that:
- **Clean working tree →** checks out `main`, fast-forwards to `origin/main`, and prunes deleted remote branches (`git fetch --prune`). Pure git, no agent.
- **Dirty working tree →** can't switch safely, so delegate to an agent (the same `createAgentManager` path the other buttons use) to handle the local state deliberately: stash or commit stray changes, relocate any mis-placed drafts (e.g. plans written to legacy `plans.md` instead of the per-file `papercamp/plans/` dir), then switch to `main`, fast-forward, and set up the new feature branch. Essentially: automate the manual recovery dance, with the agent making the judgment calls a plain script can't.

**Wiring:** a new `/api/git/sync` route over the helpers above; the clean path runs inline, the dirty path launches an agent task surfaced in the activity feed like any other. The button's two modes key off the existing git-status the panel already loads (`loadGitStatus`).

**Open questions / guardrails:**
- Reliable "merged & deleted" detection: branch absent from `origin` *and* its commits contained in `main` — needs a definition that doesn't false-positive on a brand-new local branch that was simply never pushed.
- How aggressive the agent's "clear local git" mandate should be — it must never hard-discard uncommitted work without an explicit confirmation step; "safely clear" means stash/commit, not `reset --hard`/`clean -fd` by default.
- Whether the gate is a hard block or a warning with an override, for the case where the user deliberately wants to stack a new plan on an unmerged branch.
