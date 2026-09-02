---
id: IDEA-222
title: Tailnet-first project discovery
type: feat
status: review
created: 2026-09-01
updated: 2026-09-02
tags:
  - cli
  - app
  - server
subject: Multi-project
order: 1
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
- [x] Read the local tailnet identity
      One module shelling out to `tailscale status --json` for `Self.DNSName`, `MagicDNSSuffix`, and online peers; absent or offline Tailscale returns nothing and every caller degrades to today's behaviour.
      run: 5m29s · 64 in · 13.6k out · sonnet-5
- [x] Prefer the MagicDNS name in the dev banner
      The Network link uses `<node>.<tailnet>.ts.net` when Tailscale is up, falling back to the current address order.
- [x] Serve over HTTPS with `paper-camp dev --tailnet`
      Run `tailscale serve --bg --https=443`, print the https registration link, and report a missing tailnet certificate setting with the admin-console link.
      run: 10m49s · 102 in · 25.6k out · sonnet-5
- [x] Probe tailnet peers for runtimes
      Parallel `/api/capabilities` probes of online peers with a short timeout, session-cached, exposed on the runtime API.
      run: 7m36s · 88 in · 21.9k out · sonnet-5
- [x] Offer discovered runtimes in the hub
      Discovered peers appear in the connection column as addable entries in [[IDEA-221]]'s registry; never auto-added, refreshable on demand.
      run: 8m59s · 90 in · 29.7k out · sonnet-5
- [x] Document the tailnet and mobile paths
      `USAGE.md` gains the tailnet setup, the installed-PWA mobile path, and the plain statement that any `.ts.net` origin is trusted without a token.
      run: 4m40s · 28 in · 10.9k out · sonnet-5
- [x] [manual] Prefer tailnet MagicDNS host in registration link

### Thread
- [x] 2026-09-01 [log] [agent] Run order: Explicitly lands after IDEA-221's unified registry (already done) and its discovery entries feed the same registry IDEA-224 generalizes, so it precedes the daemon that subsumes its per-project probing.
- [ ] 2026-09-02 [question] [agent] Run-all parked on phase 2 ("Prefer the MagicDNS name in the dev banner") — the agent needs a decision: ` followed by your question, then stop without finishing the phase.  When the work is done: 1. In the plan file's `### Phases` list, change this phase's checkbox from `- [ ]` to `- [x]`. Do not change any other line. 2. If every phase in the list is now checked, set the plan's `status:` frontmatter field to `review` — never `done`; per this repo's AGENTS.md a human promotes plans to done. --output-format stream-json --verbose --permission-mode auto --strict-mcp-config --disallowedTools WebFetch WebSearch --model sonnet --effort high --resume 58c03690-7a91-4ae6-9834-9cae1e162c38
- [x] 2026-09-02 [chat] what decision do you need? I dont understand
- [x] 2026-09-02 [chat] [agent] The run stopped on phase 2 asking about whether to prefer MagicDNS or IP fallback — but that phase is actually already checked off (done last session). Looks like the agent picked up a stale prompt from an earlier run. Nothing for you to decide here; if it stalls again on the same question, let me know and I'll clear it and re-kick phase 3 (the HTTPS serving work).
