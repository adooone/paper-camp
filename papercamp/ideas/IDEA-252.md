---
id: IDEA-252
title: Push notifications you choose
type: feat
status: review
created: 2026-09-10
tags:
  - app
  - server
  - notifications
subject: Run & monitor
order: 5
---

The app already knows when something goes wrong and tells nobody who is
not looking. `notification-log.ts` records a task that finished, failed,
or was interrupted, an agent reply, and a parked question; the Log shows
them and the bell counts them. Delivery stops there: `use-notification-push.ts`
fires a browser notification only while a tab is open and unfocused, as
[[IDEA-153]] chose for a tool that was then single-machine. The daemon
now runs on a server, the desk is a laptop on the tailnet, and the phone
([[IDEA-250]]) has no tab at all. A phase that fails at two in the
morning is found at nine. And nothing lets you say which events deserve
an interruption: every kind is announced, or none.

**Every failure is an event, and every event has one source.** The
notification log stays the single emitter and gains the kinds that are
missing: a check that failed on a run's stack — quality, tests,
consistency, docs — a PR review that requested changes, a night review
that found something ([[IDEA-241]]), and a desk service that stopped
unexpectedly. Each carries the entity or entry it belongs to, so the Log
row, the bell, and the push all describe the same thing. Kinds are named
in `src/types/index.ts` as one union, and that union is the list the
settings show.

**Settings → Notifications.** One switch per kind, stored in
`papercamp/config.json` under `notifications.kinds`, per project. On by
default: run failed, run interrupted, check failed, question parked, PR
review requested changes, night review findings, service stopped. Off by
default: run finished, reply posted. A kind switched off is still logged
and still counted by the bell; it is not pushed. Below the switches,
*This device* shows the browser's permission state and a switch that
subscribes or unsubscribes this browser, and *Devices* lists every
subscribed device — browser or phone, by name and last delivery — with a
remove action.

**One subscription store, two transports.** The daemon keeps
subscriptions per project in `~/.config/paper-camp/push.json`
(honouring `PAPERCAMP_CONFIG_DIR`), written through
`POST /p/<slug>/api/push/subscribe` and its `DELETE`, each record naming
its transport: `webpush` with the browser's subscription, or `expo` with
the phone's token. VAPID keys are minted once per machine into
`vapid.json` beside it, and the public key is served for the client to
subscribe with. When the notification log appends a kind that is on, the
daemon sends to every subscription for that project: Web Push to
browsers, Expo's push service to phones. A subscription the transport
reports gone is removed. Delivery failures are logged to `daemon.log`,
never surfaced as notifications themselves.

**The hosted client gets a service worker for this and nothing else.**
`sw.js` handles `push` — show the notification with the entity title and
the event text — and `notificationclick` — open the app on the Log entry
the payload names, or the running task's entry when it is still running.
No precaching; the client stays online-only. The worker is registered
once, when the *This device* switch is turned on; the tab-open
announcement in `use-notification-push.ts` is removed, because a
subscribed browser now hears from the daemon whether the tab is focused,
unfocused, or closed. Chrome, Safari 16.4 and later, and Firefox deliver
these; an installed copy on iOS does too.

### Out of scope

Per-device kind preferences; the switches are per project. Email, Slack,
or any transport other than Web Push and Expo. The phone app's own
registration flow, which [[IDEA-250]] describes. Aggregating pushes across
projects in the hub.

### Phases
- [x] Widen the kinds into one union
      Replace `StoredNotificationKind` in `src/types/index.ts` with the full list, and emit check failed, PR review requested changes, night review findings, and service stopped from where each is already detected.
      run: 8m20s · 142 in · 36.2k out · sonnet-5 · sess:4200702c-e400-4318-8bfe-785c07a70370
- [x] Store the per-kind switches in `papercamp/config.json`
      `notifications.kinds` with the stated defaults, read when the log appends so an off kind is still logged and counted but never pushed.
      run: 6m41s · 132 in · 26.1k out · sonnet-5 · sess:824f9143-263b-413c-b928-13e253787727
- [x] Keep subscriptions and VAPID keys in the daemon
      `push.json` and `vapid.json` under `PAPERCAMP_CONFIG_DIR`, behind `POST`/`DELETE /p/<slug>/api/push/subscribe` and a public-key read.
      run: 5m17s · 78 in · 23.9k out · sonnet-5 · sess:824f9143-263b-413c-b928-13e253787727
- [x] Send on append over Web Push and Expo
      Fan out to every subscription for the project, drop the ones the transport reports gone, and log failures to `daemon.log`.
      run: 2m59s · 76 in · 20.5k out · sonnet-5 · sess:aa5e3cac-6d66-4d29-ade4-dc4aac0fc80c
- [x] Add `sw.js` to the hosted client
      Handle `push` and `notificationclick` with no precaching, register it when *This device* is switched on, and delete the tab-open announcement in `use-notification-push.ts`.
      run: 6m12s · 102 in · 37.3k out · sonnet-5 · sess:aa5e3cac-6d66-4d29-ade4-dc4aac0fc80c
- [x] Build Settings → Notifications
      The switch per kind, *This device* with its permission state, and *Devices* with last delivery and a remove action.
      run: 5m51s · 160 in · 41.6k out · sonnet-5 · sess:820e7fe1-12cf-4294-9061-939094ce0507
