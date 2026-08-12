---
id: IDEA-153
title: Notifications view replaces the Inbox
type: feat
status: idea
created: 2026-08-11
tags:
  - app
  - notifications
  - ux
subject: App UI
---

The Inbox (`/inbox`, [[IDEA-118]]) shows exactly one thing today: open
parked agent questions. Grow it into a real notification center, and
move it out of the nav menu into the toolbar.

1. **Three notification kinds, one feed.** Parked questions (today's
   only kind — an agent blocked, waiting on a reply) keep their existing
   data and reply flow unchanged. Two new kinds join them: **agent
   completed** (a task — run-all, phase, fix-review, audit — reaches
   `done`/`error`) and **new reply** (an agent posts to an idea's
   feedback thread without being a blocking question — a completed
   run's summary, a chat answer). All three render in one age-ordered
   list; each row still links back to its owning idea.

2. **Read/unread, not just open/resolved.** Parked questions keep their
   existing open→resolved lifecycle (resolved by replying). Completed
   and reply notifications get a lighter read/unread flag, set when
   viewed in this page — the toolbar badge counts unread across all
   three kinds, not just open questions as it does today.

3. **Browser push, scoped honestly.** Notification-API pushes (not a
   service-worker/Web Push background system — this is a single-user
   local tool, that's the wrong amount of infrastructure) fire for
   *agent completed* and *new reply* while the app tab is open but not
   focused, driven by the SSE stream (`/api/activity/stream`) already
   open for live updates. Requires the user granting Notification
   permission once; degrades silently without it. Doesn't fire when the
   tab itself is closed — there is no v1 story for that.

4. **Moves to the toolbar.** The nav-menu "Inbox" entry
   (`router.tsx` `navItems`) is removed; a small icon button with the
   same unread-count badge (today's `parkedQuestionCount` stamp,
   generalized to the unread total) lives in the toolbar instead,
   alongside [[IDEA-154]]'s git icon.

### Phases
- [x] Extend the notification model with the two new kinds and a read flag
      Add agent-completed and new-reply notifications alongside parked questions, each carrying its owning idea and a read/unread flag.
      run: 5m32s · 17.8k in · 30.3k out · sonnet-5
- [x] Emit the new notifications from task and feedback events
      Create a completed notification when a task reaches done/error, and a reply notification when an agent posts a non-blocking feedback thread entry.
      run: 8m33s · 4.8k in · 23.8k out · sonnet-5
- [x] Render all three kinds in one age-ordered feed
      Replace the Inbox page's questions-only list; keep the parked-question reply flow unchanged.
- [x] Mark viewed notifications read and count unread for the badge
      Set the read flag on view for the two new kinds, and generalise the badge stamp from parked-question count to total unread.
      run: 4m44s · 10.7k in · 12.7k out · sonnet-5
- [x] Fire Notification-API pushes off the SSE stream
      Push agent-completed and new-reply while the tab is open but unfocused, gated on granted permission, degrading silently otherwise.
      run: 4m18s · 1.8k in · 12.3k out · sonnet-5
- [ ] Move the entry from the nav menu to the toolbar
      Remove the `router.tsx` navItems Inbox entry and add a toolbar icon button with the unread badge.

### Thread
- [x] 2026-08-11 [decision] Push notifications are tab-open-but-unfocused only, via the Notification API off the existing SSE stream — no service worker, no closed-tab delivery. Read/unread is new for the two added kinds; parked questions keep their existing resolve-by-reply model unchanged.
