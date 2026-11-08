---
id: IDEA-327
title: A lean data flow for the Ideas page
type: feat
status: planned
created: 2026-11-07
updated: 2026-11-07
tags:
  - app
  - server
  - performance
subject: App UI
---

The Ideas page lags on reload, on every live update and when an idea from
another project is opened, and that last case also reshuffles the list.
None of it is rendering cost. The page fetches far more than it shows and
refetches all of it far more often than anything changes.

**What the list fetches today.** A row shows about ten fields, but the only
read is `GET /api/plans` (`src/app/server/routes/reads.ts`), which returns
every entity with its body, phases, thread, log, notes and review. For
paper-camp that is 1.86 MB of JSON (539 KB gzipped) for 325 entries; body
is 40 % of it, phases 29 %, thread 11 %. With seven projects in scope,
`useScopeWorklist` (`src/app/features/plans/hooks/use-scope-worklist.ts`)
pulls every other project's full `/api/plans` and `/api/ideas` too, and
`query-client.ts` persists all of it to IndexedDB, so a reload hydrates a
multi-megabyte cache before the first query runs. `sendJson`
(`src/app/server/http.ts`) sets no `ETag`, so every refetch re-stringifies,
re-gzips, re-downloads and re-parses the whole payload. On a snapshot-cache
hit `readCorpus` (`src/core/corpus.ts`) still stats 327 files and spawns
three `git` processes per request; a cached `/api/plans` took 0.24 to
0.98 s under load.

**What a change triggers.** Every daemon write, and every SSE connect,
sends `changed` (`src/app/server/activity.ts`; the hello on subscribe is a
`changed` too). `subscribeProjectToActivityStream` answers by invalidating
every query under the project prefix with `refetchType: 'all'`: plans,
ideas, suggestions, night report, capabilities, auth, parked questions,
notifications, chat, services, CI, capacity. `refreshProjectState` reloads
status and consistency, the Stack panel reloads runs, task log and
notifications for the other projects, and `useScope`
(`src/app/features/scope/hooks/use-scope.ts`) calls `loadScopeCounts`,
which hits `/api/stats` for all seven projects. That endpoint runs
`computeProjectStats`, the comment-stats script and a walk of `src/`, and
took 1.4 to 4.1 s per call. React Query's default `refetchOnWindowFocus`
adds the same round on every tab focus, seven plans payloads included.

**What polls in the background.** `useHubMachines` is mounted
independently by PlansPage, the sidebar's ProjectsInView, `useAppShell`,
AgentSection and the project switcher. Each instance runs its own
`useHubProjectStates` poll: package name, runtime version and agent status
for every project every 5 s. That is about a hundred requests per 5 s on an
idle page.

**What a cross-project switch does.** `openProject`
(`src/app/services/open-project.ts`) awaits `pairWithToken` before it
navigates, then `resetProjectState()` wipes the agent, batch, diff, task
log, docs, roadmap and status slices so they all reload, re-dials the SSE
(whose hello fires the full invalidation above) and probes reachability.
The rows were already in cache; the wait is this storm on a daemon that is
also computing seven stats.

**Why the order changes.** `useWorklistRows` validates each row's subject
against the current project's vocabulary from `useSubjectVocabulary`, which
fetches `/api/config` of the current project on every mount. In
multi-project view the vocabulary changes with the current project and
arrives after first paint, so the list renders once with every subject and
then demotes every row whose subject is not in the new project's ROADMAP to
"No subject". The groups shuffle.

**The shape after this idea.** No new library. React Query, already in
place, does the caching; the change is what we fetch and what we key.

- `GET /api/worklist` returns row-shaped entries only: id, title, type,
  status, kinds, subject, tags, order, created, updated, parent, needs,
  phase counts (done and total) and the active-run flag. About 50 KB for
  paper-camp instead of 1.86 MB. `GET /api/entities?id=` returns one full
  `EntityEntry`. Both carry an `ETag`; `/api/plans` stays for its other
  consumers until they move.
- The list, in one project or seven, is built from worklist rows. The
  detail view opens from the cached row as `placeholderData` and fills in
  when the entity arrives. Only worklist, ideas and config keys are
  persisted.
- A row's subject is validated against its own project's vocabulary. Each
  scoped project's `/api/config` is one cached query, and
  `groupRowsBySubject` receives a vocabulary per project. A list with
  several projects never demotes a subject because the current project
  lacks it.
- `changed` names what changed. `notifyChanged(area)` on the daemon carries
  `corpus`, `tasks`, `chat`, `services`, `git` or `ci`; the client
  invalidates only the keys of that area. The SSE hello is a `hello`
  message, not a change. `refetchOnWindowFocus` is off, because the stream
  already pushes every change.
- One hub poll. Machine and project state live in React Query with
  `refetchInterval`, so every consumer shares one request per machine per
  5 s: `/api/machine/projects` for the mounted, busy and missing flags, plus
  one agent-status query per project. Sidebar idea counts are a `select`
  over the cached worklist; the `/api/stats` calls go away.
- A project switch is a key change. `openProject` navigates first and pairs
  in the background. `resetProjectState` is removed: the status, git, agent,
  task-log, roadmap and docs loaders become queries keyed by `runtimeUrl`,
  so switching means new keys, not a wipe, and switching back is served
  from cache.

**Acceptance.** A reload of the Ideas page with seven projects in scope
issues the main bundle, one worklist request per project and one config
request per project, and paints the list from the persisted cache before
any of them returns. A daemon write to one idea produces one `changed`
with area `corpus`, one worklist refetch per project (304 for the
unchanged ones) and no `/api/stats` call. Opening an idea from another
project paints its row's title and status immediately, and the list's
grouping and order do not change on the way. An idle page with seven
projects in scope issues at most eight requests per 5 s.

### Phases
- [ ] Worklist and entity reads with ETags on the daemon
      Add `WorklistEntry` to `src/types/index.ts` and `toWorklistEntry` in `src/core/readers.ts`; serve `GET /api/worklist` and `GET /api/entities?id=` from `src/app/server/routes/reads.ts` (404 for an unknown id). In `sendJson` hash the body, send `ETag`, answer 304 when `If-None-Match` matches. Reuse a `corpusFingerprint` result for one second per root so a burst of requests spawns git once. Route and core tests, including the 304 path.
- [ ] The list and the detail view read the worklist
      Add `worklistQueryKey`, `entityQueryKey`, `useWorklist` and `useEntity` next to `use-plans.ts`; `selectWorklistRows` and `sortWorklistRows` take `WorklistEntry` rows; `useScopeWorklist` fetches `/api/worklist` and `/api/ideas` per other project; PlansPage and ListView render from rows; `EntityDetail` and `NoteDetail` read `useEntity(id)` with `placeholderData` from the matching row and derive their other-plans links from the worklist. `persistOptions` keeps only `worklist`, `ideas` and `config` keys, and the cache buster is bumped so stale `plans` entries drop.
- [ ] Subjects validated per project
      Replace `useSubjectVocabulary`'s local fetch with a `configQueryKey(runtimeUrl)` query; `useWorklistRows` builds a `Map<runtimeUrl, Set<subject>>` from the config of every scoped project and `groupRowsBySubject` checks each row against its own project's set. Rows of a project whose config has not arrived keep their subject. Selector tests for the mixed-project case.
- [ ] Change messages that name their area
      `notifyChanged(area)` in `src/app/server/activity.ts` with `corpus`, `tasks`, `chat`, `services`, `git` and `ci`, debounced per area; every caller names its area; the subscribe hello becomes `{ message: 'hello' }`. In `query-client.ts`, `subscribeProjectToActivityStream` maps an area to its keys and `refreshProjectState` runs only for `git` and `services`; `refetchOnWindowFocus: false` in the defaults; `useScope` stops reloading counts on `changed`. Tests on both sides.
- [ ] One hub poll and counts from the cache
      Move `useHubProjectStates` and `useHubMachineReports` onto `useQuery`/`useQueries` with `refetchInterval: 5_000`: one `/api/machine/projects` query per machine and one agent-status query per project, shared by every `useHubMachines` consumer. `loadScopeCounts` for ideas becomes a `select` over the cached worklist queries; chat and activity counts become queries on the same keys the pages use. Delete the `/api/stats` path from `scope-counts.ts`.
- [ ] Project switch as a key change
      `openProject` navigates as soon as the runtime is switched and runs `pairWithToken` and `checkRuntimeReachable` after; remove `resetProjectState` and the slices it reset by moving status, consistency, git, agent status, task log, roadmap and docs loads onto queries keyed by `runtimeUrl`, with the Stack panel and settings reading them. A switch to a project already seen renders from cache with no loading state.
