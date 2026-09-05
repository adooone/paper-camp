---
id: IDEA-234
title: Daemon-only welcome screen
type: feat
status: idea
created: 2026-09-05
tags:
  - app
  - cli
  - docs
subject: Multi-project
order: 2
---

The empty hub still offers three doors. `add-project-column.tsx` renders the
Get started card, then Connect GitHub, then Tailnet peers, and the Get started
card itself teaches the per-repo path: `npm install --save-dev`, `npx
paper-camp init`, `npx paper-camp daemon`. Nothing on the screen says the
package is meant to be installed once per machine, and nothing mentions
`scan <dir>`, the command that adopts a folder of repositories in one go.

Worse, the path it teaches ends in a dead end on the machine it runs on.
Verified against the published 0.27.0: the daemon's Local link is a bare
`http://localhost:4333`, and the hub only learns about a machine by following
a `?machine=&token=` link — which the banner prints only for Network,
Tailnet, or Tunnel, and on a laptop without Tailscale prints not at all
("Another device needs an HTTPS address"). Open Local, and the hub served by
the daemon shows an empty registry and a Get started card telling you to
install again. `use-remembered-machines.ts` reads `listMachines()` from
localStorage and nothing else; the daemon serving the page is invisible to
the page.

The daemon becomes the one way in, the hub knows the machine that serves it,
and the GitHub project kind — the plan-only path that let the hub browse a
repo with no runtime at all — is removed rather than hidden.

**Three commands, the global path.** The Get started card prints:

```
npm install -g @dendelion/paper-camp
paper-camp scan ~/dev
paper-camp start
```

with a line under the second explaining that `~/dev` stands for the folder
holding your repositories, and that `paper-camp init` inside a single repo
registers just that one. The third switches to `paper-camp start --tailnet`
when the hub's origin is HTTPS, as it does today. `start` is [[IDEA-233]]'s
detached runner; the card lands after it. The closing line stays: open the
link it prints.

**The serving machine is implicit.** When the app boots with no mount prefix
and `window.location.origin/api/machine/projects` answers JSON, that origin
is a machine — listed first in the add column as *This machine*, ahead of any
remembered machines, without ever being written to `machine-store.ts`. The
same-origin request passes the daemon's Host check the way loopback and LAN
already do, so no token is involved and the bare Local link works as printed.
A project chosen from it persists `<origin>/p/<slug>` like any other machine
project. `servesOwnRuntime` stops relying on the SPA fallback returning HTML:
[[IDEA-235]] makes the daemon root answer `/api/*` with a JSON 404, and the
probe reads that as "no runtime here".

**Only the daemon's cards remain.** The add column renders the Get started
card (registry empty), *This machine*, and the remembered-machine cards.
`github-connect-card.tsx`, `tailnet-peers-card.tsx`, `use-github-connect.ts`,
and `use-tailnet-peers.ts` are deleted. Discovery of other machines is a link
the daemon prints, as [[IDEA-230]] settled; a tailnet peer becomes known by
opening its Tailnet link once.

**The GitHub kind goes with its card.** Every project the hub knows is a
runtime — a `paper-camp dev` origin or a `<machine>/p/<slug>` mount. The
`kind` discriminator leaves `project-registry.ts` along with
`GithubProjectEntry`, `addGithubEntry`, and the `github` branch of
`projectEntryId`; a stored entry of that kind is dropped on parse, since
nothing can open it any more. With no token to read a corpus through the
GitHub API, `services/github/` loses `corpus.ts`, `config-store.ts`,
`client.ts`, `identity.ts`, `device-flow.ts`, and `hub-token-store.ts` —
`ideas-slice.ts`, `plans-slice.ts`, `use-plan-status-patch.ts`, and
`new-idea-button.tsx` keep only their runtime branch. `github-slice.ts`
leaves the store, `main.tsx` stops passing a GitHub flag into
`hasChosenProject`, and the `/api/github/device-flow` route and
`github-device-flow.ts` are removed from the server. Nothing here touches
the `gh`-backed PR and review features, which run on the runtime and never
used this token.

**No plan-only state anywhere.** `runtime-unavailable.tsx` stops offering a
token form: an unreachable runtime says the runtime is unreachable and shows
the command that starts it. `use-runtime-statuses.ts` stamps a row that does
not answer as *Offline*; *Plan-only* disappears from the hub and from
USAGE.md's stamp list.

**The docs say the same thing.** USAGE.md's "Installing into your own
project" and "Adding a project" describe only the global path and the three
commands, and the "Connect GitHub" bullet goes. README.md's Quick Start
addresses a user, not a contributor: the same three commands, with
`pnpm install && pnpm dev` moved under a "Working on Paper Camp" heading.
`paper-camp dev` keeps one sentence as the single-repo foreground mode.

### Out of scope

The daemon's banner wording, unchanged. The server's `gh` CLI integration
for PRs, reviews, and issues, which is the runtime's own GitHub access and
stays exactly as it is. Migrating a stored GitHub-kind entry into anything
else; it is simply forgotten.
