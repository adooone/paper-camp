---
id: IDEA-235
title: Stale entries and daemon root answers
type: fix
status: idea
created: 2026-09-05
tags:
  - cli
  - server
subject: Multi-project
order: 3
---

Three small wrongs found while checking the published 0.27.0 daemon.

**A deleted project is served as an empty one.** Register a repo, delete its
folder, request `/p/<slug>/api/plans`: the daemon answers `200
{"entries":[],"warnings":[]}` and `paper-camp ls` lists the path as if it
were there. `createProjectMounter` mounts whatever path the registry holds
without looking at it. The fix: a registered path without
`papercamp/config.json` is *missing*. The daemon refuses to mount it — 404
`paper-camp daemon: project folder missing at <path>` — and
`/api/machine/projects` reports `missing: true` for it, so the hub renders
the row greyed and unpickable instead of opening an empty desk. `ls` and
`status` print `missing` in the `STATE` column and, below the table, one hint:
`paper-camp rm <slug>` to forget it. Nothing is removed automatically; the
registry is the user's list.

**The daemon root answers `/api/*` with HTML.** `GET /api/capabilities` at
the root falls through `createDaemonRequestHandler` to `serveStatic` and
returns the SPA index with 200. `servesOwnRuntime` in `hub.ts` only knows
the root is not a project because that HTML fails `response.json()` — an
accident, not a contract. Any `/api/` path at the root other than
`/api/machine/projects` now answers 404 `{"error":"no project mounted at the
daemon root"}`. [[IDEA-234]]'s self-discovery reads this as the definitive
answer.

**The port-in-use remedy is `dev`'s.** `portInUseMessage` tells a daemon
user to "set port in papercamp/config.json for this project", which the
daemon never reads. It takes a variant for the daemon: `Port 4333 is already
taken — a daemon may already be running; paper-camp status shows it, or pick
another port with -p.` `dev` keeps its message.

### Out of scope

Re-scanning or pruning the registry on the daemon's behalf. Any change to how
`scan` decides what is a project.
