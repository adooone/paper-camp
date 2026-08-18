---
id: IDEA-188
title: Fixes accumulate into one commit
type: feat
status: review
created: 2026-08-17
updated: 2026-08-17
tags:
  - agent
  - server
  - git
subject: Run & monitor
order: 10
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

### The single row that replaces the dozen

[[IDEA-151]] already turns a Deliver-form commit into a `source: manual` phase
row. That is the other half of this: once the fix queue stops committing, the
accumulated work is committed once — commit-suggest for the title, one manual
commit — and IDEA-151 records it as **one** row. So the dozen fix commits and
their dozen entries collapse into a single line describing what actually
changed. Nothing new is needed for that half; it already works.

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

### Phases
- [x] Gate the per-item commit on queue kind
      In `runQueue`, only call `onPhaseCommit` when `QueueKind === 'phase'`; the fix queue skips it and leaves work in the tree.
      run: 46s · 5.7k in · 1.5k out · sonnet-5
- [x] Keep the fix checkbox and run stamps persisting without a commit
      Verify the corpus write that flips the checkbox and appends run stamps still happens for fixes when no commit follows.
      run: 5m48s · 6.2k in · 5.2k out · sonnet-5
- [x] Confirm the Deliver-form manual commit collapses a fix pass into one row
      Run a multi-fix pass and check IDEA-151 records the single manual commit as one `source: manual` row.
      run: 1m24s · 294 in · 5.3k out · sonnet-5
- [x] Verify a fix pass leaves one accumulated diff and no per-fix commits
      run: 4m7s · 534 in · 7k out · sonnet-5

### Thread
- [ ] 2026-08-18 [question] [agent] Run-all parked on phase 2 ("Keep the fix checkbox and run stamps persisting without a commit") — project checks (test) are still failing after 2 fix attempt(s). Reply here with guidance to unblock and resume.
