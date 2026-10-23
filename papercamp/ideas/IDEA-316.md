---
id: IDEA-316
title: Leftovers from the fix review
type: fix
status: planned
created: 2026-10-23
tags:
  - app
  - server
  - core
  - git
subject: Code health
---

A review of IDEA-309, 313, 314 and 315 on HEAD found every phase delivered
and the suite green, with the gaps below. Each item names the gap and the
fix.

**`markRead` rejections go nowhere.** IDEA-315 made `markRead` roll back and
rethrow, but `use-activity-entry-page.ts:26` calls it fire-and-forget, so a
failed POST is an unhandled promise rejection, and `markAllRead` in
`use-activity-page.ts:72` awaits each id in a loop, so one failure stops the
rest with no toast. The entry page catches and shows the *Failed to mark
read* toast; `markAllRead` runs all ids with `Promise.allSettled`, then
shows one toast naming how many failed. Tests cover both.

**A nested git repo breaks the tree hash.** `getTreeHash` (`git.ts:747`)
feeds every porcelain entry to `hash-object --stdin-paths`; an untracked
directory that is itself a repo appears as `? inner/`, `hash-object` exits
128 on it, the fingerprint turns null and every check reruns on every poll.
Entries ending in `/` are hashed by their path string alone, never sent to
`hash-object`. A test with an inner repo asserts a stable hash.

**PATCH `thread` and `log` still race.** `routes/content/entities.ts:97`
computes the new thread from the entry read before the serialised chain, so
an `appendThread` landing in between is overwritten. The thread is derived
inside the chain's `mutate` from the fresh entry, like `phase`. The
concurrent test adds a thread-vs-log case.

**Three writers bypass the chain.** `prioritise.ts:200`,
`pr-review-settle.ts:146` and `cli/index.ts:893` call `writeEntityFile`
directly from a stale `entries` read. Each goes through `updateEntity` (the
release stamp) or `appendThread` (the two thread writers).

**Main's sha is resolved twice per read.** `readCorpus` runs
`resolveMainSha` (`symbolic-ref` plus `rev-parse`) beside
`resolveIdsWithMainActivity`, which already resolves the same sha: two extra
spawns on every read, cache hits included, and a window where the key holds a
newer sha than the activity set. `resolveIdsWithMainActivity` returns
`{ ids, sha }`; `readCorpus` keys on that sha and `resolveMainSha` goes.

**A stale feature branch spends extra spawns.** On a feature branch behind
main, `isBranchMerged` (`git.ts:487`) looks up the PR instead of reading the
right-hand count of the one `rev-list`, `getFeatureBranchPlanId` re-runs
`rev-parse` instead of using `snapshot.branch`, and `neverDiverged` adds a
second `rev-list`. Merged is the right count being zero, the plan id comes
from the snapshot's branch, and `neverDiverged` reads the same left-right
counts. The spawn-count test adds the stale-branch case and asserts four.

**Prioritise clicks can cross.** `routes/content/ideas.ts:46` keeps one
`prioritiseTask` slot, overwritten by each click, so click one's retry or
finalize can settle click two's task. The route answers 409 *A prioritise
run is already in progress* while a task is in flight.

**Timeout kills pile up timers.** The 1 s poll in `agent-process.ts:30`
calls `killWithEscalation` on every tick until the process closes, arming a
new 5 s SIGKILL timer each time. The poll kills once, guarded by a flag, and
the escalation timer is `unref`'d.

Done when a failed mark-read shows a toast with no console rejection, an
inner repo leaves the tree hash stable across polls, a thread append during
a log PATCH survives, every entity write in `src` goes through the chain,
`readCorpus` spawns no git process of its own, a stale feature branch's
status runs four git processes, a second prioritise click answers 409, and
a timed-out run arms one SIGKILL timer.

### Out of scope

`AgentManager`'s member count (18 against IDEA-309's fifteen) and the
`POST /api/plans` 404 assertion, which depends on the host's fallthrough.
`knip.json`'s `ignoreBinaries`, which names real external binaries.

### Phases
- [x] Mark-read failures that surface
      Catch and toast on the entry page; `allSettled` with one summary
      toast in `markAllRead`; tests for both.
      run: 2m25s · 62 in · 10.1k out · sonnet-5 · sess:412a4c0d-cc2a-4dcb-9524-748316f577fa
- [x] Tree hash that survives an inner repo
      Directory entries hashed by path, never through `hash-object`; test
      with a nested repo.
      run: 1m46s · 40 in · 5.4k out · sonnet-5 · sess:412a4c0d-cc2a-4dcb-9524-748316f577fa
- [x] Thread writes inside the chain
      Thread derived in `mutate` for PATCH; `prioritise.ts`,
      `pr-review-settle.ts` and the release stamp through `appendThread` /
      `updateEntity`; thread-vs-log concurrent test.
      run: 5m20s · 118 in · 22.1k out · sonnet-5 · sess:412a4c0d-cc2a-4dcb-9524-748316f577fa
- [ ] One sha per corpus read
      `resolveIdsWithMainActivity` returns its sha; `readCorpus` keys on it;
      `resolveMainSha` removed; a test counts git spawns on a cache hit.
- [ ] Stale branch within the spawn budget
      Merged from the right count, plan id from the snapshot,
      `neverDiverged` from the same counts; stale-branch spawn test.
- [ ] Single-flight prioritise and one kill
      409 while in flight; kill-once flag and `unref` on the escalation
      timer; tests.
