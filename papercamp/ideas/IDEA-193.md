---
id: IDEA-193
title: Client, runtime and plugin layers
type: feat
status: idea
created: 2026-08-19
updated: 2026-08-21
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
the human wants, and it holds no account, no corpus and no credential it did not
receive from a runtime. The one thing it does keep is the project registry — a
device-local list of runtime addresses, settled on [[IDEA-195]] as connection
state rather than data. It is deliberately thin in the
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
serves and run from there, alongside the `papercamp/` corpus it reads. One
runtime per repository, never one managing many: a client showing several
projects fans out across their runtimes rather than asking one to hold them
all. Nothing to
provision, nothing to sign up for, and a repo that carries its own tooling stays
reproducible on any machine that clones it.

### Execution stays on the user's machine, on the user's plan

Settled, and it is the constraint that costs the most. The agent CLI is already
authenticated on that machine and already paid for, so the runtime spawns it and
nothing leaves. No hosted side ever holds the user's code or their model
credentials.

The alternative was real and was rejected: a workflow in the user's own repo
could check out, run the agent and push, with no reachability problem at all
because the client would only ever talk to GitHub. It fails this constraint —
CI cannot use a Claude subscription, only a metered API key in repo secrets —
and it cannot answer a parked question mid-run. Worth revisiting only if the
transport below proves unworkable.

### What a browser will actually allow

Measured on 2026-08-19 rather than reasoned about, because two confident
predictions about browser behaviour turned out to be wrong.

**A hosted https client cannot reach a plain-http runtime.** From an https page,
a request to an http origin never left the browser — the target's access log
stayed empty even with `mode: 'no-cors'`, which bypasses CORS entirely. Mixed
content blocks it before the network. This is the wall, and no server-side change
moves it.

**Cross-origin between two http origins works, and CORS is a small fix.** The
same request from an http page arrived and was answered; the browser only hid the
response. The cause is narrow: the preflight already returns
`Access-Control-Allow-Origin: *` (Vite's dev middleware answers it) while the
API's own responses carry no CORS headers at all. A handful of lines.

**The localhost carve-out is still unverified.** Mixed content exempts localhost,
which is the entire basis for a hosted client reaching a local runtime — but it
could not be tested here, because the browser and the runtime were on different
machines and every `localhost` probe resolved to the browser's own machine where
nothing listens. It has to be measured where the two genuinely coexist, and given
the record above it should not be assumed.

### The shortlist that survives

Tailscale is out: it is one developer's setup, not something a user can be asked
to install. With no relay and no certificate authority within reach, three
options remain.

- **Localhost only.** Minimal effort — open the site, run one command — and
  desktop-only by construction. Depends entirely on the unverified carve-out.
- **Browser extension.** Has the privileges to ignore these rules, at the cost of
  install friction and a build per browser.
- **Native desktop app.** No browser rules apply at all, but the client becomes a
  download rather than a URL.

Cross-device from a phone browser is not among them. A phone reaching a LAN
address from an https page is blocked the same way, and the only fixes are a
relay or a certificate — both excluded. The phone needs a native client or it
waits.

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

Providing reachability — no relay, no tunnel, no hosted broker. Requiring a VPN.
Running the agent in CI. Accounts and identity, which have nowhere to live. Any
integration that requires a webhook receiver.

### Open questions

They live on [[IDEA-195]], the research note this design rests on: whether the
localhost carve-out holds, whether step one can put a GitHub token in the client
without breaking the principle above, whether the no-AI app is a reduced surface
or disabled controls, and whether plan-only is a state a project can sit in. The
runtime's scope, the registry's home and the fate of folder scanning were settled
there on 2026-08-21. Keeping them in one place stops two lists from drifting
apart.

### Phases
- [ ] Measure the localhost carve-out
      On one machine where the browser and runtime coexist, fetch an http localhost origin from an https page and confirm arrival in the server log.
- [ ] Add CORS headers to runtime API responses
      Let an http client read the cross-origin response the browser already delivers.
- [ ] Split plugins into two extension points
      Separate external services from local adapters, each with its own credential store and failure mode.
- [ ] Package the runtime as an installed repo dependency
      Ship it as a dev dependency run from the repo it serves, alongside the papercamp/ corpus.
- [ ] Choose the front door from the surviving shortlist
      Pick localhost, extension, or native based on the measurement.
