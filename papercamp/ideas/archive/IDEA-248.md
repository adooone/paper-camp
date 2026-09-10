---
id: IDEA-248
title: The daemon API as a contract
type: docs
status: dropped
created: 2026-09-10
updated: 2026-09-10
tags:
  - server
  - cli
  - docs
subject: Mobile control desk
---

The daemon is the only server now: every registered project is reached
through `/p/<slug>/api/*`, the machine through `/api/machine/projects`,
pairing through `/api/pair`, and live changes through
`/api/activity/stream`. The hosted client consumes all of it, but nothing
describes it. The routes are declared across `src/app/server/routes/*.ts`,
their shapes live in `src/types/index.ts` next to the client's own types,
and a change to either is caught only by the one client that happens to
exist. A second client — [[IDEA-250]]'s native app, a CLI on another
machine, someone else's tool — would have to read the server to learn the
surface, and would break silently when it moved.

**One OpenAPI document, generated from the routes.** `docs/api/openapi.yaml`
describes every route the daemon serves: the machine endpoints at the root,
the project endpoints under `/p/{slug}`, pairing, and the activity stream
as a server-sent-events endpoint with its event types. Request and response
schemas come from the same `zod` schemas the routes validate with, so the
document cannot drift from the code: `pnpm api:doc` regenerates it, and a
check in CI fails when the committed file differs from the generated one.
Routes that validate nothing today gain a schema first; that is the
audit this idea forces.

**A version the client can check.** The document carries a version
independent of the package version, bumped only when a route or shape
changes in a way a client must know about. `/api/package-name` already
returns the runtime version; it also returns `apiVersion`, and the
`Version mismatch` stamp in the hub compares that instead of the package
version, so a client is only told to update when the contract moved.

**The contract lives where clients look.** `docs/api/README.md` links the
document, explains pairing and the trust rules in three paragraphs, and
shows one worked example per client kind: a hosted browser page, a
same-machine process, and a remote device on the tailnet. The Docs tab
serves it like every other repo doc.

### Out of scope

Changing any route or shape; this idea documents what exists and guards
it. Client SDK generation; a client may generate one from the document,
but none ships from this repo.

### Thread
- [2026-09-10] decision: Dropped. The published `@dendelion/paper-camp` types are the contract for the one second client that exists; the runtime version check moved into [[IDEA-250]].
