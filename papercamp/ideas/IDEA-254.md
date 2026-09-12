---
id: IDEA-254
title: First Plans click lands on Setup
type: fix
status: idea
created: 2026-09-10
tags:
  - app
  - ui
subject: App UI
order: 7
---

Seen on the hosted client with the Radio project: from Settings → Setup,
the first click on *Plans* in the nav shows Settings → Setup again, with
*Plans* highlighted in the nav while the URL reads `/settings/setup`. The
second click reaches Plans and it stays. Any project with an incomplete
capability and `setupDismissed` unset reproduces it, as long as the
session opened on a page other than the worklist.

The first-run guard in `use-app-shell.ts` is the cause. Its effect
returns early while `pathname !== '/'` without marking
`firstRunChecked`, so a session that opens on `/settings/setup` — the
hub's remembered route, a deep link, or the daemon's redirect target —
leaves the guard armed. The first navigation to `/` then trips it: the
capability probe resolves a moment after the route changed and sends the
user back to Setup. The guard was written for a fresh install opening at
the root, not for a user who has already been in Settings and is heading
to the worklist.

**Arm the guard once, at mount.** The effect runs on the first render
regardless of pathname and sets `firstRunChecked` immediately. It
redirects to Setup only when the app opened on `/` and the pathname is
still `/` when the probe resolves; a click on *Plans* later in the session
never triggers it. The USAGE.md fallback for an unused corpus keeps the
same condition. `use-app-shell.ts` gets a test for the sequence open on
`/settings/setup`, navigate to `/`, probe resolves with an incomplete
capability: the pathname stays `/`.

### Out of scope

The Setup page itself and the *Show Setup on open* switch, which
[[IDEA-253]] reshapes.

### Phases
- [ ] Arm the first-run guard once at mount and gate the redirect on the opening pathname
      In `src/app/hooks/use-app-shell.ts`; the redirect fires only when the app opened on `/` and is still there when the probe resolves.
- [ ] Add the regression test
      Open on `/settings/setup`, navigate to `/`, resolve the probe with an incomplete capability; the pathname stays `/`.
