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

### Thread
- [x] 2026-08-11 [decision] Push notifications are tab-open-but-unfocused only, via the Notification API off the existing SSE stream — no service worker, no closed-tab delivery. Read/unread is new for the two added kinds; parked questions keep their existing resolve-by-reply model unchanged.
