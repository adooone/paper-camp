---
id: IDEA-298
title: Stream other projects' rows as they load
type: feat
status: planned
created: 2026-10-15
tags:
  - app
  - multi-project
  - performance
subject: Multi-project
order: 7
---

When the Ideas list shows more than one project, the current project's rows
appear at once but every other project's rows appear together, late, with
nothing on screen saying they are on the way. `useScopeWorklist` fetches
`/api/plans` and `/api/ideas` for each other project and waits on one
`Promise.all`, so the slowest project holds back all the rest. The results live
in the hook's own `useState`, so leaving the Ideas list and coming back fetches
everything again. The payloads are also large and never compressed:
paper-camp's `/api/plans` is 1.68 MB of JSON (bodies, phases, threads), 480 KB
gzipped, and `sendJson` in `src/app/server/http.ts` sends it raw.

**Compressed JSON.** `sendJson` gzips the body with `zlib.gzip` when the
request's `Accept-Encoding` (read from `res.req`) includes `gzip` and the
serialized body is over 1 KB, setting `Content-Encoding: gzip` and `Vary: Accept-Encoding`. Smaller
bodies and clients that don't accept gzip get the raw body as now. Every JSON
route goes through `sendJson`, so the daemon, `paper-camp dev` and the
mounted runtime all benefit.

**Each project lands on its own.** `useScopeWorklist` stores each project's
result the moment its own `fetchPlansAt` and `fetchIdeasAt` pair resolves,
instead of waiting for every project. A project that fails to answer drops out
of the pending set with no rows, as now.

**Rows survive leaving the page.** Fetched results go into a module-level map
in `use-scope-worklist.ts`, keyed by `runtimeUrl`. On mount the hook renders
whatever the map holds for each project straight away and refetches in the
background, replacing the entry when the fresh result arrives. The map lives
for the page's lifetime; it is replaced by the shared query cache in IDEA-299.

**A cue while projects are loading.** The hook also returns the projects still
fetching. While any are, a muted line sits above the list, *Loading radio,
paper-ui…*, naming them in scope-list order, inside an `<output>` so screen
readers announce it. A project with a cached entry that is refetching in the
background does not count as loading. In the scope sidebar, a loading
project's count slot reads *…* until its rows arrive.

Done when the plans response is gzipped for a browser, each other project's
rows appear as soon as that project answers, a muted line names the projects
still loading, and returning to the Ideas list shows the other projects' rows
at once.

### Out of scope

A slimmer list-only plans payload: search matches on bodies, so the list needs
them. The Activity and Chat counts in the scope sidebar.

### Phases
- [x] Gzip JSON responses
      `sendJson` gzips bodies over 1 KB when `Accept-Encoding` allows it,
      with `Content-Encoding` and `Vary` headers; server test for both paths.
      run: 1m15s · 26 in · 3.6k out · sonnet-5 · sess:71f7329b-b7b7-45fd-9645-e63f2d005841
- [x] Land each other project's rows as it answers
      Per-project results set as each resolves, held in a module-level map
      keyed by runtimeUrl and shown on remount while refetching; hook tests.
      run: 3m11s · 66 in · 13.4k out · sonnet-5 · sess:71f7329b-b7b7-45fd-9645-e63f2d005841
- [ ] Show which projects are still loading
      The hook returns the pending projects; a muted *Loading …* line above
      the list in an `<output>`, and *…* in the scope sidebar's count slot.

### Thread
- [x] 2026-10-15 [log] [agent] Run order: Delivers a standalone gzip+streaming win and lays the per-project module-level cache that IDEA-299 explicitly says it will replace, so it must land first to give IDEA-299 something to supersede.
