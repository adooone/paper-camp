---
id: IDEA-157
title: Build check in the status manager
type: feat
status: in-progress
created: 2026-08-09
tags:
  - integration
  - app
  - checks
subject: In-app dev toolbar
---

Owner direction from the [[IDEA-147]] live-testing loop: an auto-rebuild
watcher is too much — they want a **Build button in the Stack** to trigger a
build manually after changes, with the **last-built time** visible. The dev
loop becomes: edit → click Build → reload.

Shape (rides the existing check infrastructure rather than growing a new
runner):

- `build` becomes a fifth `CheckName` in the status manager — same spawn /
  running-guard / SSE-broadcast path as lint/test, but **no default
  command**: the project declares `commands.build` in
  `papercamp/config.json`, read fresh per run so config edits apply without
  a server restart. Unconfigured + triggered → a clear failure message;
  build is not part of the commit gate and never runs automatically.
- `POST /api/status/check?name=build` triggers it; the result (status,
  lastRun, output) lives in the `/api/status` snapshot like every check.
- The dogfood config in func-ui points the command at the linked package
  itself — `pnpm --dir node_modules/@dendelion/paper-camp run
  build:toolbar` — so Build rebuilds whatever checkout is linked. Other
  projects would point it at their own build.

The surfacing UI moved to [[IDEA-158]]: the first pass put a Build row in
the Scout embed's glance card, but owner review ruled Scout out of scope
for it — that card should hold only idea-scoped data, no git/build actions
— so that UI (and its `useBuildClient` hook) was removed. This idea now
covers the backend only: the check itself, the route, and the config
typing, which stay as shared infrastructure for whatever surfaces it next.

### Phases
- [x] Add `build` as a config-driven check in the status manager
      Fifth CheckName, command from `commands.build`, no default, clear message when unconfigured; excluded from the commit gate.
- [x] Accept `build` on the check endpoint and SSE replay
- [x] Type the `commands` block in PaperCampConfig and StatusState
- [ ] ~~Build row in the scout glance card~~ — reverted, wrong surface → [[IDEA-158]]
- [ ] ~~Dogfood in func-ui via the linked package build command~~ — reverted along with the embed UI; the config block itself (`commands.build`) stays in func-ui's `papercamp/config.json` for whatever surfaces the check next

### Thread
- [x] 2026-08-11 [decision] Owner correction: Scout's glance card should only carry idea-scoped data and actions — no git actions, no Build. Both removed from the embed. The Build *feature* itself is still wanted, just surfaced from the desk's own Stack panel instead — filed as [[IDEA-158]], left unplanned for the owner to refine.
