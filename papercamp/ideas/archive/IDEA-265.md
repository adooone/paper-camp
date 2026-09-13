---
id: IDEA-265
title: Checks leave the Stack
type: refactor
status: done
created: 2026-09-13
updated: 2026-09-13
tags:
  - app
  - stack
  - ui
subject: App UI
order: 3
---

The desk checks are shown twice. The Stack panel's *Checks* group draws
a stamp per check under Services, and the Git page's checks row and the
idea view's deliver card draw the same stamps beside the commit action,
where they decide whether a commit is ready. The Stack copy carries the
*Fix* action and the red dot on the panel's toggle; the git copies carry
the decision. Two places, one meaning, and the Stack, which is the
agent's activity surface, fills up with rows about the working tree.

**Checks belong to the git sections.** `checks-group.tsx` and its tests
are deleted, and the Desk section of the Stack keeps Services and CI &
release only. The Git page's checks row and the deliver card's
`deliver-checks-row.tsx` become the one place a check is read: the same
stamps, in manifest order, with *Docs* last, and the *Fix* action on a red
stamp launching the same issue-fix task the Stack's group launched, its
progress shown as the task card in the Stack's Agent section as every
other run is. A stale check re-runs from the row's refresh, the way the
Stack's group re-ran it.

**The signal moves with them.** The Stack toggle's red dot for a failing
check goes; the status bar's git stamp carries the failing count instead,
next to the changed-files count it already shows, so a red check is
visible from every page and one click away on the Git page.

**Settings stay where they are.** Settings → Desk keeps the manifest
editor for checks, their commands and fix commands, and the run-all
sweep and the night gate keep running the manifest's checks on the
server; nothing about what a check is or when it runs changes.

### Out of scope

The Services and CI & release groups. What the checks run, which
[[IDEA-263]] settles. The Stack panel's own layout.

### Phases
- [x] Move Fix and refresh into the checks row
      `firstFailingCheck`, `activeCheckFix` and the auto-fix/fix stamps move from
      `checks-group.tsx` into `deliver-checks-row.tsx` and `use-deliver-checks-row.ts`,
      with the group's tests rewritten against their new home.
      run: 3m33s · 72 in · 19.7k out · sonnet-5 · sess:380fae25-37c1-4434-a648-41d3721bcb84
- [x] Show the checks row on the Git page
      Beside the commit action in `git-page.tsx`, reading from the same row component.
      run: 1m40s · 38 in · 6.5k out · sonnet-5 · sess:380fae25-37c1-4434-a648-41d3721bcb84
- [x] Delete the Stack's Checks group
      Drop `checks-group.tsx` and its test and leave `desk-section.tsx` with Services and CI & release.
      run: 54s · 26 in · 2.4k out · sonnet-5 · sess:380fae25-37c1-4434-a648-41d3721bcb84
- [x] Move the failing signal to the status bar
      `use-stack-panel.ts` loses `anyChecksFailing` and the toggle's red dot; the git
      stamp in `status-bar-core.tsx` shows the failing count next to the changed-files count.
      run: 3m47s · 74 in · 16k out · sonnet-5 · sess:380fae25-37c1-4434-a648-41d3721bcb84
