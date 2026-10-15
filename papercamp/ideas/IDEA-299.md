---
id: IDEA-299
title: Keep each project's data across switches
type: feat
status: planned
created: 2026-10-15
tags:
  - app
  - multi-project
  - performance
  - client
subject: Multi-project
order: 8
---

Choosing a project in the header reloads the page (`openRow` calls
`window.location.assign`), and everything the app had fetched lives in the
in-memory Zustand store, so every switch starts from nothing: the header reads
*Loading…*, the Ideas list shows its skeleton, and the plans and ideas the
browser fetched seconds ago, for this project or as another project's rows in
the scope list, are fetched again. The app has no query cache, so there is
nothing to show while that happens.

**TanStack Query, saved to IndexedDB.** The app adds `@tanstack/react-query`,
`@tanstack/react-query-persist-client`,
`@tanstack/query-async-storage-persister` and `idb-keyval`. A
`src/app/services/query-client.ts` module owns the one `QueryClient`
(`staleTime` 30 s, `gcTime` 7 days) and an async persister writing to
IndexedDB through `idb-keyval`, throttled to one write per second.
`main.tsx` wraps the router in `PersistQueryClientProvider` with `maxAge`
7 days and `buster` set to the app version, so a new release starts with an
empty cache instead of reading shapes it no longer understands. Only queries
under the `project` key prefix are persisted.

**One key per project and resource.** Project reads are keyed
`['project', runtimeUrl, resource]`, where `runtimeUrl` is the project's own
runtime URL (`''` for the page's own runtime). The resources moved in this
idea are `plans`, `ideas` and `package-name`. The fetchers take the runtime
URL explicitly (`fetchPlansAt`, `fetchIdeasAt`, `fetchPackageNameAt`), and
send the pairing token through `apiFetch` when the URL is the current
runtime's.

**The current project reads from the cache.** `plans`, `plansLoading`,
`plansError`, `loadPlans`, `ideaEntries` and `loadIdeas` leave the store, and
the plans and ideas slices keep only filters, detail view and archivable
ideas. Components read through `usePlans()` and `useIdeas()` in
`src/app/hooks/`, which wrap `useQuery` for the current runtime. The 46 places
that call `loadPlans` or `loadIdeas` after a write call `refreshPlans()` and
`refreshIdeas()` from `query-client.ts` instead, which invalidate the current
runtime's keys, including the stack panel's activity-stream listener.
`useAppShell` stops calling `loadPlans` and `loadIdeas` on mount. The Ideas
list shows its skeleton only when the query has no data at all, not while a
cached result refetches.

**Other projects share the same cache.** `useScopeWorklist` becomes
`useQueries` over the same `plans` and `ideas` keys for each other project,
replacing IDEA-298's module-level map, and keeps returning the projects still
loading (no data yet). A project seen as another project's rows is already
cached when the header switches to it, and the reverse.

**The header name comes from the cache.** `useProjectIdentity` reads
`package-name` through the same key, so after a switch the header shows the
project's name from the last visit instead of *Loading…*.

Done when switching to a project opened before shows its name, its Ideas list
and the other projects' rows from the cache on the first paint after the
reload, then updates them in place when the fresh responses land, and a write
on the current project still refreshes the list.

### Out of scope

Switching projects without a reload (IDEA-300). Moving suggestions, the night
report, notifications, chat, capabilities, agent status and git status out of
the store.

### Phases
- [ ] Add the persisted query client
      Dependencies, `query-client.ts` with the IndexedDB persister, the
      `project` key prefix filter and version buster, and
      `PersistQueryClientProvider` in `main.tsx`.
- [ ] Move plans and ideas onto queries
      `usePlans`/`useIdeas` keyed by runtime URL, the store fields removed,
      every `loadPlans`/`loadIdeas` caller switched to `refreshPlans`/
      `refreshIdeas`, skeleton only without data; tests updated.
- [ ] Share the cache with other projects' rows
      `useScopeWorklist` on `useQueries` with the same keys, still returning
      the loading projects; the IDEA-298 map removed.
- [ ] Read the header name from the cache
      `useProjectIdentity` on the `package-name` query.
