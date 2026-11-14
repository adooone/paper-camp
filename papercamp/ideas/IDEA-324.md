---
id: IDEA-324
title: Lighter daemon on a small box
type: fix
status: in-progress
created: 2026-11-03
updated: 2026-11-14
tags:
  - server
  - app
  - checks
  - performance
subject: Infrastructure
---

The machine the daemon runs on has two cores and a hosting plan that caps it
at 30% CPU on average; a long burst gets the VM throttled, and while it is
throttled every request to the daemon waits (IDEA-323 tells "slow" from
"down"). On 2026-11-02 the burst came from a radio run-all whose final gate
started Build, Lint and Tests at once and whose tests then hung. Measured on
2026-11-03, the daemon adds load of its own on top of whatever the agents do.

The capability and connection probes (`claude --version`, `opencode
--version`, `gh --version`, `gh auth status`, `claude auth status`,
`gh repo view`) are cached for 60 seconds per project root in
`capabilities.ts` and `local-adapters.ts`, although only `gh repo view` and
the git identity differ between projects. `opencode --version` boots a full
runtime each time. On the client, `subscribeProjectToActivityStream` answers
every `changed` tick by invalidating every query under `['project',
runtimeUrl]` with `refetchType: 'all'`, capabilities and auth included, so a
busy corpus re-probes every minute per project. The run-all gate
(`runChecksAndWait` in `desk-checks.ts`) runs the formatter and then every
desk check at once through `Promise.all`; a Stack-panel click can start one
more alongside. `/api/doctor` and `/api/stats` recompute on every request
(1.5 to 1.7 seconds each on an idle box: the doctor runs its tooling checks,
stats walks `src/` for test files and reads coverage).

**Machine facts are probed once per machine.** CLI presence and versions,
`gh auth status` and `claude auth status` move into one module-level cache in
`capabilities.ts`, shared by every mounted project, with a 10-minute TTL.
`gh repo view` and the git identity stay per root with the same TTL.
`?recheck=1`, a connect action and the login relay's confirmation clear both.

**A change tick refetches corpus data only.** `subscribeProjectToActivityStream`
invalidates with a predicate that skips the `capabilities`,
`agent-auth-status` and `package-name` resources, and with `refetchType:
'active'`; an inactive query refetches when it next mounts.

**One heavy command at a time.** `src/app/server/heavy-slot.ts` exports a
FIFO limiter whose size is `Math.max(1, Math.floor(os.availableParallelism()
/ 2))`, one on this box. The daemon creates one for the machine and passes it
to every project through `createApiMiddleware`'s options; `paper-camp dev`
creates its own. Every desk-check command, the gate's formatter pass and a
check's fix command acquire the slot before spawning and release it on exit,
so the gate's checks run one after another and a panel click queues behind
them. A queued check shows `queued` on its stamp until it gets the slot.

**Doctor and stats are cached.** Both routes cache their result per root;
`notifyChanged()` drops the entry and it expires after five minutes.

Done when, on this box, a run-all's final gate never has two check commands
running at once, a `changed` tick spawns no `--version` or `auth status`
process, and a second `/api/doctor` within five minutes of the first answers
in under 50 ms.

### Phases
- [x] One probe cache per machine
      Module-level cache for CLI and auth facts with a 10-minute TTL,
      per-root `gh repo view` and git identity, cleared by recheck, connect
      and the login relay; tests.
      run: 4m12s · 40 in · 21k out · opus-5-5 · sess:47b62d23-fc0d-4c3c-9a3a-15ebc039bf22
- [x] Change ticks skip probe queries
      Predicate and `refetchType: 'active'` in
      `subscribeProjectToActivityStream`; query-client tests.
      run: 1m21s · 56 in · 26.1k out · opus-5-5 · sess:47b62d23-fc0d-4c3c-9a3a-15ebc039bf22
- [ ] One heavy command at a time
      `heavy-slot.ts`, wired through the daemon and `paper-camp dev`; desk
      checks, the gate's formatter and fix commands acquire it; the `queued`
      stamp; tests for ordering and release on failure.
- [ ] Cached doctor and stats
      Per-root cache dropped by `notifyChanged` and after five minutes;
      route tests.

### Thread
- [ ] 2026-11-14 [decision] [agent] Restored from a stranded `papercamp-reconcile` stash on 2026-11-14 (see IDEA-331). Since it was written, IDEA-327 and IDEA-328 landed: probes now go through `probe-cache.ts` per root with a 60 s TTL (not per machine, not 10 min), `changed` ticks carry an area and invalidate only that area's queries, and `/api/stats` is computed off the request path. Still open from this plan: the heavy-command slot for desk checks and the cached doctor. Decide whether to narrow this idea to those two phases or drop it in favour of filing them fresh.
