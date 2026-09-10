---
id: IDEA-246
title: One link in, and projects that remember
type: feat
status: idea
created: 2026-09-09
tags:
  - app
  - cli
subject: Multi-project
order: 1
---

Reaching a project from the hosted client works now, but it takes more
steps than it should, and the app forgets things it knew. On 2026-09-09
the daemon banner printed two links — the host-only one and the tailnet
one — for a machine reached only over the tailnet; the hub listed the
machine, then asked for a click to open a project; and every open landed
on Settings, because `use-app-shell.ts` redirects a project whose
capabilities are not all `ok` to the setup section on first visit. Coming
back to a project after switching away lands on the same default too,
not where you left it. And the hub's project rows say *Can execute* or
*Offline*, but not the one thing you look for when switching: whether an
agent is working there right now.

**One link.** The banner prints the single best way in: the Tailnet link
when `--tailnet` produced one, else the Tunnel link, else the host link.
The others are not printed; `paper-camp status` still lists every link the
daemon has for a machine with more than one. A link that carries
`?machine=` opens the machine's project list, and when this browser has
opened a project on that machine before it goes straight to that project
instead — the list is one click away in the header. A machine with exactly
one registered project opens it at once on the first visit too. The pairing
token rides in the link as it does now; nothing else is asked of the user.

**Agents show in the hub.** `use-runtime-statuses.ts` already asks each
known runtime for its package name and version; it also asks
`/api/agent/status`, and a runtime with a task in flight gets a `running`
stamp with the task's plan title in the row, ahead of the reachability
stamp, refreshed on the same cadence. The daemon's machine card marks a
mounted project the same way from the `busy` flag it already returns, so
the machine list and the project list agree.

**A project reopens where it was left.** The app records the last route
visited under each project — keyed by its runtime URL in localStorage,
written on every route change, reset if the route no longer exists — and
opening that project from the hub or a machine link lands there. A project
never visited opens on Plans at `/`. The first-run redirect to Settings is
removed: the status bar's *Setup (N)* stamp already says the setup is
incomplete and already opens it on click, which is the right weight for a
gap the user may not care about today. The USAGE.md redirect for an
untouched corpus stays, since it fires once and only on a corpus nothing
has been done in.

### Out of scope

Pairing itself and the daemon's trust rules. The hosted client's
local-network permission prompt in Chrome, which the machine card now
explains and which the browser owns. Remembering scroll position or open
panels within a route.

### Phases
- [x] Print the single best link in the banner
      Tailnet when `--tailnet` produced one, else Tunnel, else the host link.
      run: 6m17s · 78 in · 26.5k out · sonnet-5
- [x] List every known link in `paper-camp status`
      run: 8m50s · 112 in · 33k out · sonnet-5
- [x] Stamp running agents on hub project rows
      `use-runtime-statuses.ts` also polls `/api/agent/status` and carries the task's plan title.
      run: 7m38s · 152 in · 29.6k out · sonnet-5
- [x] Mark a busy mounted project on the machine card
      run: 3m33s · 38 in · 7.2k out · sonnet-5
- [x] Remember the last route visited under each project
      run: 13m41s · 120 in · 54.7k out · sonnet-5
- [ ] Open a machine link into the remembered or only project
- [ ] Drop the first-run redirect to Settings
      The USAGE.md redirect for an untouched corpus stays.
