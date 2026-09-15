---
id: IDEA-268
title: The hub shows what it already knows
type: fix
kind: fix
status: done
idea: IDEA-264
created: 2026-09-15
updated: 2026-09-15
tags:
  - app
  - ui
  - multi-project
subject: Multi-project
order: 1
---

The hub [[IDEA-264]] shipped renders a machine's rows only from that
machine's own report, so until the report lands the section is a header
over an empty sheet. On a tailnet machine, where Chrome holds the request
open behind its local-network prompt, that is close to a minute of blank
page — and this browser already has the project list on disk, which the
old hub used to show while each row's status loaded. Two smaller faults
sit beside it: `fetchOne` awaits the project list and the runtime version
together, so the slower one gates the section, and the numbers column
renders empty figures rather than saying it is still counting.

**Remembered first, reconciled after.** While a machine's report is
`loading` or `waiting`, `buildHubMachines` builds its rows from the
remembered projects whose runtime URL parses to that machine, and swaps
in the reported rows when they arrive. A row shown this way carries a
loading stamp, never a stale one, so nothing claims a project is idle
before the machine has said so.

**Loading has a spinner, not a blank.** A row whose live state is unknown
shows a spinner where its stamp goes, and each figure in the numbers
column shows one while its project data is in flight. No card renders
empty and no figure prints a zero it does not have: a figure with nothing
yet is a spinner, a figure whose projects answered with nothing is its
muted line.

**The version never gates the list.** `fetchOne` reports the projects as
soon as they arrive and folds the runtime version in when it lands, so a
slow capabilities probe cannot hold the section.

**The sheet gets its edge, and the title its mark.** The `Page` around the
machine list is the only surface with no outline while every card beside
it has one; it takes the same border. `public/img/paper-logo.svg`, already
the favicon, sits before the "Paper Camp" title at the title's cap height.

### Out of scope

What the figures count, and the machine grouping itself, which
[[IDEA-264]] settled.

### Phases
- [x] Report the projects without waiting on the version
      Split the two requests in `fetchOne` so the machine report resolves on
      the project list and folds `runtimeVersion` in when it lands.
      run: 1m14s · 24 in · 3.8k out · sonnet-5 · sess:80c068d1-ed21-4412-bc26-637786a08e0d
- [x] Build rows from remembered projects while a machine is unreported
      `buildHubMachines` groups remembered runtime URLs under their machine
      while its reach is `loading` or `waiting`, with a `loading` stamp kind.
      run: 1m32s · 26 in · 5.7k out · sonnet-5 · sess:80c068d1-ed21-4412-bc26-637786a08e0d
- [x] Give a loading row a spinner where its stamp goes
      run: 53s · 20 in · 1.9k out · sonnet-5 · sess:80c068d1-ed21-4412-bc26-637786a08e0d
- [x] Track each figure's in-flight state and spin it
      `useHubNumbers` tells the column which figures have no data yet, so a
      spinner stands in for a figure that would otherwise print a bare zero.
      run: 2m27s · 42 in · 11.1k out · sonnet-5 · sess:80c068d1-ed21-4412-bc26-637786a08e0d
- [x] Outline the hub sheet and mark the title with the logo
      run: 1m29s · 38 in · 3.8k out · sonnet-5 · sess:80c068d1-ed21-4412-bc26-637786a08e0d
