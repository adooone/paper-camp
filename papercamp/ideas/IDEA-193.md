---
id: IDEA-193
title: Client, runtime and plugin layers
type: feat
status: in-progress
created: 2026-08-19
updated: 2026-08-21
tags:
  - architecture
  - multi-project
  - app
subject: Multi-project
order: 2
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

### How the client reaches the runtime

Over loopback, and that is settled ([[IDEA-195]]). The hosted https client dials
`http://localhost:PORT`. Loopback is a potentially trustworthy origin, so the
mixed-content rule does not apply to it — which matters, because everything else
about http is closed.

That was measured on 2026-08-19, after two confident predictions about browser
behaviour turned out wrong. **A hosted https page cannot reach a plain-http
non-loopback address**: the request never left the browser, the target's access
log stayed empty even with `mode: 'no-cors'`, and no server-side change moves it.
That is precisely why loopback is the only address the client ever dials.
**Cross-origin http→http works**, arriving and being answered with only the
response hidden, because the API's own responses carry no CORS headers while
Vite's middleware answers the preflight.

Two pieces of engineering follow, and neither is a question. Responses need CORS
headers. And Private Network Access requires the runtime to answer the preflight
a public origin sends before it may reach a local one — the mechanism that
actually governs a hosted page dialling localhost, once mixed content is out of
the way.

### Plan-only, when no runtime is reachable

Not a degraded mode. With no runtime the client still does the whole planning
half — read the corpus, write ideas, order the queue, review — by talking to
GitHub itself with a token the user granted it by device flow or PKCE. Only
execution needs the machine: agent runs, git operations, checks, the filesystem.

This is what rewrites "the client holds nothing" into something precise: no
corpus, no account, and no credential it did not obtain from the user's own
authorization. No backend holds that token and no Paper Camp service sees it.

Every module therefore declares which layer it needs, and the client composes
from what is reachable. A module that needs the runtime stays visible and says so
in place. It is one app either way — a separate reduced build would drift from
this one and double the surface.

### Out of scope

Providing reachability — no relay, no hosted broker. Requiring a VPN. Running the
agent in CI. Accounts and identity, which have nowhere to live. Any integration
that requires a webhook receiver. Driving a machine you are not sitting at: the
tunnel, extension and native-app options are shelved on [[IDEA-195]], not
scheduled here.

### Nothing left open

[[IDEA-195]] carried the open questions this design rested on and they were all
settled on 2026-08-21: the front door, plan-only, the GitHub credential in the
client, capability-aware modules, local hosting alongside the hosted client, the
runtime's scope, the registry's home and the fate of folder scanning. What
remains on both notes is work.

### Phases
- [ ] Make the runtime answer a hosted origin
      CORS headers on API responses plus the Private Network Access preflight, so an https client can both reach and read `http://localhost:PORT`.
- [ ] Pair the client to the runtime
      A pairing token issued when the runtime announces itself, an allow-list for the hosted client's exact origin, and origin checking extended to reads.
- [ ] Detach the client
      Ship the bundle as an artifact that takes a runtime URL, keeping `paper-camp dev` serving the same bundle locally.
- [ ] Make every module declare the layer it needs
      Capability-aware modules so the client composes from what is reachable and a runtime-only feature says so in place.
- [ ] Reach the corpus with no runtime
      The client talks to GitHub directly with a device-flow or PKCE token, which is what makes plan-only real.
- [ ] Split plugins into two extension points
      Separate external services from local adapters, each with its own credential store and failure mode.
- [ ] Package the runtime as an installed repo dependency
      Ship it as a dev dependency run from the repo it serves, alongside the papercamp/ corpus.

### Thread
- [x] 2026-08-21 [log] [agent] It's an unresolved research note whose measurement (localhost carve-out) and settled decisions (runtime scope, registry home, folder scanning) are the frozen contract IDEA-117 and IDEA-201's board conversion explicitly depend on.
- [x] 2026-08-21 [log] [agent] IDEA-193 is the note IDEA-201 converts into a board and whose open questions IDEA-117 is explicitly blocked on, so its unresolved sequencing must be settled before the hub can proceed.
- [x] 2026-08-21 [log] [agent] Its own body says the client/runtime split, CORS, plugin extension points and the registry's home were the open research this idea itself settles, and IDEA-117 and IDEA-201's first ticket both depend on decisions made here.
- [x] 2026-08-21 [question] [agent] Run-all parked on phase 1 ("Measure the localhost carve-out") — the agent needs a decision: I can't run a browser to measure the localhost carve-out (headless, no display). Do you want to run this yourself, or would you like me to first prepare a minimal throwaway harness for you to run, without checking the phase off until you report back?
- [x] 2026-08-21 [decision] Neither: the measurement is dropped. Loopback is the settled front door ([[IDEA-195]]), so phase 1 is replaced by the engineering it actually implies — CORS headers and the Private Network Access preflight. The harness built for it is shelved, unused.
- [x] 2026-08-21 [decision] Worth keeping from the attempt: a mixed-content block and a plain connection failure are indistinguishable from JS, both surfacing as `TypeError: Failed to fetch`, so any future browser-reachability claim has to be read from the server's own log rather than the client.
