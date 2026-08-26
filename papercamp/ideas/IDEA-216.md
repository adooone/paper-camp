---
id: IDEA-216
title: Pairing survives dev restarts
type: feat
status: idea
created: 2026-08-26
tags:
  - cli
  - server
subject: Multi-project
---

The hosted client's trust in a runtime is a pairing: the Network link's token,
posted once to `/api/pair`, adds the client's origin to an allow-list. Both
halves of that state live only in process memory — `createPairingManager`
(`src/app/server/pairing.ts`) mints a fresh random token on every boot and
starts with an empty origin set — so every restart of `paper-camp dev`
silently unpairs every hosted client. The client's stored connection keeps the
stale token, re-pairing fails, and the project row degrades to Plan-only until
the user digs the freshly printed Network link out of the terminal and opens
it again. Local, LAN, and tailnet origins never notice (network topology
vouches for them); the papercut lands exactly on the hosted-client path the
hub guide in `USAGE.md` steers people toward.

Persist the pairing state to `papercamp/.pairing.json`, alongside the other
machine-local gitignored files (`tasks.log`, `pr-map.json`): `{ "token":
"...", "origins": ["..."] }`, written with mode 0600 on first mint and after
every successful pair. The seam already exists — `createApiMiddleware` accepts
a `pairingState` and exposes `getPairingState()` — so the CLI dev server loads
the file at boot, passes it in, and writes through that seam. `paper-camp
init` appends `papercamp/.pairing.json` to the repo's `.gitignore`, creating
the file when missing; this repo adds the line to its existing papercamp
block.

A stable token means every Network link ever printed keeps working across
restarts, and a hosted client paired once stays paired. Deleting the file is
the revocation story: the next boot mints a fresh token and forgets every
paired origin. The hub section of `USAGE.md` drops its re-pair caveat once
this lands.

### Out of scope

Pairing UI. The vite-plugin dev path, which already carries state across
reloads within one process.

### Phases
- [x] Read and write the pairing file
      Load `papercamp/.pairing.json` into a `PairingManagerState`, tolerating a
      missing or malformed file, and save it with mode 0600.
      run: 2m43s · 42 in · 6.3k out · sonnet-5
- [x] Persist through the dev server
      Load the state before `createApiMiddleware(root)`, pass it in, and write
      `getPairingState()` back on first mint and after every successful pair.
      run: 2m39s · 34 in · 5k out · sonnet-5
- [ ] Gitignore the file from `paper-camp init`
      Append the line to the repo's `.gitignore`, creating it when missing, and
      add it to this repo's existing papercamp block.
- [ ] Cover restart, revocation, and init in tests
      A reloaded state keeps the token and origins; a deleted file mints fresh.
- [ ] Drop the re-pair caveat from `USAGE.md`
      Replace it with deleting the file as the revocation story.
