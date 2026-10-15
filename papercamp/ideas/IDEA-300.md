---
id: IDEA-300
title: Switch projects without a reload
type: feat
status: planned
created: 2026-10-15
tags:
  - app
  - multi-project
  - performance
  - client
subject: Multi-project
order: 9
---

Even with each project's data cached (IDEA-299), choosing a project in the
header still reloads the page: the bundle is parsed again, the pairing call,
the reachability probe and every boot fetch run again, and the cache has to be
read back from IndexedDB before anything shows. The reload exists because the
current project is fixed once at load: `runtimeConnection` is a module-level
constant read by eight modules, `main.tsx` calls `setApiBase` and
`setApiPairingToken` once, and the runtime slice computes
`hasDetachedRuntime` at import.

**The current runtime can change.** `runtime-connection.ts` keeps the
connection in a small external store: `getRuntimeConnection()` for plain code,
`useRuntimeConnection()` (on `useSyncExternalStore`) for components, and
`switchRuntime(connection)`, which remembers and selects the project in the
registry, calls `setApiBase` and `setApiPairingToken`, and notifies
subscribers. The `runtimeConnection` constant goes, and its eight readers
(`main.tsx`, the runtime slice, hub home, the Night settings section, the
Settings page, `useScope`, `useAppShell`, the project switcher) read through
these. The runtime slice reads `hasDetachedRuntime` from the current
connection when it probes.

**Every boot read is cached per project.** The reads `useAppShell` fires on
mount move onto queries under `['project', runtimeUrl, resource]`, the same
as plans and ideas in IDEA-299: `suggestions`, `night-report`,
`capabilities`, `agent-auth-status`, `parked-questions`, `notifications` and
`chat`. Their store fields and `load*` actions go, their write paths call
matching `refresh*` helpers from `query-client.ts`, and `useAppShell` no
longer loads anything on mount. Because the keys carry the runtime URL, a
switch reads the new project's entries and keeps the old project's for when
the user switches back.

**The rest of the store resets.** Project state still in the store (agent
status, diff, task log, docs, roadmap, capacity, status, and the reconcile
queue) returns to its initial values through one `resetProjectState()` on
the store, and the pages that need it load it on mount as they do today.

**Choosing a project switches in place.** `openRow` in `useHubMachines` calls
one `openProject(row, machineUrl, path)`:
1. A project not yet chosen is adopted with the machine's pairing token,
   exactly as the `?runtime=&token=` link does today.
2. `switchRuntime` makes it current, and `POST /api/pair` runs with its token,
   bounded by the existing 15 s timeout.
3. `resetProjectState()` runs and `checkRuntimeReachable()` probes the new
   runtime.
4. The router navigates to `path` when given, else the project's remembered
   route, else `/`, replacing the history entry.

No `window.location.assign` is left in the switch path. A pasted
`?runtime=&token=` link and a machine link still reload once, since they
arrive from outside the running app.

**Live connections follow the switch.** Activity-stream subscriptions keyed by
`''` resubscribe when the current runtime changes, so the stack panel, desk
checks, notification push and the Git page listen to the new project. Push
notification subscriptions stay per runtime as now.

Done when choosing a project in the header switches it with no page reload,
shows its cached name, Ideas list and boot data at once, the stack panel and
activity follow the new project, and switching back to the previous project
shows its data without a fetch gating the paint.

### Out of scope

Opening two projects side by side. Moving agent status, diff, task log, docs,
roadmap, capacity and status onto queries.

### Phases
- [ ] Make the current runtime switchable
      External store with `getRuntimeConnection`, `useRuntimeConnection` and
      `switchRuntime`; the constant removed and its eight readers moved; the
      runtime slice reads the connection when probing; tests.
- [ ] Move the boot reads onto per-project queries
      Suggestions, night report, capabilities, agent auth status, parked
      questions, notifications and chat as queries with `refresh*` helpers;
      store fields and mount loads removed; tests updated.
- [ ] Reset the remaining project state on switch
      `resetProjectState()` restoring agent status, diff, task log, docs,
      roadmap, capacity, status and reconcile queue to initial values.
- [ ] Switch in place from the header
      `openProject` adopting, switching, pairing, resetting, probing and
      navigating to the given or remembered route; no reload in the path.
- [ ] Resubscribe live streams on switch
      Current-runtime activity-stream subscriptions follow `switchRuntime`;
      stack panel, desk checks, notification push and Git page verified by
      tests.
