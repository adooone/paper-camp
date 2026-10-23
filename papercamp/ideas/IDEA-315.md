---
id: IDEA-315
title: Small fixes from the review pass
type: fix
status: planned
created: 2026-10-21
tags:
  - app
  - server
  - tests
subject: Code health
---

A review of IDEA-305, 306, 311 and 312 found them sound, with the small
gaps below. One failing integration test and knip's unused exports ride
along.

**`complete-idea` ticks before the checkout.** `routes/git.ts:123` calls
`notifyChanged()` right after the PR merge, then `returnToMain()` checks out
main and rewrites `papercamp/ideas/`. The 100 ms debounce usually fires
first, so clients refetch while still on the feature branch and the Ideas
list stays stale until the next tick. A second `notifyChanged()` follows
`returnToMain`, in both the success and the merged-but-unfinished paths.

**Two loads per tick.** `use-status-client.ts:104` still handles `changed`
by calling `loadGitStatus` and `loadAgentStatus`, which `refreshProjectState`
(wired once in `main.tsx:45`) already runs. The branch goes.

**A failed heartbeat leaves its interval running.** In
`src/app/server/activity.ts:111` a heartbeat write that throws deletes the
client but the interval keeps ticking until `close`. The catch clears the
interval too.

**Closed ids collide across projects.** `agent-section.tsx:351` merges plan
ids from every project into one `closedIds` set and applies it to every
project's task log, so IDEA-5 done in one project hides the interrupted
notice for an open IDEA-5 in another. `closedIds` becomes a map keyed by
runtime URL, and `interruptedNotices` receives the set for its own project.
`readIds` stays global, since task ids are UUIDs.

**Dismiss failures are silent.** `markNotificationReadAt`
(`notifications-api.ts:31`) never checks `res.ok`, and own-project
`markRead` (`use-notifications.ts:26`) swallows the error, so the *Failed to
dismiss notice* toast can never fire and a failed own-project dismiss hides
the card anyway. `markNotificationReadAt` throws on a non-OK response;
`markRead` rolls back its optimistic cache write and rethrows; the toast
fires. A test covers the failed POST.

**The prioritise retry flickers and keeps stale errors.** `agent.ts:2153`
sets the task `done` after attempt one, even when its verdict is about to be
rejected, so `tasks.log` gets a `done` row, the Stack shows done-then-running,
and a process-level failure on attempt one leaves `errorReason` on a task
whose retry succeeded. The task stays `running` until the verdict is
accepted or the retry fails; `errorReason` and `errorKind` are cleared when
a retry starts; the manager-wide `prioritiseTask` slot is cleared when the
task settles, so a second click can't bind the first click's retry.

**A daemon update test fails.** `daemon-lifecycle.test.ts:630`, *installs
and restarts the running daemon*, fails on this machine: the restarted
daemon doesn't answer within 10 s and the suite's temp dir is left non-empty
(`ENOTEMPTY` on `tools/image`). The restart test beside it passes with the
same `asRealCliEntry`, so the difference is in the update path. The phase
finds why the post-update daemon doesn't come up under the test and fixes
the code or the test's stub so the test passes, and the temp dir is removed
with `recursive: true`.

**Unused exports.** knip lists re-exports in `src/app/server/helpers.ts`
(`appendThread`, `createIdea`, `resolveEntityFilePath`, `CreateIdeaInput`,
`EntityFileInput`), the `NO_DAEMON_ERROR` export in `src/mcp/tools.ts`, the
duplicate `paperCamp|default` export in `src/vite/index.ts`, and thirteen
unused types across `login-relay.ts`, `app-store.ts`, `agent-slice.ts`,
`plans-slice.ts`, `parse-diff.ts`, `desk-discovery/evidence.ts`,
`night-shift.ts`, `push-store.ts` and `tailnet.ts`. Each is unexported or
deleted until knip is clean.

Done when completing an idea refreshes the Ideas list on main, a tick loads
git and agent status once, a dead heartbeat client has no interval, an open
IDEA-5 keeps its interrupted card while another project's IDEA-5 is done, a
failed dismiss shows the toast and keeps the card, a prioritise run shows
one `running` until it settles, the whole vitest suite passes, and knip
reports nothing.

### Out of scope

The `.mcp.json` and `opencode.json` this repo lacks: that is `paper-camp
init --settings`, run by hand.

### Phases
- [x] Tick after the checkout and once per tick
      Second `notifyChanged()` after `returnToMain` on both paths; the
      `changed` branch leaves `use-status-client`; heartbeat catch clears
      its interval; route and activity tests.
      run: 4m32s · 96 in · 13.9k out · sonnet-5 · sess:d7ae3fc4-8638-4ecb-9a2e-0cb39d0cf2e1
- [x] Interrupted notices keyed per project
      `closedIds` as a map by runtime URL; `interruptedNotices` gets its
      own project's set; a test with the same id open in one project and
      done in another.
      run: 3m48s · 80 in · 12k out · sonnet-5 · sess:d7ae3fc4-8638-4ecb-9a2e-0cb39d0cf2e1
- [ ] Dismiss that reports failure
      `markNotificationReadAt` throws on non-OK; `markRead` rolls back and
      rethrows; failed-POST test shows the toast.
- [ ] One running prioritise task
      No `done` between attempts, error fields cleared on retry, slot
      cleared on settle; `prioritise.test.ts` asserts a single `done` row.
- [ ] The daemon update test passes
      Diagnose the post-update restart under `asRealCliEntry`, fix code or
      stub, recursive temp-dir cleanup; full `vitest run` green.
- [ ] knip clean
      Unused exports and types removed or unexported; `pnpm knip` reports
      nothing.

### Thread
- [x] 2026-10-21 [log] [agent] Run order: Smallest, most isolated set of fixes (ticks, notices, dismiss, knip) with no stated blockers, best left last as mop-up after the larger refactors settle the code it touches.
