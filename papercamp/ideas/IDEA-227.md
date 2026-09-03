---
id: IDEA-227
title: Daemon prints the dev banner
type: feat
status: idea
created: 2026-09-03
tags:
  - cli
subject: Multi-project
---

`paper-camp daemon` is becoming the primary way in — one process per machine
serving every registered project ([[IDEA-224]]) — but its startup output is
three plain lines and a raw secret:

```
paper-camp daemon listening on http://localhost:4333
Pairing token: 604d20df5e82164b822b1996ed71d997343f6b4391f3d2f4ac4b43273a513555
Registered projects mount lazily at /p/<slug>/ on first request.
```

`paper-camp dev`, meanwhile, prints a formatted banner with Local and
Network rows, prefers the machine's MagicDNS name when Tailscale is up
([[IDEA-222]]), and hands over a registration link that opens the hosted
client already paired. The daemon reproduces none of it, so connecting from
a second device means reading a 64-character token off the terminal and
assembling the URL by hand — the exact papercut the banner was built to
remove, on the command now meant to be used every day.

The daemon adopts the same banner. `formatDevBanner` already takes a
version, a local URL, and an optional network link, and
`networkRegistrationLink` already resolves the best host, so this is
composition rather than new machinery. The daemon's rows carry its own
port, and its Network link points at the daemon root — the hub connects to
a machine and reads its project list from `/api/machine/projects`, rather
than to any single project. `--tailnet` and `--share` extend to the daemon
on the same footing, since a machine-level address is exactly what those
were for.

The bare token line goes away. It is a credential printed in full for a
step the link performs, and the link already embeds it; the banner's
Network row replaces it. The mount-lazily line stays as a dim note, and the
existing "mounted <slug>" log on first request stays as it is.

### Out of scope

The banner's own format, which is settled. The hub's connect-to-a-machine
surface. Pairing semantics — this changes only what is printed.

### Phases
- [x] Give the daemon the shared banner
      Print `formatDevBanner` with the daemon's port and a Network link from `networkRegistrationLink`, replacing the three plain lines; keep the lazy-mount note as a dim row.
      run: 2m45s · 38 in · 8.8k out · sonnet-5
- [x] Drop the bare pairing token line
      The Network link carries the token; printing it separately exposes a credential for no remaining purpose.
      run: 28s · 14 in · 1.2k out · sonnet-5
- [ ] Extend `--tailnet` and `--share` to the daemon
      Same flags, same `Tailnet:` and `Tunnel:` rows, resolved against the daemon's port.
- [ ] Cover the daemon banner in tests and run the quality checks
      Banner rows and token absence asserted; check-types, lint, vitest, consistency green.
