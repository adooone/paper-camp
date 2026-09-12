---
id: IDEA-261
title: Bold clickables, cards not dividers
type: fix
kind: fix
status: done
idea: IDEA-259
created: 2026-09-12
updated: 2026-09-12
tags:
  - app
  - ui
subject: App UI
order: 1
---

[[IDEA-259]] put every sidebar on one grammar and left two things
unsettled. The *Details* and *Feedback* tabs still render at the default
weight while the command rows beneath them are 600, so the same column
has two ideas of what a clickable label looks like; and the grammar's
divider draws a line above the tabs, where nothing precedes it, and
beneath the Order input, where a hairline under a bordered field reads as
a second border. The 2026-09-12 screenshot of the idea sidebar shows
both.

**Every clickable label is 600.** One rule in `utilities.css`, not a
class to remember: buttons, links, tabs, and clickable rows — `button`,
`a`, `[role="button"]`, `[role="tab"]`, `[role="menuitem"]`, and
`.pc-row[data-clickable]` — set `font-weight: 600`, with form controls
excluded. Text that is not clickable keeps the default weight, so weight
alone says what can be pressed. paper-ui's own Button already sits at
600; the rule brings ListItem rows, tabs, and inline links to it, and any
per-component `font-semibold` that only restates the rule is removed.

**No dividers in a sidebar.** `SidebarDivider` is deleted. A sidebar is a
stack of cards, and a card is the only grouping: `SidebarShell` renders
each child as its own `pc-sidebar-card`, and a sidebar passes one child
per group. The idea sidebar becomes two cards — tabs, status, and fields
in the first; the work and lifecycle commands in the second, with the
lifecycle rows last and rose. The filter sidebars become two — search,
chips, fields, and *Clear filters* in the first; the stats grid in the
second where a page has one. Navigation sidebars stay one card. Rows
inside a card are separated by the 32px rhythm alone.

**The same rule everywhere else.** A `Divider` never sits directly under
an input or select, and never separates groups that mean different
things; those become cards. It stays only between rows of one uniform
list — the built-in checks in the Night section, the connection rows in
Setup, the file rows in the Git page's list. The Settings sections, the
hub home, the Stack panel's Desk section, and the desk proposal modal are
reviewed against that rule and split where they break it.

### Out of scope

The grammar's pieces themselves, which [[IDEA-259]] settled. Any change
to which commands a sidebar offers.

### Phases
- [x] Weight every clickable label at 600
      The `utilities.css` rule with form controls excluded, `data-clickable` on interactive `.pc-row`s, and the redundant `font-semibold` classes removed.
      run: 6m9s · 98 in · 21.7k out · sonnet-5 · sess:756988cf-97bf-41f6-a56e-9d0ea6cff1df
- [x] Turn sidebars into card stacks and delete the divider
      `SidebarShell` renders one card per child; the idea sidebar splits into a main and an actions card, the filter sidebars into filters and stats.
      run: 8m29s · 118 in · 37.1k out · sonnet-5 · sess:756988cf-97bf-41f6-a56e-9d0ea6cff1df
- [x] Apply the divider rule across Settings, the hub, and the Stack panel
      Remove dividers under inputs and between unlike groups, splitting those into cards; keep the ones inside uniform lists.
      run: 6m12s · 86 in · 27.2k out · sonnet-5 · sess:f66660a8-f8f3-435e-b92a-febbe6fca09f
