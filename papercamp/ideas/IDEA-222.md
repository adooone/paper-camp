---
id: IDEA-222
title: Tailnet-first project discovery
type: feat
status: idea
created: 2026-09-01
tags:
  - cli
  - app
  - server
subject: Multi-project
---

Every machine on a tailnet already runs its own checkout, its own agent CLIs
and its own credentials, so "use the tools on that machine" is just
connecting to the runtime already there. paper-camp half-supports this
today: `api.ts` trusts `.ts.net` hosts and the `100.64/10` range as
network-scoped (tailnet origins skip pairing entirely), and
`bestNetworkHost` already prefers a tailnet address for the dev banner's
Network link. What is missing is the naming, the transport, and the
discovery that turn it into the default path.

**MagicDNS names, not raw IPs.** The banner prints `100.80.79.13:3333`
today; `tailscale status --json` carries `Self.DNSName` and
`MagicDNSSuffix` with no account or API token, just the local CLI. A
MagicDNS name is stable across reboots and IP churn, is already on the
trusted-host list, and is the only form that can carry a certificate. The
banner prefers it whenever Tailscale is up, falling back to today's address
order otherwise.

**HTTPS is required, not optional.** Measured in Chrome against
`https://paper-camp.vercel.app`: every `http://` fetch is refused in 0–1ms
with no network attempt (mixed-content blocking), while an `https://`
control succeeds in 124ms. So the hosted client — desktop or installed as
the PWA `public/manifest.json` already defines — can never reach a plain
`http://` runtime, tailnet or otherwise. `paper-camp dev --tailnet`
therefore runs `tailscale serve --bg --https=443` for the user, prints the
`https://<node>.<tailnet>.ts.net` registration link, and says plainly what
it did; a missing HTTPS-certificates setting is reported with the admin
console link rather than a raw failure. The manual steps in `README.md`
become the fallback path, not the only one.

**Discovery.** `tailscale status --json` lists every peer with its DNS name
and online state. `paper-camp dev` probes the online peers' `/api/capabilities`
in parallel with a short timeout, and the hub offers whatever answers as
addable projects — replacing the pasted URL for the common case. Discovery
is read-only and never auto-adds; the user still picks. Results are cached
for the session and refresh on demand.

Discovered entries slot into the unified registry [[IDEA-221]] builds, so
this lands after it. Tailscale is implemented concretely — one module
shelling out to the CLI — with no provider abstraction until a second
network actually arrives.

**Trust stays as it is, and is stated.** Any `.ts.net` origin is already
trusted tokenlessly. That is right for a personal tailnet and worth saying
out loud in `USAGE.md`, because on a shared tailnet it means every member's
device is trusted by the runtime.

### Out of scope

Remote agent execution — running an agent on machine A against machine B's
working tree. The multi-runtime model already covers "use that machine's
tools" by connecting to the runtime that owns that checkout, and syncing a
working tree across hosts contradicts the folder-is-the-database premise.
A provider abstraction for other VPNs. Any native mobile app: the hosted
PWA on a tailnet-joined phone is the mobile story.

### Phases
- [ ] Read the local tailnet identity
      One module shelling out to `tailscale status --json` for `Self.DNSName`, `MagicDNSSuffix`, and online peers; absent or offline Tailscale returns nothing and every caller degrades to today's behaviour.
- [ ] Prefer the MagicDNS name in the dev banner
      The Network link uses `<node>.<tailnet>.ts.net` when Tailscale is up, falling back to the current address order.
- [ ] Serve over HTTPS with `paper-camp dev --tailnet`
      Run `tailscale serve --bg --https=443`, print the https registration link, and report a missing tailnet certificate setting with the admin-console link.
- [ ] Probe tailnet peers for runtimes
      Parallel `/api/capabilities` probes of online peers with a short timeout, session-cached, exposed on the runtime API.
- [ ] Offer discovered runtimes in the hub
      Discovered peers appear in the connection column as addable entries in [[IDEA-221]]'s registry; never auto-added, refreshable on demand.
- [ ] Document the tailnet and mobile paths
      `USAGE.md` gains the tailnet setup, the installed-PWA mobile path, and the plain statement that any `.ts.net` origin is trusted without a token.
