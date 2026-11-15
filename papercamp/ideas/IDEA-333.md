---
id: IDEA-333
title: Stats off the request path again
type: fix
status: planned
created: 2026-11-15
updated: 2026-11-15
tags:
  - server
  - app
  - performance
subject: Infrastructure
---

IDEA-324's last phase undid part of IDEA-328. Commit aae55073 deleted
`src/app/server/project-stats.ts`, the store that recomputed `/api/stats`
off the request path on a 2 s debounce after corpus changes, and put the
stats behind `read-cache.ts`: a five-minute entry dropped by every
`notifyChanged`. During a run the `tasks` area ticks every few seconds, so
the cache is empty almost every time a client asks and the first
`/api/stats` after any tick pays the full 1.3–2.9 s again, on the request.
Doctor behind the same cache is fine, it has no cheap precomputation.

The same idea's second phase made `services` ticks skip the
`capabilities` query (`src/app/services/query-client.ts`). The daemon only
fires `notifyChanged('services')` when a probe result actually changed
(`routes/capabilities.ts`, the `onChange` of `cachedProbe`), so the tick
is already the change signal; ignoring it means a detected change (`gh`
installed, Claude signed in) does not reach the UI until the 60 s probe
cache and a remount line up.

**Stats are computed when the corpus changes, not when asked.**
`project-stats.ts` returns as it was (restore it from aae55073's parent):
`createProjectStatsStore(root)` recomputes on `corpus` change with the
2 s debounce and `/api/stats` serves the last value, computing inline only
on the very first request. `read-cache.ts` stays for doctor only.

**A services tick refetches capabilities.** The `services` area
invalidates the `capabilities` and `connections` queries with
`refetchType: 'active'`, like every other area; the probe cache behind
the route makes the refetch cheap. The stale "Bypasses the queue" comment
on the gate's formatter in `desk-checks.ts` goes, the formatter queues.

**Acceptance.** While a run is active, `/api/stats` answers under 50 ms
on every request after the first. Installing `gh` and waiting for the
next probe refresh updates the Services card without a reload.

### Phases
- [x] Stats precomputed again
      Restore `src/app/server/project-stats.ts` and its test from aae55073's parent, wire the store in `api.ts`, make `/api/stats` read it and remove stats from `read-cache.ts`; test that a `corpus` change recomputes once after the debounce and the route returns without computing.
      run: 2m1s · 28 in · 9.3k out · opus-5-5 · sess:a9e69b39-88b1-4004-9c74-ab80da57fa2a
- [ ] Services tick refetches capabilities
      `query-client.ts`: the `services` area invalidates `capabilities` and `connections` (active refetch); update `query-client.test.ts`; delete the stale comment above the formatter in `desk-checks.ts`.
