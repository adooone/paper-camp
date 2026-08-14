---
id: IDEA-171
title: Run-all redoes work from a stale base
type: fix
status: idea
created: 2026-08-14
updated: 2026-08-14
tags:
  - agent
  - plans
  - git
subject: Run & monitor
---

A plan's completion state lives in its entity file, which is branch-local. So
run-all launched on a branch forked before that plan's work landed elsewhere
sees unchecked phases and redoes all of them — correctly, from its own view,
and invisibly to the person who already ran it.

### What happened (2026-08-13, [[IDEA-137]])

- `19:55` `2bbd974` lands on `main`; `origin/main` tip is now this commit.
- `20:13–20:26` run-all executes IDEA-137 **on `main`**, producing five commits
  and checking all four phases in `papercamp/ideas/IDEA-137.md`. These commits
  are never pushed, so `origin/main` stays at `2bbd974`.
- `21:26` branch `fix/idea-137-durable-drafted-plans` is created, forked from
  `2bbd974` — *before* the run. At that fork point IDEA-137's phases are still
  `- [ ]`.
- `21:30–21:41` run-all executes IDEA-137 **again**, on the branch. It sees four
  unchecked phases and runs them. Nothing is wrong from its perspective.
- `06:31` next morning, PR #152 squash-merges the branch version.

The result was two independent implementations of the same idea. They differed:
the branch version factored the destructive-git rule into a `DESTRUCTIVE_GIT_BAN`
const, wired the corpus commit through `hooks.commitCorpus`, added an
`isSuperseded` guard, and passed `{ noVerify: true }` — which the `main` version
omitted, a real bug for a machine-generated commit. The `main` run's five commits
were discarded by hand afterwards.

How the fork point came to be stale is not determinable from the evidence and is
not what this idea fixes. `ensureBranch` forks from current `HEAD`, so any branch
created while `HEAD` sits behind local `main` inherits stale corpus state — that
is enough for the bug class to recur.

### The guard

Before run-all starts, compare the plan's phase state on the current branch
against the same entity on local `main` and on `origin/main`. If either shows
phases checked that the current branch shows unchecked, **refuse to start** and
say so: *"IDEA-137 already has 4/4 phases complete on main. This branch is
forked from before that work — rebase or switch branches."*

This is a local `git show <ref>:papercamp/ideas/<ID>.md` read, cheap, and needs
no GitHub lookup. It is deliberately not gated on PR state: at 21:26 the PR was
open, not merged, so a merged-PR check would not have caught this.

Refuse rather than warn. The failure is silent and expensive — an hour of agent
runs plus a manual git cleanup — and the two escapes (rebase the branch, or run
from the branch that already has the work) are both quick.

Same check on `ensureBranch`: creating a plan's branch while `HEAD` is behind
local `main` warns before the branch exists, which is the cheaper moment to
catch it.

### Out of scope

Auto-rebasing the branch or auto-reconciling a diverged `main` — this detects
and refuses, the human chooses the fix ([[IDEA-108]] owns surfacing divergence).
Detecting duplicate work already committed under two different SHAs after the
fact; this is a pre-flight guard only.

### Phases
- [ ] Read phase state at a git ref
      Add a helper that runs `git show <ref>:papercamp/ideas/<ID>.md` and returns the checked/unchecked count, tolerating a missing entity at that ref.
- [ ] Compare current branch against main and origin/main
      Flag staleness when either ref shows phases checked that the current branch shows unchecked; return the offending ref and its count for the message.
- [ ] Refuse run-all on a stale base
      Run the comparison before run-all starts and abort with the "already N/N complete on main — rebase or switch branches" message.
- [ ] Warn on ensureBranch when HEAD is behind
      Run the same comparison before creating a plan's branch and warn while the branch does not yet exist.
- [ ] Cover the guard with tests
