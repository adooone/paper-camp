---
id: IDEA-258
title: Publish triggers the update
type: feat
status: idea
created: 2026-09-11
tags:
  - cli
  - server
  - ci
subject: Run & monitor
order: 1
---

[[IDEA-257]] made the daemon update itself by asking the npm registry
every thirty minutes. That is forty-eight requests a day that almost
always learn nothing, and up to half an hour between a release landing
and the machine running it. The poll exists because the machine sits on
the tailnet and GitHub cannot call it. It can now: the Tailscale GitHub
Action joins a workflow runner to the tailnet for the length of a job, so
the one party that knows a release happened — the Publish workflow, the
moment `npm publish` returns — can tell the daemon directly.

**One endpoint, one token.** The daemon answers
`POST /api/machine/update` at its root, beside `/api/machine/projects`.
The request carries the released version in its body and a bearer token
that must equal the machine's update token: minted once into
`~/.config/paper-camp/update-token` (honouring `PAPERCAMP_CONFIG_DIR`)
the first time the daemon starts, printed by `paper-camp update-token`,
and never shown by `status`. The handler runs the same install-and-restart
code `pollForUpdate` runs today — install through the shim, verify the
entry's version, hold the restart while the machine is busy — and
answers `200` with what it did: `installed`, `waiting for idle`, `already
current`, or `failed` with the install output. A wrong or missing token
gets `403`; a request from outside the tailnet never reaches the handler,
since the host check already refuses it.

**The workflow calls it.** After *Publish to npm*, `publish.yml` gains a
step that joins the tailnet with `tailscale/github-action` using an OAuth
client scoped to `tag:ci`, then `curl`s
`https://deimos.pitta-ray.ts.net/api/machine/update` with the version and
the token. The OAuth client id and secret and the update token are three
repository secrets; the ACL allows `tag:ci` to reach the machine on 443
only. A failed call fails the step but not the workflow: the package is
published either way, and the daemon catches up on its own as below.

**No timer.** The thirty-minute poll and `--no-auto-update` are removed.
What stays is one registry check when the daemon starts, so a machine
that was off or a daemon that was down at publish time installs the
release on its next boot, and the pending-restart state from IDEA-257,
so a hook that arrives mid-run restarts once the machine goes idle.
`paper-camp update` keeps working by hand. `paper-camp status` shows the
last update event — `hooked 0.30.2 at 20:41`, `boot check current`, or
the pending version — instead of a last poll time.

**The hub is told the same way.** The machine card's pending stamp reads
the same field it does today; nothing changes in the client.

### Out of scope

Exposing the daemon publicly; the runner joins the tailnet, the daemon
stays private. Updating more than one machine from one workflow; a
second machine registers its own hook step. Rolling back.
