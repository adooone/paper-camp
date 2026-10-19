---
id: IDEA-311
title: Interrupted notices that clear
type: fix
status: planned
created: 2026-10-19
tags:
  - app
  - stack-panel
  - activity
subject: Run & monitor
---

The Stack panel shows "A run was interrupted; run again" for IDEA-301 and
nothing removes it. `interruptedNotices` in `run-rows.ts` picks the newest
`tasks.log` entry per plan and keeps every one whose outcome is `interrupted`;
the only exit is a newer run on the same plan. IDEA-301 is archived as done
with its last run-all interrupted by a server stop on 2026-10-17, so it can
never be run again and the card is permanent. The card has no dismiss, and
marking the matching `run-interrupted` notification read in the Inbox changes
nothing here, although the notification's id is the task id.

**Closed entities have no notice.** `interruptedNotices(taskLog, closedIds)`
drops entries whose plan's derived status is `done` or `dropped`. The section
builds `closedIds` from the plans query for the current project and from each
foreign project's plans query (already fetched for the scope list).

**Read notifications hide the card.** The card gets a close button labelled
"Dismiss" that calls `markRead(entry.id)`; `interruptedNotices` also drops
entries whose notification with that id is read. `useScopeRuns` fetches each
foreign project's notifications alongside its task log
(`fetchNotificationsAt`) so a foreign notice follows the same rule; the
dismiss on a foreign card marks it read on that runtime.

Done when IDEA-301's card is gone with no action, an interrupted run on an open
idea shows the card until it is dismissed or the idea runs again, and the
dismiss marks the Inbox item read.

### Phases
- [x] Filter closed and read entries
      `interruptedNotices(taskLog, { closedIds, readIds })`; the section
      derives both sets from the plans and notifications queries;
      `run-rows.test.ts` covers closed, read and open cases.
      run: 3m29s · 88 in · 12.9k out · sonnet-5 · sess:a324914f-b21e-4636-bf73-ee3cc0e0833d
- [ ] Dismiss on the card
      Close button calling `markRead`; foreign notifications in
      `useScopeRuns`; `agent-section.test.ts` updated.
