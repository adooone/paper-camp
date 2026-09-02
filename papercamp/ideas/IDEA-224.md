---
id: IDEA-224
title: Machine daemon for all projects
type: feat
status: idea
created: 2026-09-01
tags:
  - cli
  - server
  - app
subject: Multi-project
---

Managing ten repositories today means ten `paper-camp dev` processes on ten
ports, each with its own pairing token, and each paying for a full
per-project runtime: `createApiMiddleware(root)` builds a git manager,
status manager, desk services, desk checks, agent, and activity manager,
plus recursive filesystem watchers on `papercamp/`, `.git`, and `src`.
That cost is paid continuously for every project, whether or not anyone is
looking at it.

One daemon per machine replaces it. The package is installed globally, one
long-running process serves every project on that machine, and the hub
connects to the machine rather than to each project — pm2's shape, applied
to codebases instead of processes.

**A registry, scanned once.** Project paths live in a machine-level
registry (`~/.config/paper-camp/projects.json`), not in any repo.
`paper-camp scan <dir>` walks that directory one level deep and registers
every folder containing `papercamp/config.json` — projects without
paper-camp installed are skipped. The scan is a one-time action the user
runs, never a background process; `paper-camp ls` and `paper-camp rm`
manage the list the way pm2 manages its own.

**No watchers, no per-project processes.** A registered project costs
nothing until opened. The daemon reads `papercamp/` from disk when asked
and serves each project under a `/p/<slug>/` mount, which the client
already supports through the `data-paper-camp-mount` prefix it reads in
`services/mount.ts`. Watchers are removed rather than made lazy: the
daemon performs every write itself — agent runs, phase toggles, edits from
the app — so it invalidates its own cache and emits on the existing
`/api/activity/stream` without needing to observe the filesystem. The
accepted trade is that a change made *outside* the daemon (an editor save,
a `git pull`) appears on the next read or refresh rather than instantly.

**Processes are spawned, supervised, and exit.** Agent runs and desk
services start on demand with `cwd` set to the project root and are owned
by the daemon — `desk-services.ts` already supervises long-running
commands this way with node-pty, so this generalizes what exists rather
than inventing it. Agent concurrency is a machine-level queue: one run at
a time by default, since one machine's CPU is the real constraint.

**Pairing moves up a level.** One token per machine, stored beside the
registry in `~/.config/paper-camp/`, replacing today's per-project
`papercamp/.pairing.json` for daemon-served projects. One pairing gets the
hub every project on that machine.

`paper-camp dev` stays exactly as it is for the single-repo case. The
daemon is the addition, not a replacement.

In the hub, connecting to a machine and listing its projects replaces
*Add a project by URL* from [[IDEA-221]]. [[IDEA-222]]'s tailnet discovery
finds daemons — one per machine instead of one per project — which is
strictly less to probe.

### Out of scope

Browsing a remote machine's filesystem from the hub: the scan root is
chosen on that machine when the scan runs, and the hub only ever sees
projects already registered. Watching the filesystem in any form. Running
an agent against a working tree on a different machine. Replacing
`paper-camp dev`.

### Phases
- [x] Machine-level project registry
      `~/.config/paper-camp/projects.json` with add, remove, and list; `paper-camp ls` and `paper-camp rm` on top of it.
      run: 2m44s · 26 in · 4k out · sonnet-5
- [x] Scan a directory for projects
      `paper-camp scan <dir>` registers every folder one level deep containing `papercamp/config.json`, reporting what it added and skipped.
      run: 4m27s · 48 in · 13.1k out · sonnet-5
- [x] Serve registered projects from one daemon
      `paper-camp daemon` mounts each project under `/p/<slug>/` on first request, reusing the existing per-root middleware factory and the client's mount prefix.
      run: 20m14s · 204 in · 64.5k out · sonnet-5
- [x] Drop the filesystem watchers
      Remove the `papercamp/`, `.git`, and `src` watchers; the daemon invalidates its own cache and emits activity events on its own writes.
      run: 35m18s · 402 in · 83.7k out · sonnet-5 · ×2
- [x] Move pairing to the machine
      One token stored beside the registry, pairing the hub to every project the daemon serves.
      run: 2m37s · 34 in · 5k out · sonnet-5
- [ ] Connect to a machine from the hub
      The connection column connects to a daemon and lists its projects, replacing Add a project by URL; opening one enters it as a normal project.
- [ ] Queue agent runs per machine and run the quality checks
      One agent run at a time per daemon by default; check-types, lint, vitest, consistency green.
