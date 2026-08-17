---
id: IDEA-188
title: Fixes accumulate into one commit
type: feat
status: idea
created: 2026-08-17
updated: 2026-08-17
tags:
  - agent
  - server
  - git
subject: Run & monitor
---

A fix pass commits once per fix, so a plan with a dozen follow-ups buries its
phase history under a dozen more commits. Fix work should accumulate and be
committed once, by hand.

### Where it comes from

`runQueue` in `agent.ts` calls `onPhaseCommit(plan, item, i, …)` **inside its
per-item loop**, and the same queue runs both kinds — `QueueKind = 'phase' | 'fix'`.
So a fix is committed exactly like a phase, one commit each.

[[IDEA-186]] is the evidence: **23 commits on one branch**, most of them a fix
apiece, with corpus bookkeeping (`docs(ideas): … — plan`, `feat(app): mark
IDEA-186 review`) interleaved between them. The phase history that actually
describes how the idea was built is unreadable inside that.

### Phases commit, fixes do not

Per-phase commits stay. A phase is a planned unit of work and its commit is the
record of that plan being executed — that is worth one commit each, and the
run-all queue depends on the tree being clean between phases.

A fix is a correction. It has no plan behind it, it is usually small, and a
handful of them are one editing session in intent. The fix queue stops calling
`onPhaseCommit`: the work accumulates in the working tree, the checkbox flips
and run stamps accumulate with it, and the human commits the lot from the
Deliver form when the pass is done — with one message describing what actually
changed rather than a dozen restating fix titles.

Only the call site changes; `commitPhase` itself is untouched and still serves
phases.

### The accepted risk

Uncommitted source across a fix pass is exposed to the destructive-git class of
failure [[IDEA-137]] documented — a stash that sweeps work nobody committed.
Two things already reduce it: phase prompts now forbid `git stash`/`reset`/
`checkout` over pre-existing state, and [[IDEA-176]] stops sync putting the
corpus in a stash. Neither covers uncommitted **source**, so the exposure is
real and accepted deliberately, the same way the untracked run-order was.

If it bites, the answer is a single commit at the end of the fix queue rather
than a return to per-fix commits.

### Also worth settling

The interleaved corpus commits are the other half of why the history reads
badly. They are [[IDEA-182]]'s territory, which was dropped in favour of
untracking — but `mark IDEA-186 review` and the plan commit still land between
work commits. Out of scope here; noted so the two are not confused.

### Out of scope

Phase commits, the commit-message format, and the run-all queue's clean-tree
requirement between phases.
