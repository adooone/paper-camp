---
id: IDEA-195
title: Global client, local runtime
kind: note
status: open
created: 2026-08-19
updated: 2026-08-19
tags:
  - architecture
  - research
subject: Multi-project
---

Research and settled decisions for turning Paper Camp from one local app into a
hosted client driving work on the user's own machine. Collects what several
ideas depend on — [[IDEA-117]], [[IDEA-193]], [[IDEA-192]] — so none of them has
to restate it.

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
arriving from loopback, private LAN, `.ts.net` or `.local`. That answers "is the
caller on a network that points at this machine", never "is this caller allowed".

Two consequences. Any website a user visits could probe for a local runtime and
drive it, so origin checking and a pairing token are mandatory for a hosted
client, not refinements. And any tunnel makes every request arrive at loopback,
so the check passes for the entire internet — publishing an API that runs git and
spawns agents, protected only by an unguessable URL.

Authentication is therefore the precondition for every remote option, which is
why it sequences first.

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
- [ ] 2026-08-19 [question] [human] Does the localhost carve-out hold? Measure on
      a machine where browser and runtime coexist, checking the server's log for
      arrival rather than trusting the JS error.
- [ ] 2026-08-19 [question] [human] Step one needs the browser to talk to GitHub
      directly, which means a token in the client — contradicting [[IDEA-193]]'s
      "the client holds nothing". Device flow or PKCE makes it backend-free, but
      the principle has to be rewritten rather than quietly broken.
- [ ] 2026-08-19 [question] [human] Is the no-AI step-one app a reduced surface or
      the same app with disabled controls? Most of the current UI is agent-shaped,
      so the first is credible and the second looks broken.
- [ ] 2026-08-19 [question] [human] One runtime per repo, or one managing many?
      "Installed into the repository" implies per-repo; [[IDEA-117]] wants the hub
      precisely to avoid N servers on N ports.
