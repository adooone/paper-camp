---
id: IDEA-182
title: Finish corpus writes before committing
type: fix
status: dropped
created: 2026-08-16
updated: 2026-08-16
tags:
  - server
  - agent
  - git
subject: Run & monitor
---

A commit should be the last thing that happens. Today it is not: every corpus
write schedules background work that lands *after* the commit meant to contain
it, so the tree is dirty again the moment a phase finishes.

### The race

`activity.ts` watches `papercamp/` recursively. Every raw event calls
`invalidateCorpusCache()` and `scheduleRunPass()`, which debounces **300ms**
before running `runRunOrderPass` — and that pass calls `writeRunOrderFile`.

Meanwhile `commitPhase` does `runBiomeFix` → `stageAll` → `commit` with nothing
in between waiting for that pass. So:

1. The agent writes `papercamp/ideas/IDEA-N.md` (a checked phase, a run stamp)
2. The watcher fires, arming a 300ms timer
3. `commitPhase` stages and commits — well inside 300ms
4. The timer fires and rewrites `run-order.md`
5. The tree is dirty again, *caused by the work that was just committed*

`index.md` drifts the same way through a different door: `regenerateIndexes` is
called by the API write routes (`routes/content/ideas.ts`,
`routes/content/plans.ts`, `routes/agent.ts`, `prioritise.ts`) after their entity
write, so any commit racing one of those misses the regenerated index.

Neither file is ever wrong for long — the next pass fixes it — but every commit
is followed by a diff nobody asked for, and a run-all produces one per phase.

### Flush before committing, not after

Expose a `flushCorpusWork(root)` on the activity manager: cancel the pending
debounce timer, run `runRunOrderPass` immediately, await any `inFlight` pass
(the `inFlight` / `rerunQueued` bookkeeping already exists), then
`regenerateIndexes`. It resolves only when no derived-file write is outstanding.

Every commit path awaits it before staging: `commitPhase`, `setRunReview`,
`commitCorpus`, and the manual Deliver commit. Staging then captures the derived
files in the same commit as the entity change that caused them, which is where
they belong — the run-order and index edits *are* part of "phase 3 is done".

### Nothing schedules work after a commit

The watcher fires on paper-camp's own writes as readily as on an editor's, so a
commit's own staging churn can re-arm the timer. Once the flush is in place the
pass has nothing left to do and writes nothing, so the loop terminates — but the
guarantee should be explicit: after `flushCorpusWork` returns and the commit
lands, a subsequent pass must be a no-op on an unchanged corpus.

`runRunOrderPass` already reconciles rather than blindly rewriting; confirm it
short-circuits when the reconciled list equals what is on disk, and that
`regenerateIndexes` does the same for `index.md`. A pass that rewrites identical
content still dirties the tree.

### Why not untrack them instead

`run-order.md` and `index.md` are generated, and paper-camp already gitignores
its other derived state — `pr-map.json`, `pr-reviews.json`, `tasks.log`.
Untracking would end this permanently.

Rejected: both are corpus content a clone is expected to carry. `index.md` is
the human-readable table of the corpus and `run-order.md` is the queue that
survives across machines — losing them from git means a fresh clone has no
worklist order and no index until something regenerates them. The problem is
*when* they are written, not *that* they are tracked.

### Out of scope

The local activity stream itself, and cache invalidation on raw events — that
must stay eager so a read racing a write never sees stale entries. This idea
changes only when derived **files** are written relative to a commit.

### Thread
- [x] 2026-08-16 [decision] [agent] Dropped: resolved by untracking instead of by flushing. `papercamp/ideas/index.md` and `papercamp/run-order.md` are now gitignored and `git rm --cached`'d, so the debounced `runRunOrderPass` and `regenerateIndexes` writes that used to land after a commit no longer touch anything git sees. Verified those two are the only background writers of tracked files: `regenerateIndexes` writes just `ideas/index.md`, `runRunOrderPass` just `run-order.md`. The accepted cost — a fresh clone rebuilds queue membership but not its ordering, which nothing can re-derive — was chosen deliberately over this idea's flush-before-commit design. Follow-through done in the same pass: the dead `GENERATED_CORPUS_FILES` list came out of `git.ts` (an ignored file never reaches `runGitStatus`), and its git.test.ts case was rewritten since the generated-file exception no longer exists.
