---
id: IDEA-283
title: Adopt paper-ui's drawer and overflow
type: refactor
status: idea
created: 2026-09-22
tags:
  - app
  - ui
  - paper-ui
subject: One design system
order: 5
---

paper-ui's IDEA-7 ships the drawer and the overflow toolbar this app
built by hand. Blocked until that release; the first phase bumps the
dependency. Runs after [[IDEA-281]].

**The sidebar drawer is the library's.** `sidebar-shell.tsx`'s scrim,
focus trap, Escape handling and raw backdrop button go; `AppShell`
renders its sidebar through `Layout` and gets the phone `Drawer` from
it. `--pc-stack-*` stays, since the stack panel is the app's own.

**The status bar is an `OverflowToolbar`.** `status-bar-overflow.ts` and
its tests are deleted, their logic now the library's; `status-bar-core`
passes each item with its `priority` — refresh, git, ahead, capacity,
setup and sign-in fold first, chat and the bell never.

**What remains in `components/`.** The git surfaces, the stack panel,
the status bar's contents, the banners, the breadcrumb derivation and
the runtime states — everything that knows what Paper Camp is.

### Out of scope

Anything in the stack panel's own layout.

### Phases
- [ ] Bump `@dendelion/paper-ui` to the IDEA-7 release
- [ ] Render the shell's sidebar and phone drawer through the library
      `AppShell` mounts its sidebar in `Layout` and takes the phone `Drawer` from it, so `sidebar-shell.tsx` loses the scrim, focus trap, Escape handling and backdrop button.
- [ ] Rebuild the status bar as an `OverflowToolbar`
      `status-bar-core` hands each item its `priority`; `status-bar-overflow.ts` and its tests are deleted.
