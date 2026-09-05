---
id: IDEA-233
title: Daemon lifecycle like pm2
type: feat
status: idea
created: 2026-09-05
tags:
  - cli
  - server
subject: Multi-project
order: 2
---

`paper-camp daemon` runs in the foreground and nowhere else. Closing the
terminal kills every project on the machine, there is no way to ask whether a
daemon is up, and the only record of what it printed is the scrollback of
whichever tab started it. Verified against the published 0.27.0: `--help`
lists `daemon`, `ls`, `rm`, `scan`, and nothing that starts, stops, or
inspects a running process. `ls` prints slug and path from the registry file
and cannot tell a served project from a dead folder.

pm2 is the shape the daemon was modelled on ([[IDEA-224]]), and pm2's answer
is a small set of verbs over one state file. Paper Camp adopts the same verbs
with the same meanings, applied to the one process a machine runs.

**One state file, written by the daemon itself.** On listen, the daemon
writes `daemon.json` beside `projects.json` in the config dir (honouring
`PAPERCAMP_CONFIG_DIR`): `pid`, `port`, `version`, `startedAt`, and the
`share`/`tailnet` flags it was given. On SIGINT/SIGTERM it removes the file
before exiting. This holds whether the process was started detached or in the
foreground, so every command below reads the same truth. A daemon is
considered running when the file exists, `process.kill(pid, 0)` succeeds, and
`GET http://localhost:<port>/api/machine/projects` answers JSON; anything less
is a stale file, and the command that finds it deletes it and reports
`stopped`.

**`paper-camp start [-p] [--share] [--tailnet]`** spawns `paper-camp daemon`
with the same flags, `detached: true`, stdio redirected to `daemon.log` in
the config dir (truncated on every start — the log is the current run, not a
history), and `unref()`s it. It then polls the machine endpoint for up to ten
seconds and, once it answers, prints the log's banner lines so the terminal
shows the same Local/Network/Tailnet/Tunnel links the foreground run would.
If a daemon is already running, `start` prints its status line and exits 0;
it never starts a second one. If the child dies before answering, `start`
prints the log and exits 1.

**`paper-camp stop`** sends SIGTERM to the recorded pid, waits for the
process to exit (SIGKILL after five seconds, the same escalation
`desk-services.ts` already uses), and confirms the state file is gone.
Nothing running → `paper-camp: daemon is not running`, exit 0.

**`paper-camp restart`** is `stop` then `start` with the flags recorded in
the state file, so a `--tailnet` daemon comes back as a `--tailnet` daemon.

**`paper-camp status`** prints the daemon block — `running` with pid, port,
version, uptime, and the flags, or `stopped` — followed by the project table
`ls` prints. **`paper-camp ls`** gains a `STATE` column: `mounted` when the
running daemon has built that project's middleware, `busy` when its agent has
a task in flight, `idle` otherwise, and `—` for every row when no daemon is
running. The daemon exposes this through `/api/machine/projects`, which grows
`mounted` and `busy` booleans per project — the hub gets them for free, and
the same host-trust rule covers the CLI's loopback call.

**`paper-camp logs [-n <lines>] [-f]`** prints the last lines of `daemon.log`
(default 50) and, with `-f`, follows it until interrupted. With no log file it
says so and exits 0.

**`paper-camp daemon`** stays as it is: the foreground runner, pm2's
`--no-daemon`. `start` is `daemon` detached, not a second implementation.

The state and log files sit next to the registry, so `PAPERCAMP_CONFIG_DIR`
gives a test suite a throwaway daemon with its own pid file, exactly as
[[IDEA-228]] intended for the registry.

### Out of scope

Surviving a reboot (pm2's `startup`) — a launchd/systemd unit is a later
idea, not this one. Log rotation or a log history beyond the current run.
Windows service semantics; `start` works there through `detached`, but
signal-based `stop` is not promised. Managing anything other than the one
daemon — desk services and agent runs stay owned by the daemon, as
[[IDEA-224]] settled.

### Phases
- [x] Write `daemon.json` on listen and remove it on exit
      `daemon-server.ts` records pid, port, version, startedAt and the share/tailnet flags in the config dir, and clears the file on SIGINT/SIGTERM.
      run: 6m42s · 98 in · 12.6k out · sonnet-5
- [x] Add a shared state reader that prunes stale files
      One helper the CLI commands share: read the file, check `process.kill(pid, 0)`, probe the machine endpoint, and delete the file when any of those fail.
      run: 7m17s · 60 in · 14.2k out · sonnet-5
- [x] Add `paper-camp start`
      Spawn `paper-camp daemon` detached with stdio into `daemon.log`, poll the machine endpoint, then echo the banner lines; refuse to start a second daemon.
      run: 19m24s · 148 in · 59.4k out · sonnet-5
- [x] Add `paper-camp stop` and `paper-camp restart`
      SIGTERM with a five-second SIGKILL escalation, and a restart that reuses the flags recorded in the state file.
      run: 12m53s · 106 in · 37k out · sonnet-5
- [ ] Report per-project `mounted` and `busy` from `/api/machine/projects`
- [ ] Add `paper-camp status` and the `ls` STATE column
- [ ] Add `paper-camp logs` with `-n` and `-f`
- [ ] Cover the lifecycle with a throwaway `PAPERCAMP_CONFIG_DIR` and run the quality checks
