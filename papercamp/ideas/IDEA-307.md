---
id: IDEA-307
title: One corpus service
type: refactor
status: planned
created: 2026-10-19
tags:
  - core
  - server
  - mcp
  - api
subject: Code health
---

The same two things are written out again and again. Reading the corpus with
derived status (`readWorkEntries`, `readEntitiesWithDerivedStatus`,
`findArchivableIdeas`) happens at 35 call sites; each one re-parses every idea
file, calls `resolvePrsByEntity`, and spawns `git log --name-only` over the
whole main history (`resolveIdsWithMainActivity`, uncached). One `changed`
tick makes the stack panel fire about ten requests, and `/api/plans`,
`/api/archivable-ideas`, `/api/parked-questions`, `/api/notifications`,
`/api/doctor`, `/api/stats` and `/api/ideas` each parse the corpus on their
own; `corpus-cache.ts` covers three of them. `resolveNeedsRefs` builds a fresh
per-project map on every call, so `computeNeedsBlockedIds` reads other
projects' corpora once per entity.

Changing an entity is hand-rolled twelve times as the same sequence:
`readEntities` → find by id → primary-or-archive path → `readMaybe` →
`parseEntityFile` → `entries[0]` → mutate → `writeEntityFile`. It appears in
`mcp/tools.ts` (five tools), `agent-hooks.ts` (three hooks), `agent.ts`
(`escalateToLog`), `routes/agent.ts` (feedback routes, promote-issue),
`routes/content/plans.ts` (PATCH) and `routes/content/ideas.ts` (archive,
roadmap rename). Minting an idea (`assignEntityId` + `formatEntityFile` +
`writeFile`) is written out five more times while `createIdeaEntity` already
exists in `helpers.ts`. The MCP server is a second copy of the write path in a
separate process: its writes never reach `notifyChanged`, so no run-order pass
and no `changed` tick, and `docs/MCP.md` still promises a branch guard the
code dropped.

**`src/core/corpus.ts` owns reading.** `readCorpus(root, { live = false })`
returns one snapshot: `entries` (with derived status), `work` (plan-shaped,
with `resolvedNeeds` attached), `notes`, `warnings`, `prs`, `resolved`,
`mainActivityIds` and `fingerprint`. It is cached per root in a module map
keyed on `corpusFingerprint(ideasDir)` plus the PR map's `fetchedAt`;
`live: true` passes the PR lookup's live TTL, `false` passes infinity, as the
run-order pass does today. `resolveIdsWithMainActivity` is cached by the
default branch's current sha (`git rev-parse <main>`). `resolveNeedsRefs`
takes the snapshot's per-project entry maps, built once per call. The
`corpus-cache.ts` module folds into this file as `invalidateCorpus(root)`.
`readers.ts` keeps `readEntities` (the raw parse) and loses the three derived
readers; every server, MCP and CLI call site reads through `readCorpus`, and
the read routes serve parked questions, notifications, doctor, stats, ideas,
archivable ideas, consistency and roadmap from the same snapshot.

**`src/core/corpus.ts` owns writing.** `updateEntity(root, id, mutate)`
resolves the primary or archived file, parses it, applies the closed-entity
guard (a `CorpusError` with `status: 409` for a done or dropped entity unless
the change only moves between closed statuses), calls `mutate(entry)` for the
overrides, stamps `updated`, writes through `assertCorpusWritable`, and
archives on `dropped` or unarchives on a cleared status, as the PATCH route
does today. `appendThread(root, id, message)` and `createIdea(root, input)`
(moved from `helpers.ts`, with `kind`, `type`, `subject`, `needs`, `idea` and
`issueSource`) sit beside it. The twelve read-modify-write sequences and the
five mint sequences are replaced by calls to these three functions;
`helpers.ts` keeps the chat and run-order locks.

**Entity routes keyed by id.** `routes/content/entities.ts` serves
`POST /api/entities` (create), `PATCH /api/entities?id=` (title, body, tags,
type, needs, phases, fixes, status, agent, subject, order, thread),
`POST /api/entities/thread?id=` (`{ kind, text }`),
`POST /api/entities/thread/promote?id=` (`{ index, target, note }`) and
`POST /api/entities/archive?id=`. `PATCH /api/plans?title=` and
`DELETE /api/plans?title=` are retired and `plans-api.ts` on the client moves
to the new routes; the in-progress reflow and run-order normalisation move
with the PATCH. `POST /api/ideas` stays as the create route the client already
uses and calls `createIdea`.

**The MCP server is a client of the daemon.** `src/mcp/tools.ts` becomes a
thin HTTP client: each tool maps to one call against
`http://localhost:<port>/p/<slug>/api/...`, resolved by `resolveDaemonTarget`
(moved from `src/vite/daemon-target.ts` to `src/core/daemon-target.ts`).
`list_plans` and `get_plan` read `/api/plans`; the write tools call the entity
routes, `/api/suggestions/promote` and `/api/roadmap/promote`. Loopback
requests with no Origin pass the host check, so no token is needed. When no
daemon is running or the project is not registered, every tool fails with
"run `paper-camp start` and register this repo with `paper-camp init`".
`mcp/server.ts` no longer creates a git manager, `guardedWrite` goes, and
`docs/MCP.md` describes the daemon dependency instead of a branch guard.
MCP writes now produce the same run-order pass and `changed` tick as any
dashboard write.

Done when `grep -rn "readWorkEntries\|readEntitiesWithDerivedStatus\|
findArchivableIdeas" src` matches only `corpus.ts` and its test, a `changed`
tick produces one corpus parse in the server log, `update_phase` from an MCP
client updates an open idea view without a reload, and `mcp/tools.test.ts`
runs against a real `http.Server` built from `createApiMiddleware`.

### Phases
- [ ] `readCorpus` snapshot with a per-root cache
      One cached snapshot keyed on fingerprint and PR `fetchedAt`; main
      activity cached by branch sha; needs resolved from the snapshot;
      `corpus-cache.ts` folded in; all call sites moved; tests.
- [ ] `updateEntity`, `appendThread` and `createIdea`
      The three write primitives with the closed-entity guard and archive
      handling; hooks, agent.ts and routes call them; tests.
- [ ] Id-keyed entity routes
      `routes/content/entities.ts` replaces the title-keyed plans routes;
      `plans-api.ts` and its callers move; route tests.
- [ ] MCP tools as daemon HTTP clients
      `resolveDaemonTarget` in core; every tool maps to one route; the
      no-daemon error; `docs/MCP.md`; tools test against a real server.
