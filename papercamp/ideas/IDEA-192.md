---
id: IDEA-192
title: An Issues page you can act on
type: feat
status: idea
created: 2026-08-19
updated: 2026-08-19
tags:
  - app
  - agent
  - git
  - ux
subject: Run & monitor
---

Everything that failed collects in one place, reads as a short conversation,
and is fixed from there.

### Failures have nowhere to live

A failure today is visible only where it happened, and only if you were
watching:

- **A failed agent run** ends as `outcome: error` in `tasks.log`. The Stack
  panel shows the card while it is recent; after that the only trace is the
  task log page.
- **A red project check** shows as a chip in the Desk section. The chip says
  which check went red, never why.
- **A PR review requesting changes** lands in the idea's own thread, so it is
  found only by opening that idea.
- **A git rebase or sync failure** raises `RebaseConflictError` with its
  conflicted files, or returns `stage: 'conflicted'`, and surfaces as a toast
  that is gone the moment it is dismissed.

Four kinds of failure, four unrelated surfaces, none of which survives being
looked away from. There is no answer to "what is broken right now".

### Issues takes the nav slot Tasks holds

`Tasks` leaves the navigation and `Issues` takes its place. The task log is not
lost — it is reached from the Stack panel's Agent section, which is where a
running agent is already watched, and its "N more…" link already goes there.
Navigation is for what needs attention, and a log of successful runs does not.

The four sources above feed it. Parked questions do not: they already have the
Inbox and are a question rather than a failure.

### It reads like the Inbox, because that shape works

The Inbox's expandable rows are the model — a compact row per item, oldest
first, opening in place rather than navigating away. An issue opens into a
short message thread: what failed, the reason, the last output lines, and the
replies as it is worked.

The Inbox stays exactly as it is, at the bell. The two surfaces divide by verb:
the Inbox is activity you **read** — a run finished, an agent replied, a
question is waiting. Issues is failure you **act on**. Nothing appears in both.

### Two ways out of an issue

**Fix it here.** An issue carries enough context to launch a fix agent against
it directly, the way a red check already can. The thread records the attempt and
its result, so a second failure of the same thing reads as a continuation rather
than a fresh mystery.

**Promote it to a fix entity.** A failure worth planning becomes a fix entity as
defined by [[IDEA-187]] — its own id, file, branch and PR, linked to the idea it
fixes. The issue then points at that entity and stops carrying the work itself.

An issue closes when the thing it describes stops failing: the check goes green,
the rerun succeeds, the promoted fix ships. Closure is derived from the world,
never a button that marks it read.

### Depends on IDEA-187

[[IDEA-187]] ships first. Promotion creates a real fix entity from the start
rather than raising an ordinary idea and migrating later, so the model is right
on the first pass.

### Out of scope

Any change to the Inbox. The task log page itself, which keeps its route and its
current shape. Notifications for issues — the page is pulled, not pushed.

### Phases
- [x] Define the issue model and its four collectors
      One issue shape fed by failed agent runs, red checks, PR change-requests, and rebase/sync failures — deduped by source so a repeat failure continues an existing issue.
      run: 7m10s · 11.1k in · 27.2k out · sonnet-5
- [ ] Derive open/closed state from the world
      Close an issue when its check goes green, its rerun succeeds, or its promoted fix ships; never a mark-read button.
- [ ] Swap the nav slot: Issues in, Tasks out
      Move the task log behind the Stack panel's Agent section and its "N more…" link; keep the log route and shape unchanged.
- [ ] Build the Issues page as expandable Inbox-shaped rows
      Compact row per issue, oldest first, opening in place into a thread of what failed, the reason, and the last output lines.
- [ ] Add "fix it here" to launch a fix agent from an issue
      Carry the issue's context into the agent and record the attempt and result back in the thread.
- [ ] Add "promote to a fix entity" per [[IDEA-187]]
      Create the fix entity, point the issue at it, and stop the issue carrying the work.
