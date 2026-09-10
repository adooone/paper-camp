---
id: IDEA-250
title: Native app on React Native
type: feat
status: idea
created: 2026-09-10
tags:
  - app
subject: Mobile control desk
order: 5
---

With the daemon as the only server and its shapes published in
`@dendelion/paper-camp`, a second client is a bounded project instead of
a fork of the dashboard. The web client covers the phone well enough for
reading and for a tap on *run*; what it cannot do is be a real app on
the phone: an icon that opens without a browser frame, notifications that
arrive with the app closed and without the PWA install dance, and a
shell that stays responsive while the tailnet is waking up.

**One codebase, one store review.** The app is React Native on Expo, in
its own repository, `paper-camp-mobile`, depending on the published
`@dendelion/paper-camp` for `core` and `types` so status derivation, run
rows, and the corpus shapes are the same code the daemon runs. Expo's EAS
Update ships the JavaScript over the air: the App Store and Play Store
reviews happen once for the native shell, and every release after that
lands by pushing an update channel, the same way the hosted client lands
by pushing `main`. A native-module change is the only thing that needs a
new store build.

**The same way in.** The app's first screen is a scanner for the link the
daemon prints — the QR code the banner gains for `--tailnet` and `--share`
links — and a paste field for the same link. It pairs with the token the
link carries, remembers the machine, and lists its projects exactly as the
hub does, reading `/api/machine/projects` and the project endpoints from
the package's types. Tailscale on the phone is the network; the app does
not tunnel anything itself. `/api/package-name` already returns the
runtime's version; the app carries the lowest version it was built
against and, when a paired runtime is older, shows an *Update the daemon*
card on the machine in place of its projects.

**Four screens, and no more.** A bottom bar with Projects, Chat, Log, and
More; More is a sheet listing Docs, Roadmap, Stats, and Settings, each
opening the web client in an in-app browser, plus *Add a machine*. Every
screen has a handwritten title on the left and the current project's name
on the right, which opens the project switcher as a sheet. No drawer.

- *Pair* — first launch and *Add a machine*: a viewfinder for the QR code,
  a paste field for the same link, one *Pair* button; it lands on Projects.
- *Projects* — one kraft card per remembered machine: host name with a
  reach stamp (ready, waiting with *Try again*, unreachable), and a row per
  project carrying the running stamp with the plan title when an agent is
  working, idle otherwise. Tapping a row makes it current and opens Chat.
- *Chat* — the project conversation from [[IDEA-251]], the tab the app
  opens on: messages in kraft bubbles for you and paper for the agent, the
  composer fixed above the keyboard. Anything typed here is an instruction
  for the project: describing work makes an idea and the reply links it;
  feedback on an idea, run, or entry lands on that entity's thread; a
  question the agent parked appears here as a card with the answer field.
  Idea, run, and entry links in replies open the app's own screens.
- *Log* — unread count in the title row; one scrolling chip row, outcome
  chips first and colored, type chips after and neutral; rows of time,
  name, and outcome stamp, unread in the heavier weight, a running task as
  the first row with its stamp and elapsed time; pull to refresh. An entry
  is the details card, the chalkboard output, and a bottom bar with *Fix
  it here*, *Promote*, and *Mark read*. The running task's entry tails
  live output, shows the four check stamps and the git row, and its bar
  holds *Stop* and, when the agent is parked on a question, *Answer*.
- *Idea* — a kraft head card with id and type, the handwritten title, the
  status stamp, and progress as a handwritten fraction; the body as an
  excerpt that expands on tap; the phases as a checklist with the running
  stamp on the active one. The bottom bar holds *Run next*, *Comment*, and
  *Status*, the last a sheet of the allowed transitions.

Stamps are bordered pills with the web's meaning-to-color mapping: running
blue, done green, failed red, parked amber, idle gray.

**Notifications through the daemon.** The daemon gains one push
subscription per paired device: the app registers its Expo push token
with each paired runtime (`POST /p/<slug>/api/push/subscribe`, removed by
the matching `DELETE`), and the daemon sends through Expo's push service
for the events `notification-log.ts` already records — a run finished, a
run interrupted, an agent parked on a question, a PR review that
requested changes. A push carries the entry id; tapping it opens that
entry, or the running task's entry while it is still running. Settings →
Notifications on the desk lists the subscribed devices with a remove
action.

**The paper stays, paper-ui does not come along.** paper-ui is React DOM
and SCSS, so none of its components run in React Native. What crosses
over is the material: paper-ui's `./tokens` export (paper-ui IDEA-1) —
a dependency-free module carrying the paper and ink ramps, the kraft,
chalkboard, and stamp colors, the font families, and the radii — which
the app reads, so a color changed in paper-ui reaches the phone on the
next dependency bump. The fonts load through `expo-font`: Caveat and
JetBrains Mono from Google Fonts, Luminari from paper-ui's `dist/fonts`,
and the paper textures from its `dist/img`. On top of that the app keeps
eight native primitives in its own `ui/` folder, not a package: Paper
(the screen ground), KraftCard, Chalkboard, Stamp, Hand (handwritten
text), Row, Sheet, and BottomBar. That is every visual the four screens
use; a `paper-ui-native` package waits for a second native app that
would share it.

### Out of scope

Editing idea bodies or plans from the phone. Offline work. A tablet
layout. Web Push for the browser; the phone is the native app. Any daemon
change beyond the push subscription above and the chat from [[IDEA-251]].

### Phases
- [ ] Scaffold `paper-camp-mobile` on paper-ui's tokens
      Expo app depending on the published `@dendelion/paper-camp`, fonts and textures through `expo-font`, and the eight `ui/` primitives.
- [ ] Build the shell: bottom bar, title row, and project switcher
- [ ] Pair a machine from the printed link
      QR viewfinder and paste field, stored token, remembered machines, and the *Update the daemon* card when a runtime is older than the built-against version.
- [ ] Build the Projects tab
      Machine cards with reach stamps and project rows carrying the running stamp.
- [ ] Build the Chat tab against [[IDEA-251]]
- [ ] Build the Log tab and the entity screens
      Chip filters and rows, the entry with its chalkboard output and bar, the live running task, and the Idea screen.
- [ ] Add the push subscription to the daemon and send through Expo
      `POST`/`DELETE /p/<slug>/api/push/subscribe`, sends for the `notification-log.ts` events, deep link to the entry, and the device list in Settings → Notifications.
- [ ] Cut the store build and the EAS update channel
