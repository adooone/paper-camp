---
id: IDEA-237
title: One log view for every run
type: feat
status: idea
created: 2026-09-05
tags:
  - app
  - ui
subject: Run & monitor
order: 2
---

The same run is read on two pages that disagree about everything. **Tasks**
(`/tasks`, reached only from the Stack panel's *more* link and a task card)
lists every entry of `tasks.log` newest first, grouped by day, with a
kind/plan/agent/time/outcome grid and the run's output on expand. **Issues**
(`/issues`, in the nav) lists the failures — failed runs, red checks, PR
change requests, sync failures — oldest first, as Inbox-shaped rows with a
thread, *Fix it here*, and *Promote*. A failed run appears on both, in
different order, with different actions, and a successful run appears on one
of them with no summary of what it did: the expanded card shows raw output
lines and the stamp says `done`.

Neither page filters, sorts, searches, or counts anything. Twenty-five
entries in this repo's log are already a scroll; a daemon serving a machine
of projects ([[IDEA-224]]) makes each project's log the place to answer
"what ran, what broke, what did it cost", and that page does not exist.

One page replaces both: a log viewer in the shape of Datadog's, for Paper
Camp's runs.

**Log takes the nav slot.** `Log` at `/log` replaces `Issues` in
`nav.tsx`. `/tasks` and `/issues` redirect to it, `/tasks?taskId=` becomes
`/log?entry=`, and the Stack panel's *more* link and task cards point at the
new route. `features/issues` and `features/tasks` are deleted and
`features/log` is the one feature; `core/issues.ts` and its collectors stay
exactly as they are, since the derived open/closed state from [[IDEA-192]]
is what decorates a failed row.

**One stream, newest first.** Every `tasks.log` entry is a row, whatever its
outcome, plus the failures that have no run behind them — a red check, a PR
requesting changes, a sync conflict — each with its source as the row's
type. Tasks in flight from `agentStatus` sit at the top with a live stamp,
so the page is also where a running agent is watched once it leaves the
Stack panel. Newest first throughout; the day grouping goes.

**A compact row per entry.** One line: time, a type stamp (the task kind or
issue source), the entity stamp and title, the agent, duration, and an
outcome stamp — `done`, `error`, `superseded`, `running`, or for a failure
still open, `open`. Rows are dense enough to scan a hundred at a glance;
the page loads a hundred and offers *Load more*.

**A row opens into what happened.** In place, as today. A successful run
shows its summary first — the agent's final message from the output, the
thing it said it did — then usage (duration, turns, cost, model) and the
full output lines below. A failed run shows the reason, the last output
lines, the thread of earlier attempts on the same failure, and the actions
Issues already has: *Fix it here* launches the issue-fix agent with the
row's title, reason, and output; *Promote* keeps its three-way label from
[[IDEA-192]]; *Open* goes to the entity. A row whose failure has since
cleared reads `fixed` and keeps its thread. Nothing here is new behaviour —
the same store actions move to the new feature.

**Filters, search, sort.** A filter bar above the list: outcome (done,
error, superseded, open), type (multi-select over task kinds and issue
sources), agent, and a range (today, 7 days, 30 days, all). A search box
matches title, entity id, and reason. Sort by time (default), duration, or
cost. Filters live in the URL search params so a filtered view can be
shared and survives reload.

**Quick stats respect the filters.** A strip above the list: runs, failed,
success rate, total cost, and median duration — computed from the rows
currently matched, so narrowing to one kind or one week narrows the numbers
with it. The Stats page stays what it is, a project-health view; this strip
is the log's own totals.

### Out of scope

`notifications.log` and the Inbox — that is activity you read, and it stays
at the bell as [[IDEA-192]] settled. Any change to what `tasks.log` records
or how long it is kept. Cross-project aggregation in the hub; this is one
project's log.
