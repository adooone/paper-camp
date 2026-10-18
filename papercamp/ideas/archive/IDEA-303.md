---
id: IDEA-303
title: Services as one line each
type: feat
status: done
created: 2026-10-18
updated: 2026-10-18
tags:
  - app
  - server
  - ui
subject: Run & monitor
order: 10
---

The Services group in the Stack panel is a stack of collapsible cards: a
chevron, a status dot, the name and port, a play button, and a band of empty
space under each. Expanding one mounts a log pane inside the panel, which
makes the Stack taller than the viewport, and nothing else in the panel is a
collapsible card. The row hides its stop button for a server the panel did
not start (`pid: null`, found through the healthcheck probe) without saying
why. A running service with no healthcheck stays amber for good, a healthcheck
that answers `down` wears the same amber as a service still starting, and
`exitCode`, `startedAt` and `cmd` travel in `ServiceState` but are never
shown. The log buffer is wiped on start, so the output of a crash is gone the
moment Start is pressed. There is no restart. `useServicesClient` is a
`useState` fetcher that refetches on every `changed` stream event, and each
refetch probes every stopped service's healthcheck over HTTP, so every write
to `papercamp/` pokes the dev server. This idea makes the group one line per
service and moves the details and the log to Activity.

**One card, one line per service.** `ServicesGroup` renders a single
`Card surface="chalkboard" size="small"` under the *Services* label, like
*CI & release* does, with one row per service and nothing collapsible. A row
is: the status dot, the name in `text-desk-chalk`, the port as a mono muted
link (`:3333`, opening `http://localhost:3333` in a new tab, with
`stopPropagation`), the status word in mono muted text, and the actions at the
trailing edge as `IconButton surface="chalkboard" size="small"
variant="ghost"`. The whole row is a hit target that navigates to
`/activity/services/$name`; the buttons and the port link stop propagation,
as `AgentTaskCard`'s stop button does. The per-service `Card`, the
`Disclosure`, `ServiceLog` and the empty band go. With no services declared
the card holds the existing `EmptyState`.

**The status table.** `serviceStatus(service)` in
`src/core/service-status.ts` returns `{ word, tone }` and both the Stack row
and the Activity page read it:

| State | Dot | Word |
|---|---|---|
| `stopped` | `bg-desk-text-muted` | stopped |
| `running`, healthcheck declared, health `unknown` | `bg-chalk-running-text` | starting |
| `running`, health `up` or no healthcheck | `bg-chalk-pass-text` | running |
| `running`, health `down` | `bg-chalk-fail-text` | unhealthy |
| `stopping` | `bg-chalk-running-text` | stopping |
| `crashed` | `bg-chalk-fail-text` | crashed · exit N |
| `running`, `pid` null | `bg-chalk-pass-text` | external |

The dot's `aria-label` and `title` are the word. `dotClass` and its test file
are replaced by this table and its tests.

**Three actions.** Start (`RunIcon`) shows when the service is `stopped` or
`crashed`. Stop (`StopIcon`) and Restart (`RefreshIcon`) show when it is
`running` and owned. Nothing shows while `stopping`, and nothing for an
external service. Restart is `POST /api/services/restart?name=` in
`routes/services.ts`: the manager's `restart(name)` stops the process, awaits
its exit, then calls `start`, so the client never sequences two calls. A
failed action keeps today's error toast.

**The log keeps its history.** `start` no longer clears the buffer; it
appends `── started HH:MM ──` and keeps the 500-line ring, so a crash and the
boot after it read together. `GET /api/services/logs` answers
`{ name, lines: string[] }`, and `fetchServiceLog` returns the array.
`desk-services.ts` gets a unit test around a fake pty: start, crash, stop,
restart, the marker, the ring limit.

**Services are a query.** `useServicesClient` is rewritten on
`useQuery(['services'])` keyed per runtime, as the IDEA-299 queries are, with
`start`, `stop` and `restart` as mutations that invalidate it. The stream
subscription invalidates on `type === 'service'` only; the `changed` trigger
goes, which ends the write-triggered healthcheck probes. The unused `loading`
field goes with it.

**The service page.** `ServicePage` in `features/activity/service-page.tsx`
at `/activity/services/$name` (`staticData.layer: 'runtime'`), inside the
`ActivityEntryPage` frame (`pageClass`). A top row lists every declared
service's name as a `Button variant="ghost" size="small"`, the open one
`isActive`, so switching services never goes back through the Stack. Under it
the header: the name as the `h1`, the port link, a `Stamp` with the status
word in the table's tone, the same Start, Stop and Restart buttons, and a
`FactsGrid layout="inline"` of *Command*, *PID*, *Started*
(`formatFullTimestamp`), *Health* and *Last exit*, each fact present only when
it has a value. The page sets the header title through
`setActiveLogEntryTitle`. Below sits `LogOutputPane`, `live` while the status
is `running` or `stopping`, fed by `useLiveLines(fetcher, live)`: the body of
`useTaskOutput` with the fetcher as a parameter, which `useTaskOutput` then
calls with `fetchTaskLogLines`. An unknown name renders the entry page's
*doesn't exist* empty state with its *Back to Activity* button. Services add
no rows to the Activity list, its filters or its stats.

Done when the Services group is one card of one-line rows with no collapsible
content, a service shows the word from the table and only the actions its
state allows, a port opens the service in a new tab, a row opens
`/activity/services/$name` with the facts and a live log that survives a
restart, Restart is one call, and the list refetches only on service events.

### Out of scope

Service rows in the Activity list. A `service-stopped` row in Activity; the
push notification stays as it is. Editing the manifest, which stays in
Settings and the discovery proposal. Streaming log lines over the SSE stream
instead of the 1.5 s poll.

### Phases
- [x] Restart, the lines log and the kept buffer
      `restart` on the manager and its route; `start` appending the marker
      instead of clearing; the logs route answering `lines`; a
      `desk-services.test.ts` around a fake pty covering start, crash, stop,
      restart, the marker and the ring limit; route tests.
      run: 3m50s · 38 in · 17.1k out · fable-5 · sess:47aa41ba-dc47-4a50-b7ae-577211107bd2
- [x] The status table and the services query
      `serviceStatus` in `src/core/service-status.ts` with its tests replacing
      `dotClass`; `useServicesClient` on `useQuery` with start, stop and
      restart mutations and the stream invalidation on service events only;
      `fetchServiceLog` returning lines; tests.
      run: 3m34s · 40 in · 13.4k out · fable-5 · sess:47aa41ba-dc47-4a50-b7ae-577211107bd2
- [x] One card of one-line rows
      `ServicesGroup` as one chalkboard card with a row per service: dot, name,
      port link, status word, the actions the state allows, the row
      navigating to the service page; the per-service card, `Disclosure` and
      `ServiceLog` deleted; tests for which actions each state shows.
      run: 2m47s · 30 in · 9.1k out · fable-5 · sess:47aa41ba-dc47-4a50-b7ae-577211107bd2
- [x] The service page
      `useLiveLines` extracted from `useTaskOutput`; `ServicePage` with the
      service switcher, the header with stamp, actions and facts, and
      `LogOutputPane` live while running; the route registered; the unknown
      name state; tests.
      run: 4m25s · 46 in · 17.2k out · fable-5 · sess:47aa41ba-dc47-4a50-b7ae-577211107bd2
- [x] [manual] Let chat page fill available height while streaming
