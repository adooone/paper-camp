---
id: IDEA-323
title: Daemon survives a busy box
type: fix
status: planned
created: 2026-11-03
updated: 2026-11-14
tags:
  - cli
  - server
  - daemon
  - checks
subject: Infrastructure
---

On 2026-11-02 the hosted client showed "The runtime is unreachable" for
paper-camp while the daemon was alive and listening on port 4333. The box (two
cores) sat at a load average of 16 to 24: a desk check the daemon had started
in the radio project (`pnpm test` → turbo → `bun test`) had been running for
almost eight hours at a full core, another session's test run was stuck on
ffmpeg, and other sessions were running their own tests. A trivial
`/api/package-name` took five to twelve seconds on loopback. Four things in
Paper Camp turned a slow box into a broken one.

`readRunningDaemonState` probes `/api/machine/projects` with a two-second
timeout and, when the probe fails, deletes `daemon.json`. Under load that
deleted the state of a healthy daemon; `paper-camp status` then reported "not
running", `stop` and `restart` had nothing to act on, and `start` would have
hit the port in use. `paper-camp status` run right after the restart deleted
the fresh file the same way. The desk-check runner in `desk-checks.ts` spawns
a check with no time limit and offers no way to stop one, so the radio check
ran until it was killed by hand. `createProjectMounter.mount()` has no
in-flight guard: the hosted client's first paint fires several requests at
once, each one builds its own middleware for the same slug (the log shows
every project mounted two or three times per boot), the last write wins and
the others leak their git managers and background fetch timers. And the
client's probe (15 s, two retries) reports "unreachable" the same way for a
daemon that answers in twenty seconds as for one that is gone, with advice to
start it, which fails.

**The state file only goes when the process is gone.** `readRunningDaemonState`
treats the daemon as running when its pid is alive and port is listening (a
TCP connect, no HTTP). The HTTP probe is only used to recognise a pid that is
alive but not ours (a reused pid), and then with a 15-second timeout. The
state file is removed only when the pid is dead or the port is held by another
program. `startDaemonServer` writes `daemon.json` as soon as `listen`
succeeds, before `tailscale serve` and the tunnel, and rewrites it with the
tailnet name afterwards, so `status` sees a daemon the moment it is up.

**Checks have a limit and a stop.** `desk-checks.ts` kills a check with the
same escalation phases use (`killWithEscalation`) after 30 minutes, records it
as `fail` with "timed out after 30 min" as output, and exposes `stopCheck(name)`
on the manager with `POST /api/checks/stop`. The Stack panel's running check
stamp gets the same stop button a task card has.

**One build per slug.** `mount()` keeps an in-flight promise per slug and every
concurrent request awaits the same build; the duplicate "mounted" log lines
and the leaked managers go.

**Slow is not down.** The client's reachability probe records whether the
request completed late (after the 15-second abort, a second attempt with a
60-second limit). When it did, the unavailable page says "The runtime is
responding slowly" with no start command, and the app retries on its own every
30 seconds; "unreachable" with the start command is shown only when no attempt
got an answer.

Done when `paper-camp status` on a daemon that takes ten seconds to answer
reports it as running and leaves `daemon.json` in place, a check that hangs
ends as failed after 30 minutes and can be stopped from the panel, a daemon
boot logs each project mounted once, and the hosted client shows "responding
slowly" rather than "unreachable" against a loaded box.

### Phases
- [ ] State file tied to pid and port
      `readRunningDaemonState` on pid plus TCP connect, HTTP only for a
      reused pid with a 15 s limit; `daemon.json` written right after
      `listen`; tests for the slow-daemon case.
- [ ] Check timeout and stop
      30-minute limit with `killWithEscalation`, `stopCheck`,
      `POST /api/checks/stop`, the stop button on the running stamp; tests.
- [ ] Single-flight mount
      In-flight promise per slug in `createProjectMounter`; test with
      concurrent first requests.
- [ ] Slow is not down
      Late-completion detection in `probeReachable`, the "responding slowly"
      page with automatic retry; tests.

### Thread
- [x] 2026-11-14 [log] [agent] Restored on 2026-11-14 from a stranded `papercamp-reconcile` stash dated 2026-11-06 (see IDEA-331); the file had been missing from the corpus since then while three bookkeeping commits on main referenced it. Part of phase 1 and phase 4 landed in 0.46.0 through `readRunningDaemonState` (pid plus HTTP probe, a slow daemon keeps its state file), not in the shape the phases describe; single-flight mount and the check stop are untouched.
