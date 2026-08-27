---
id: IDEA-217
title: GitHub connect on the Projects tab
type: fix
status: review
created: 2026-08-26
tags:
  - app
subject: Multi-project
---

`GithubConnectCard` renders only on the hub's `WelcomeScreen`, and the welcome
screen renders only while the runtime registry is empty (`hub-home.tsx`). Add
one project and the card is unreachable: connecting GitHub after your first
project means removing every project just to see the form again, and an
already-stored token has no visible status or disconnect anywhere in the app.

Render `GithubConnectCard` on the Projects tab too: in `ProjectsList`, beside
`AddByRuntimeUrlCard`, in the same side-by-side row the welcome screen uses
(`flex flex-col gap-4 sm:flex-row`). Both of the card's states come along
unchanged — the connect form when no token is stored, the connected card
(identity, reachable repositories, Disconnect) when one is — so the hub always
shows GitHub status. The welcome screen keeps its copy; `hub-home.tsx` stays
the only switch between the two views.

### Out of scope

Any change to the GitHub token flow itself, or where the token is stored.

### Phases
- [x] Render `GithubConnectCard` beside `AddByRuntimeUrlCard`
      Wrap both in a `flex flex-col gap-4 sm:flex-row` row at the bottom of
      `ProjectsList`, below the Projects card.
      run: 1m16s · 20 in · 2.1k out · sonnet-5
- [x] Check both card states on a hub that has projects
      The connect form with no stored token, the connected card with one, and
      the form returning after Disconnect.
      run: 31s · 6 in · 1k out · sonnet-5
- [x] Confine the diff to `projects-list.tsx`
      `WelcomeScreen` keeps its own copy and row, `hub-home.tsx` its switch.
      run: 23s · 12 in · 861 out · sonnet-5
- [x] Run the app's quality checks
      run: 24s · 12 in · 816 out · sonnet-5
