---
id: IDEA-249
title: Phone-first web client
type: feat
status: dropped
created: 2026-09-10
updated: 2026-09-10
tags:
  - app
  - ui
subject: Mobile control desk
---

The hosted client already reaches a daemon from a phone: Tailscale on the
phone, the printed link, Add to Home Screen. What it does once it is there
is a desktop layout squeezed to 480 pixels. `public/manifest.json` makes
it installable, but there is no service worker, so an installed copy still
needs the network for its own shell; `use-notification-push.ts` uses the
browser Notification API, which fires only while a tab is open, so a
finished run or a parked question never reaches a locked phone; and the
pages behind the phone-width bottom nav are the same Plans list, Log, and
idea detail as the desktop, with the Stack panel — the one surface a phone
user opens the app for — hidden behind a toggle.

**Installed means offline-capable.** A service worker precaches the app
shell — the bundle, fonts, and the paper textures — so an installed copy
opens instantly and shows the last hub it saw when the tailnet is not yet
up. API responses are not cached; the shell says the runtime is
unreachable, as it does today, rather than showing stale plans as live.

**Push reaches the lock screen.** The daemon gains a push subscription per
paired client: the client registers a Web Push subscription with the
runtime it is paired to (`POST /p/<slug>/api/push/subscribe`), and the
daemon sends a push for the events `notification-log.ts` already records —
a run finished, a run interrupted, an agent parked on a question, a PR
review that requested changes. Pushes carry the entry id, and opening one
lands on that Log entry. VAPID keys are minted once per machine beside the
pairing state. iOS delivers these to an installed PWA, Android to any.
Settings → Notifications lists this device's subscription with a switch.

**Three surfaces are designed for a thumb.** Below 480 pixels:

- *Now* replaces the Stack panel toggle as the first bottom-nav item — the
  running task's card with its live output, the check stamps, and the git
  card, as a page rather than a drawer.
- *Log* keeps its rows but drops to time, type, and outcome, and an entry
  page whose actions sit in a fixed bottom bar.
- The idea detail puts its status, run, and comment actions in that same
  bottom bar, above the keyboard when the comment box has focus, and folds
  the sidebar card into a sheet opened from the title.

Plans, Docs, Roadmap, Stats, and Settings keep their responsive layouts as
they are; they are read on a phone, not worked in.

**The daemon link is the whole onboarding.** Opening the printed link on
the phone pairs, lands on the project ([[IDEA-246]]), and prompts once to
install and once to allow notifications, in that order, from a two-line
card in the hub rather than the browser's own buried menu.

### Out of scope

A native app; that is [[IDEA-250]]. Offline editing of the corpus. Any
change to the desktop layouts.

### Thread
- [2026-09-10] decision: Dropped in favour of [[IDEA-250]]. The web client stays responsive as it is; the daemon push subscription moved into IDEA-250 with Expo push as its only transport.
