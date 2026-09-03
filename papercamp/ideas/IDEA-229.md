---
id: IDEA-229
title: Explain the blocked http runtime
type: fix
status: idea
created: 2026-09-03
updated: 2026-09-03
tags:
  - cli
  - app
subject: Multi-project
order: 1
---

`paper-camp dev` and `paper-camp daemon` print a Network row that points the
hosted client at the runtime:

```
➜  Network: https://paper-camp.vercel.app/?runtime=http%3A%2F%2Fdeimos.pitta-ray.ts.net%3A3941&token=…
   open the Network link on another device to pair it with this machine
```

That link cannot work. The page is HTTPS, the runtime is `http://` on a
non-loopback host, so the browser refuses every request to it as active mixed
content — measured against a live 0.26.0 runtime: the fetch is refused in
0–1ms, against 124ms for an HTTPS control. `networkRegistrationLink` always
builds `http://${host}:${port}`, and nothing in the client checks the scheme,
so the promise in the banner is unconditional and the failure is total.

The failure is also silent. A blocked fetch leaves `remoteVersion === null` in
`use-runtime-statuses.ts`, which maps to `UNREACHABLE`, which renders the row
as **Plan-only** — the same stamp a runtime that is merely switched off gets.
The project registers, the row appears, and the only way to learn that the
browser refused the scheme is to open devtools. `--tailnet` and `--share` both
solve it by giving the runtime an HTTPS address, and neither is mentioned at
the moment the user needs it.

Both surfaces stop guessing and state the constraint.

**The banner prints the remedy, not a dead link.** A client origin decides what
a runtime needs: an HTTPS client requires an HTTPS runtime, an HTTP client
accepts either. When the pair is incompatible the Network row is omitted
entirely — printing a caveat under a link that cannot function is worse than
printing no link — and replaced by the fix:

```
➜  Local:   http://localhost:3941
   Another device needs an HTTPS address — rerun with --tailnet or --share.
```

Compatible pairs are unchanged, so `--tailnet`, `--share`, and a
`PAPERCAMP_HOSTED_CLIENT_URL` override onto an http origin all keep the link
they print today. `dev` and `daemon` share the check, since they share the
banner ([[IDEA-227]]).

**The hub names the reason.** A row whose runtime URL is `http://` while the
hub's own origin is `https:` stamps **Needs HTTPS**, not Plan-only, with a
tooltip saying the browser blocked the connection and to rerun the runtime
with `--tailnet` or `--share`. The scheme comparison needs no request, so the
stamp is correct before the probe resolves rather than after it times out, and
a genuinely unreachable HTTPS runtime still reads Plan-only as it should.

USAGE.md's "Adding a project" step 2 promises the Network link pairs any
device. It gets the same qualification: the hosted client needs an HTTPS
runtime, which is what `--tailnet` and `--share` are for.

### Out of scope

Proxying an http runtime through the hosted client — that would put project
traffic through a third party and is the opposite of local-first. Pairing and
trust semantics, which are unchanged; this only decides what is printed and
what stamp is shown. Enabling tailnet HTTPS certificates, which is a Tailscale
admin-console setting on the user's side and already has its own message
([[IDEA-222]]).

### Phases
- [x] Decide reachability from the two origins
      Add a helper to `registration-link.ts` that takes the client origin and the runtime URL and reports whether the browser will allow the connection: an `https:` client needs an `https:` runtime, an `http:` client accepts either, and loopback is always allowed. Unit-test the matrix.
      run: 2m17s · 24 in · 5.5k out · sonnet-5
- [x] Print the remedy instead of a dead Network row
      When the pair is incompatible, omit the Network row and the pairing note and print the `--tailnet`/`--share` line in their place. Wire it through both `dev-server.ts` and `daemon-server.ts` so the two banners stay identical.
      run: 10m28s · 76 in · 21k out · sonnet-5
- [x] Stamp Needs HTTPS in the hub
      Carry a scheme-blocked flag through `use-runtime-statuses.ts` from the runtime URL and `window.location.protocol`, and branch `project-row.tsx` to a warning stamp with the tooltip before the unreachable branch.
      run: 7m31s · 76 in · 22.5k out · sonnet-5
- [ ] Correct USAGE.md and run the quality checks
      Qualify the Network-link step with the HTTPS requirement and name the two flags; check-types, lint, vitest, consistency green.

### Thread
- [x] 2026-09-03 [log] [agent] Found while verifying the 0.26.0 release against the published tarball. The rest of the release checked out clean: init scaffolds the corpus plus a `.gitignore` entry and a `0600` pairing file, `doctor` passes on a fresh scaffold, SIGTERM/SIGINT shut the server down in under a second, the daemon serves `/api/machine/projects` and mounts `/p/<slug>/` lazily, `PAPERCAMP_CONFIG_DIR` leaves the real registry untouched, and the hosted client's bundle is byte-identical to the one in the package (md5 8d479ba1a9286554195ea2732dcd4b23), so version skew cannot misfire. This was the only defect.
