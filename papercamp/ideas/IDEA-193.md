---
id: IDEA-193
title: Client, runtime and plugin layers
type: feat
status: idea
created: 2026-08-19
updated: 2026-08-19
tags:
  - architecture
  - multi-project
  - app
subject: Multi-project
---

Paper Camp separates into three layers, and ships no backend. The UI is static
files; everything with state runs in the user's own repo, on the user's own
machine.

### Nothing is hosted on the user's behalf

This is the constraint the rest of the design answers to, not a preference to
revisit. Paper Camp publishes a UI and a package. It operates no server, holds
no account, stores no corpus and brokers no connection. Anything that needs to
run is installed into the repo it serves.

That rules out a relay. A hosted service the runtime dials out to would solve
reachability elegantly, and it is exactly what a self-hosted-runner architecture
does — but it is a backend, so it is off the table. Reachability between a
client and a runtime becomes the user's to provide, and the design has to be
honest that some clients will not reach some machines.

### The three layers

**Client — collects intent.** A web app, a mobile app, a chat surface, served as
static files from anywhere that serves files. It shows the desk and captures what
the human wants, and it holds nothing: no account, no registry, no corpus, no
credential it did not receive from a runtime. It is deliberately thin in the
other sense too — it does not decide what an intent *means*. If the client
transforms actions into plans, every client reimplements the methodology and they
drift apart, and three clients become three products.

`vite build --config vite.app.config.ts` already emits this bundle.

**Runtime — does the work.** The methodology service, running on the user's
machine. It owns the filesystem, git, the agent spawn and the checks, and it is
where an intent becomes a plan, a phase, a commit. Today this is
`paper-camp dev`; it already spawns the agent and already refuses anything that
is not local.

**Plugins — reach other systems.** Two kinds, and the distinction is load-bearing
rather than cosmetic:

- *External services* the runtime speaks to on the user's behalf — GitHub today,
  Figma or Linear later. With no backend to hold an app identity, the runtime is
  the client: it already shells out to an authenticated `gh` for every PR lookup
  and review post, using the user's own GitHub credentials. A hosted GitHub App
  would need a webhook receiver, so integrations that demand one are out until
  something else provides it.
- *Local adapters* are tools the runtime drives on the machine. `claude-code`
  and `opencode` are already exactly this. They use the user's own credentials,
  which never leave the machine.

Calling both "plugins" is fine as a product word, but they have different trust
boundaries, different credential stores and different failure modes, so they are
not one extension point.

### Git is the database

No layer owns the corpus. It stays per-repo in git, as [[IDEA-117]] settles —
centralize the lens, never the data. That is what lets any client reconstruct
the whole desk from a clone, and it keeps the hosted side from holding a
customer's planning history.

### Installed into the repository

The runtime arrives the way any other dev dependency does — added to the repo it
serves and run from there, alongside the `papercamp/` corpus it reads. Nothing to
provision, nothing to sign up for, and a repo that carries its own tooling stays
reproducible on any machine that clones it.

### The user's machine keeps the code and the model

The runtime staying local is the point, not an implementation detail. The agent
CLI is already authenticated on that machine, so the hosted side never holds the
user's code or their model credentials. Hosted execution would require both, and
that is the difference between a lens over someone's repos and a company with a
security posture.

### Reachability is the user's to provide

With no relay, a client reaches a runtime only over a network path the user
already has. On the same machine that is the loopback address. Across devices it
is a LAN address, a VPN, or a tunnel the user runs — this project is developed
today with the desk open over a Tailscale address, which is the pattern working
by hand.

The product does not solve this and should not pretend to. What it owes the user
is being explicit about which clients can reach which runtimes, and degrading
clearly when one cannot.

### Degrading when the runtime is away

With no backend, an unreachable runtime takes GitHub access with it — the `gh`
credentials live on that machine too, so there is no path left to the corpus. A
project whose runtime is away is not plan-only, it is unavailable, and the client
can only show what it last read.

Making plan-only real would mean the client talking to GitHub itself with a token
the user grants it, which puts a credential in the browser and contradicts the
client holding nothing. That trade is unresolved and is the first thing to settle
if reading a corpus from a phone matters.

### Out of scope

Providing reachability — no relay, no tunnel, no hosted broker. Accounts and
identity, which have nowhere to live. Any integration that requires a webhook
receiver.

### Thread
- [ ] 2026-08-19 [question] [human] How does a static page reach the runtime — a
      fixed loopback address, or a URL the user supplies for LAN/VPN/tunnel access?
      A page served over https calling http loopback is allowed in Chrome, which
      treats localhost as trustworthy, but the other browsers are less consistent.
- [ ] 2026-08-19 [question] [human] One runtime per repo, or one runtime managing
      many? "Installed into the repository" implies per-repo, but [[IDEA-117]]
      wants the hub precisely to avoid "N dev servers on N ports". Both cannot
      hold, and the answer decides what the client connects to.
- [ ] 2026-08-19 [question] [human] Without a backend, where does the project
      registry live — in browser storage per device, in a repo the user owns, or
      assembled by asking each reachable runtime what it has?
- [ ] 2026-08-19 [question] [human] Does folder scanning from [[IDEA-117]] survive
      alongside GitHub import, or does import replace it as the way a project
      enters the registry?
- [ ] 2026-08-19 [question] [human] Is plan-only a first-class state a project can
      live in indefinitely, or a temporary condition on the way to attaching a
      runtime?
