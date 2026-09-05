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
order: 5
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

**Notifications are rows too.** The Inbox at the bell is the third copy of
this page: `notifications.log` entries (`completed`, `reply`) and parked
questions, each already tied to an entity and a run. They join the stream —
a completed run is the same row as its `tasks.log` entry, decorated with the
unread state; a reply and a parked question are rows of their own type, the
question opening into the answer box the Inbox has today. Opening a row
marks it read through the existing `/api/notifications/mark-read`. The bell
in the status bar keeps its unread count and opens `/log?unread=1`; `/inbox`
redirects there and `features/inbox` is deleted. Browser push in
`use-notification-push.ts` is unchanged — it announces, the Log is where you
read.

**Quick stats respect the filters.** A strip above the list: runs, failed,
success rate, total cost, and median duration — computed from the rows
currently matched, so narrowing to one kind or one week narrows the numbers
with it. The Stats page stays what it is, a project-health view; this strip
is the log's own totals.

### Out of scope

Any change to what `tasks.log` or `notifications.log` records or how long
either is kept. Browser push notifications. Cross-project aggregation in the
hub; this is one project's log. [[IDEA-192]]'s read/act split is retired by
this idea, not preserved: one page holds both.

### Phases
- [ ] Derive one log stream from runs, failures, and live tasks
      One selector merges `tasks.log` entries, the issue collectors' failures, and `agentStatus` into typed rows, newest first.
- [ ] Build the `features/log` page with compact rows and *Load more*
- [ ] Move the expanded detail and its actions into the row
      Summary and usage for a successful run; reason, thread, *Fix it here*, *Promote*, and *Open* for a failed one.
- [ ] Add the filter bar, search, and sort backed by URL search params
- [ ] Add the quick-stats strip computed from the matched rows
- [ ] Take the nav slot, redirect `/tasks` and `/issues`, repoint the Stack panel
- [ ] Fold the Inbox into the Log
      Notifications and parked questions become rows with unread state, the bell opens `/log?unread=1`, `/inbox` redirects, and `features/inbox` is deleted.
- [ ] Delete `features/tasks` and `features/issues`, then run the quality checks
