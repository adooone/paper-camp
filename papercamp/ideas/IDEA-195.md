---
id: IDEA-195
title: Global client, local runtime
kind: note
status: open
created: 2026-08-19
updated: 2026-08-21
tags:
  - architecture
  - research
subject: Multi-project
---

Research and settled decisions for turning Paper Camp from one local app into a
hosted client driving work on the user's own machine. Collects what
[[IDEA-117]] and [[IDEA-193]] depend on, so neither has to restate it.
([[IDEA-192]] drew on it too and has since shipped.)

### Settled

**Nothing is hosted on the user's behalf.** Paper Camp publishes a UI and a
package. No server, no accounts, no corpus storage, no relay it operates. A
static client on a CDN is fine: it holds no data and runs nothing.

**Execution stays on the user's machine, on the user's plan.** The agent CLI is
already authenticated and already paid for there. This is the constraint that
costs the most and it was chosen deliberately over the alternative below.

**Git is the database.** The corpus stays per-repo, as [[IDEA-117]] settles.
Centralize the lens, never the data.

**Three layers.** A thin client that collects intent and decides nothing; a
runtime that owns the filesystem, git, the agent and the checks; plugins that
reach other systems. Plugins are two kinds with different trust boundaries —
*external services* the runtime speaks to (GitHub via an authenticated `gh`) and
*local adapters* it drives (`claude-code`, `opencode`, already pluggable).

**Two-step onboarding.** Step one: the web app connects GitHub repos and
installs the methodology — docs, config, corpus — via a PR. Usable with no AI
and no install, as a PM system in the repo. Step two: install the local package
to add execution. Step one is shippable without answering any transport
question, which is what makes this sequence valuable.

**One runtime per repository.** The runtime stays what [[IDEA-193]] settles it
is — a dev dependency of the repo it serves — and the client fans out across as
many as the user registers. Everything a runtime does is already repo-scoped: it
shells `git`, `gh` and the agent binary with the repo as cwd and runs that repo's
own checks, so one runtime managing many would still fork per-repo subprocesses,
and would additionally force a single paper-camp version on every project — the
skew [[IDEA-168]] exists to tolerate. [[IDEA-117]]'s promise was one desk, not
one process; N ports become registry detail the user never sees.

**The registry is device-local.** The client keeps the list of runtime URLs in
browser storage, per device. [[IDEA-193]]'s "the client holds nothing" narrows
accordingly — no corpus, no credential, no account — because a list of addresses
it was told to remember is connection state, not data. A desk repo in git would
sync across devices but needs a runtime to read the registry that says where the
runtimes are; probing for whatever answers stores nothing but makes an offline
project vanish, when knowing it exists is the point of a hub.

**Projects are registered, never discovered by scanning.** Folder scanning from
[[IDEA-117]] is dropped: a repo-scoped runtime has no business reading disk
outside its repo, and a client cannot read disk at all. A project enters the
registry when its runtime announces itself — `paper-camp dev` prints a
registration URL — or, when it has no runtime yet, through the GitHub import in
step one of onboarding. The registry holds both kinds of entry, and a project
whose runtime is unreachable is shown as unavailable rather than hidden.

### Measured, not assumed

Spiked 2026-08-19 against a real browser, after two confident predictions about
browser behaviour proved wrong.

- **A hosted https client cannot reach a plain-http runtime.** The request never
  left the browser — the target's access log stayed empty even with
  `mode: 'no-cors'`, which bypasses CORS entirely. Mixed content, and no
  server-side change moves it.
- **Cross-origin http→http works; CORS is a small fix.** The request arrived and
  was answered; only the response was hidden. The preflight already returns
  `Access-Control-Allow-Origin: *` from Vite's middleware while the API's own
  responses carry no CORS headers.
- **The localhost carve-out is unverified.** It is the entire basis for a hosted
  client reaching a local runtime, and it could not be tested: the browser and
  the runtime were on different machines, so every `localhost` probe resolved to
  the browser's own machine where nothing listens. Measure it where the two
  coexist before building on it.

### Rejected, and why

**Running the agent in GitHub Actions.** Removes the connection problem entirely
— the client would only ever talk to GitHub. Fails because CI cannot use a
Claude subscription, only a metered API key in repo secrets, and because a
workflow cannot answer a parked question mid-run. Revisit only if no transport
proves workable.

**Requiring Tailscale.** It solves TLS elegantly via `tailscale serve`, and it is
one developer's setup. Users cannot be asked to install a VPN.

### Security, which gates the remote paths

The runtime authenticates by network topology: `isTrustedHost` accepts anything
arriving from loopback, private LAN, `.ts.net`, `.local`, this machine's own
hostname, or an entry in `PAPERCAMP_ALLOWED_HOSTS`. That answers "is the caller on
a network that points at this machine", never "is this caller allowed".

Origin checking is already half-built, so it should not be respecified from
scratch. `isForbiddenRequest` rejects a foreign `Origin` on every mutating
method, which means a website a user visits cannot drive a local runtime's
writes today. It can still read one — the check runs on POST/PUT/PATCH/DELETE
only — and no pairing token exists, so nothing distinguishes an allowed caller
from any other caller sitting on a trusted network.

The tunnel consequence is unchanged and is the harder one: a tunnel makes every
request arrive at loopback, so the topology check passes for the entire internet
— publishing an API that runs git and spawns agents, protected only by an
unguessable URL.

What remains is therefore a pairing token and origin checking on reads, not
origin checking as such. Authentication is still the precondition for every
remote option, which is why it sequences first.

### Transport options still open

- **Localhost.** Minimal effort, desktop-only, depends on the unverified carve-out.
- **Cloudflare tunnel.** `cloudflared tunnel --url` gives a valid certificate and
  a public https URL with no account, dissolving the mixed-content wall and
  reaching a phone over cellular. Costs: a fresh URL every restart, rate limits,
  a third party in the critical path, and it is unusable until auth exists.
  Named tunnels fix the URL but reintroduce an account and a domain.
- **Browser extension.** Has the privileges to ignore browser rules; costs
  install friction and a build per browser.
- **Native desktop app.** No browser rules apply; the client becomes a download.

Cross-device from a phone browser is not achievable without a certificate or a
relay, so it needs a tunnel, a native client, or it waits.

### Sequencing

1. Contract and auth — freeze the runtime's HTTP surface, add pairing and CORS.
2. Detach the client — ship the bundle as an artifact taking a runtime URL.
3. Multi-project registry and switcher ([[IDEA-117]]).
4. GitHub import and scaffold-by-PR.
5. Plugins as a real extension point.

### Thread
- [ ] 2026-08-19 [question] Does the localhost carve-out hold? Measure on a machine where the browser and the runtime coexist: an https page fetching `http://localhost:PORT`, checking the server's log for arrival rather than trusting the JS error. Everything else waits on this — if it fails, the hosted front door is impossible and only an extension or a native app remain.
- [ ] 2026-08-19 [question] Step one needs the browser to talk to GitHub directly, which means a token in the client — contradicting the "no credential" half of the narrowed principle above. Device flow or PKCE makes it backend-free, but the principle has to be rewritten rather than quietly broken.
- [ ] 2026-08-19 [question] Is the no-AI step-one app a reduced surface or the same app with disabled controls? Most of the current UI is agent-shaped, so the first is credible and the second looks broken.
- [ ] 2026-08-19 [question] Is plan-only a first-class state a project can live in indefinitely, or a temporary condition on the way to attaching a runtime?
- [x] 2026-08-21 [decision] One runtime per repository, not one managing many: the runtime stays a repo dev dependency and the client fans out across N of them, so [[IDEA-117]]'s hub is a client concern rather than a runtime one.
- [x] 2026-08-21 [decision] The project registry lives in the client's device-local browser storage, narrowing [[IDEA-193]]'s "the client holds nothing" to no corpus, no credential, no account.
- [x] 2026-08-21 [decision] Folder scanning is dropped: a project enters the registry when its runtime announces itself, or through GitHub import when it has no runtime yet.
