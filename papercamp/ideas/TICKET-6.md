---
id: TICKET-6
title: Reachable from anywhere
type: feat
kind: ticket
status: review
idea: IDEA-195
created: 2026-08-22
updated: 2026-08-22
tags:
  - runtime
  - transport
  - security
subject: Multi-project
---

The hosted client works and the runtime answers it — but only when both sit on the same machine. Everything else in the chain shipped; this is the one gap left before the deployed URL is usable by anyone who isn't sitting at the machine running `paper-camp dev`.

### What actually works, measured 2026-08-22

| Client | Runtime | Works | Why |
| --- | --- | --- | --- |
| local `paper-camp dev` | same machine | yes | same origin |
| local `paper-camp dev` | LAN or tailnet host | yes | http→http, CORS already shipped |
| hosted https | same machine, `localhost` | yes | loopback is exempt from mixed content, and the Private Network Access preflight already ships |
| hosted https | another machine over http | **no** | mixed content, rejected before the request leaves the browser |
| hosted https | another machine over **https** | yes | nothing to block |

The last two rows are the whole problem. From `https://paper-camp.vercel.app` a fetch to a non-loopback http address fails in 2ms without touching the network, while the same fetch to `http://localhost` takes 25ms and returns a real connection refusal. The wall is mixed content and no server-side change moves it — so the runtime needs an https address whenever the browser is elsewhere.

### Settled

**Two tiers, and the common one stays free.** A user running the runtime on the machine they browse from needs nothing: open the hosted URL, run `paper-camp dev`, click the registration link. That path is already complete and must not grow a step. Only the cross-machine case pays for a tunnel.

**The runtime opens the tunnel, not the user.** `paper-camp dev --share` spawns `cloudflared tunnel --url` itself, reads the `https://…trycloudflare.com` address it prints, adds that host to its own allow-list, and prints one registration link carrying the https runtime URL and the pairing token. The user runs one command and clicks one link; nothing about tunnels is theirs to configure. Verified 2026-08-22: an account-less quick tunnel issues a valid certificate — `curl` verified it with `ssl_verify 0` — and needs no login.

**A tunnel is the user's own, so it does not breach "nothing is hosted on the user's behalf".** That constraint forbids infrastructure *Paper Camp* operates. A quick tunnel is spawned by the user's own process, on their machine, and dies with it, the same way their `gh` credentials are theirs. Paper Camp operates nothing and holds nothing.

**A missing Origin must stop meaning "trusted".** Today `isForbiddenRequest` gates on Host, then checks Origin only when the header is present. Browsers always send it cross-origin, so the browser path is safe — but a public tunnel is reachable by things that are not browsers, and `curl` sending no Origin at all would pass straight through to an API that runs git and spawns agents. Sharing cannot ship before a request with no trusted Origin has to carry the pairing token.

**The share is opt-in and ephemeral.** No flag, no tunnel. The address changes every restart, which is the correct default for something that exposes a machine — a stable address is worth having only once someone asks for it.

### Rejected, and why

**Requiring Tailscale.** `tailscale serve` gives a stable hostname and a real certificate with no third party in the path, and it is the better answer for anyone already on a tailnet — but it needs Tailscale installed, HTTPS enabled on the tailnet, and `sudo` for the certificate. Documented as the power-user route, never the default.

**A named Cloudflare tunnel.** Fixes the changing address, reintroduces an account and a domain.

**A browser extension or a native app.** Both sidestep browser rules entirely and both replace "open a URL" with "install something", which is the property that makes the hosted client worth having.

### Phases
- [x] Require the pairing token when no trusted Origin is present
      Close the gap where a request carrying no `Origin` header passes on the Host check alone — the precondition for exposing the runtime at all.
      run: 8m · 6.9k in · 27.7k out · sonnet-5
- [x] Spawn a quick tunnel behind `paper-camp dev --share`
      Start `cloudflared`, read the issued https address, and allow-list that host on the running runtime.
      run: 5m14s · 1k in · 12k out · sonnet-5
- [x] Print one registration link for the tunnel
      The https runtime URL and pairing token in a single link, alongside the existing local addresses.
      run: 4m · 1.5k in · 6.2k out · sonnet-5
- [x] Fail honestly when `cloudflared` is missing
      Detect it up front and say how to install it, rather than starting and dying without an address.
      run: 4m6s · 875 in · 7.4k out · sonnet-5
- [x] Document the tailnet route for anyone already on Tailscale
      `tailscale serve` as the stable-address alternative, with the certificate and HTTPS-enable steps it needs.
      run: 1m50s · 369 in · 6k out · sonnet-5
