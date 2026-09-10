---
id: IDEA-257
title: The daemon updates itself
type: feat
status: idea
created: 2026-09-10
tags:
  - cli
  - server
subject: Infrastructure
order: 1
---

A release lands on npm and nothing on the machine notices. The daemon on
deimos has served 0.28.4 for a day while four later versions carrying
its own fixes were published; every run, draft, and verify still goes
through the old code until someone runs `npm install -g` by hand and
`paper-camp restart`. The hub's *Version mismatch* stamp tells the
browser it is ahead of the runtime, which is the wrong party to inform:
the runtime is the one that can act.

**A poll is the hook.** GitHub cannot call the machine — it lives on the
tailnet — so the trigger is the daemon asking the registry. Every 30
minutes it fetches `https://registry.npmjs.org/@dendelion/paper-camp/latest`
and compares the version to its own. `paper-camp start` accepts
`--no-auto-update`; the setting is recorded in `daemon.json` beside
`tailnet` and `share`, defaults to on, and `restart` carries it forward
with the other flags through `restartOptionsFromState`.

**Only when idle, and never twice.** A newer version is installed only
when no project on the machine has a task running — the same busy flag
`/api/machine/projects` already reports. While something runs, the
daemon logs "update to X waiting for the machine to go idle" once and
tries again on the next poll. The install is `npm install -g
@dendelion/paper-camp@<version>` with the `npm` on the daemon's own
`PATH`, so a Volta- or nvm-managed npm is the one that installed it in
the first place; its output goes to `daemon.log`. When the install exits
zero the daemon runs its own `restart`, which relaunches through the
global shim and so picks up the new code with the same flags; the banner
in the log then prints the new version. A failed install is logged with
the command's output and retried on the next poll, never in a loop.

**The same thing by hand.** `paper-camp update` runs one check and
install immediately and prints what it did: "already on 0.29.1", or
"updated 0.28.4 → 0.29.1, restarting". `paper-camp status` shows the
auto-update state, the last check time, and a pending version when one
is waiting for idle.

**The hub is told.** The machine card in the hub carries the pending
version as a stamp while an update waits, and after the restart the
*Version mismatch* stamp clears on its own, since the runtime now
matches the client.

### Out of scope

Updating the hosted client; Vercel does that on push. Rolling back; a
bad release is fixed forward by publishing another. Updating anything
other than the daemon's own package.

### Phases
- [x] Record the auto-update setting on the daemon
      `--no-auto-update` on `start`, an `autoUpdate` field in `daemon.json` beside `tailnet` and `share`, carried through `restartOptionsFromState`.
      run: 5m7s · 90 in · 14.8k out · sonnet-5
- [x] Ask the registry for the latest version
      A core check that fetches the `latest` dist-tag and compares it to `PAPER_CAMP_VERSION`.
      run: 3m13s · 46 in · 7.9k out · sonnet-5
- [x] Install and restart the daemon when the machine is idle
      The 30-minute poll, gated on the existing `isMachineBusy`, logging the wait once and a failed install with its output.
      run: 12m4s · 82 in · 33.2k out · sonnet-5
- [ ] Add `paper-camp update` for one check and install on demand
- [ ] Report auto-update state, last check, and pending version in `paper-camp status`
- [ ] Carry the pending version to the hub's machine card
      Extend the `/api/machine/projects` payload and stamp the waiting version until the restart clears the mismatch.
