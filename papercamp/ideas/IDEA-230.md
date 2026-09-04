---
id: IDEA-230
title: Get started guide on the empty hub
type: feat
status: idea
created: 2026-09-03
updated: 2026-09-03
tags:
  - app
  - cli
subject: Multi-project
order: 2
---

The setup guide is USAGE.md's "Installing into your own project", and it is
the only one — README.md carries no install instructions at all. Docs are
served from `/api/docs` on a **runtime**, so the Docs tab exists only once a
project is already running. The guide for getting your first project is
locked behind having a project.

What a first-time visitor to the hosted hub actually sees is a GitHub card and
"Connect to a machine" — `TailnetPeersCard` returns `null` with no peers, and
the hosted client has no runtime to discover any. So the hub opens by asking
for the address of a `paper-camp daemon` without ever saying how to get one.

The paste card exists because the path that was supposed to replace it does
not work. Following the daemon's own banner link fails three separate ways:

- The link is `http://` and the hosted client is `https://`, so the browser
  blocks every request to it ([[IDEA-229]]).
- The link registers the **daemon root** as a runtime. `loadRuntimeConnection`
  stores it and marks it active, `hasChosenProject` sees a non-empty
  `runtimeUrl` and returns true, and the app boots the project shell against a
  machine. The daemon root has no project API — verified against a live 0.26.0
  daemon, `GET /api/capabilities` at the root falls through to `serveStatic`
  and answers `text/html`, where `/p/<slug>/api/capabilities` answers JSON.
- Even reaching the machine, it serves nothing. `init` does not register the
  project in the machine registry, and the only way in is `scan <dir>`, which
  takes a parent directory and adopts everything one level below it. There is
  no command that registers the repo you are standing in.

The hub stops asking for an address and starts telling the user what to run.

**`init` registers the project.** It writes the repo into the machine registry
(honouring `PAPERCAMP_CONFIG_DIR`), idempotently, so `daemon` serves it with no
scan step. `scan` keeps its job of bulk-adopting repos that already exist.
Onboarding is then exactly three commands.

**The daemon's link declares what it is.** `dev` serves one project and keeps
`?runtime=`. The daemon serves a machine, so its banner link carries
`?machine=` instead. The param is the distinction — no probing the URL and
guessing, no race between two possible meanings.

**The hub adopts a machine link into a picker.** A `?machine=` visit pairs,
reads `/api/machine/projects`, remembers the machine, and lists its projects to
choose from. Choosing one registers `<machine>/p/<slug>` as an ordinary runtime
entry and opens it — the shape `machineProjectRuntimeUrl` already builds.
Machines are remembered in their own localStorage list, next to the GitHub
token store, so `project-registry` keeps holding projects and nothing else.

**The paste card is removed.** `connect-machine-card.tsx` and
`use-machine-connect.ts` are deleted. In their place, each remembered machine
renders a card of its not-yet-added projects, so a second project from a
machine the hub already knows is one click, never another trip to the terminal.

**The guide fills the empty hub.** Shown only while the registry is empty,
above the GitHub card, three steps with the command on each and a copy control:

```
npm install --save-dev @dendelion/paper-camp
npx paper-camp init
npx paper-camp daemon
```

followed by one line saying to open the link the daemon prints. Step three
adapts to the hub's own origin using the same scheme check [[IDEA-229]]
introduces: an HTTPS hub shows `npx paper-camp daemon --tailnet`, because a
plain daemon is unreachable from it and printing a command that cannot work is
the defect this idea exists to fix. Copying a command into a terminal is not
the pasting being removed here — pasting an address into the hub is.

[[IDEA-229]] lands first: the scheme helper is shared, and without it the
guide's third step still ends at a blocked link.

### Out of scope

The Docs tab and how runtimes serve it, which stay as they are — this guide is
hub-side precisely because no runtime exists yet. GitHub connect, unchanged.
Discovery of machines the hub has never met; a machine becomes known by
following its link, not by scanning the network.

### Phases
- [x] Register the project on `init`
      Write the initialized repo into the machine registry through the existing `machine-registry` helpers, honouring `PAPERCAMP_CONFIG_DIR` and re-running clean on an already-registered path.
      run: 2m27s · 32 in · 7.5k out · sonnet-5
- [x] Declare the machine in the daemon's link
      Give `registration-link.ts` a machine variant emitting `?machine=`, point `daemon-server.ts` at it, and leave `dev-server.ts` on `?runtime=`.
      run: 2m25s · 42 in · 10.8k out · sonnet-5
- [ ] Remember machines the hub has met
      Add a `machine-store.ts` beside the GitHub token store that lists, adds, and removes machine URLs in localStorage, with the same private-browsing tolerance.
- [ ] Adopt a machine link into the project picker
      Read `?machine=` before the runtime path in `main.tsx`, pair against it, remember it, and render its `/api/machine/projects` list; choosing a project persists `<machine>/p/<slug>` and opens it.
- [ ] Retire the paste card
      Delete `connect-machine-card.tsx` and `use-machine-connect.ts`, and render one card per remembered machine listing only the projects not already in the registry.
- [ ] Guide the empty hub
      A three-step card above the GitHub card, rendered only when the registry is empty, each step with its command and a copy control, step three switching to `--tailnet` when the hub's origin is HTTPS.
- [ ] Correct the docs and run the quality checks
      USAGE.md's install and "Adding a project" steps match the three commands and the machine link; check-types, lint, vitest, consistency green with no orphans left by the deletions.

### Thread
- [x] 2026-09-03 [decision] [user] Remove the paste card outright rather than demoting it — the whole flow follows the daemon's instructions, so a URL input is the thing being replaced, not kept as a fallback.
- [x] 2026-09-03 [log] [agent] Verified against a live 0.26.0 daemon before writing: the root `/api/capabilities` answers `text/html` via the SPA fallback while `/p/alpha/api/capabilities` answers JSON, `init` leaves the machine registry untouched, and `paper-camp --help` lists no command that registers a single repo.
