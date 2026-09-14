---
id: IDEA-267
title: Settings rows lose their cards
type: refactor
status: review
created: 2026-09-13
updated: 2026-09-14
tags:
  - app
  - ui
subject: App UI
order: 2
---

Every row on the Settings page is its own `Card`: the project-info rows,
the desk's service and check rows, the agent rows, the toolbar and night
sections. Each draws a filled rectangle a shade darker than its ground, so
a settings page is a stack of brown slabs with no visible grouping — the
boxes mark rows, not sections, and a row inside a section needs a third
shade to stay legible. The paper the design imitates does not work that
way: a sheet is one surface, and what separates things on it is a ruled
line.

**Settings is one surface, ruled.** Its content cards go: a row is its
children on the page ground, and a *section* — General, Ideas, Stack,
Automation, Toolbar, Night shift, Notifications — is a titled group
followed by a hand-drawn rule before the next one, with no rule after the
last. The row rhythm, hover, and active state stay exactly as they are.

**Only Settings.** Every other card in the app keeps its box: the plan,
idea, roadmap and log row cards, the hub's machine list and its number
tiles, the Stats page's tiles, the chat and feedback bubbles, modals,
toasts, and the Stack's chalkboard cards. `surface.card` and
`surface.nestedCard` stay, because those cards still use them.

**The rule is a paper-ui component.** paper-ui's `Divider` gained
`sketch` (paper-ui IDEA-2), a rough.js single stroke seeded from its own
id so it does not re-wobble on every render, honouring the existing
`surface` prop for the chalkboard's chalk line. Settings uses that.

### Out of scope

Every card outside the Settings page, as listed above. Which settings a
section contains, and the order of the sections.

### Phases
- [x] Adopt paper-ui's sketch Divider
- [x] Rule the sidebar again
- [x] Move the row affordances onto the row
- [x] Rule the Settings sections and unbox their rows
      Every `Card` under `features/settings/` becomes its children, with a `Divider sketch` between sections and none after the last; the row grid, hover, and active state stay.
      run: 5m42s · 94 in · 21.7k out · sonnet-5 · sess:5b242b38-d551-451d-a9a7-a268e30cebed
- [x] [manual] Settings rows lose their cards

### Thread
- [x] 2026-09-13 [question] [agent] Run-all parked on phase 1 ("Adopt paper-ui's sketch Divider") — the agent needs a decision: The paper-ui release with the sketch Divider hasn't shipped yet — latest published `@dendelion/paper-ui` is 0.19.0 and its `DividerProps` still only has `orientation`, `label`, `surface`, `className` (no `sketch`). The plan states "Until that release lands, this idea does not start." Should I wait for that release, or is there a different/prerelease version I should be pointed at?
- [x] 2026-09-13 [chat] Decision: you read it right — wait. The sketch Divider does not exist yet; paper-ui's IDEA-2 was just drafted to add it and has to be run and released there first. There is no prerelease to point at. Stop this run here; IDEA-267 resumes from phase 1 once a paper-ui release carrying `Divider sketch` is published and installed.
- [x] 2026-09-13 [chat] [agent] Right, noted — that's the same wait paper-camp's run parked on. IDEA-267 stays put at phase 1 until paper-ui ships and installs a Divider with `sketch`. No changes here.
- [x] 2026-09-14 [question] [agent] Run-all parked on phase 4 ("Replace the page cards with ruled groups") — the agent needs a decision: Two areas use `Card` as a wrapping tile in a flex-wrap/grid dashboard layout, not as a stacked "group on a sheet": (1) the Stats page (`StatsGrid` → 11 `StatCard` tiles wrapping side-by-side via `flex flex-wrap`), and (2) the Hub's `HubNumbersColumn` (`NumberCard` tiles, including a 2-column grid for two of them). The plan's model — children + a horizontal rule before the next group, none after the last — assumes groups stack vertically; it doesn't say what a horizontal rule means between tiles that sit side-by-side and wrap. Should these tiles (a) keep their `Card` box treatment as an explicit exception (same reasoning as the Stack's capacity card — small multiples, not sheet groups), or (b) drop the box and become a plain wrapped grid of unboxed content with no rules at all, or (c) something else you have in mind? I don't want to guess and redesign 12 files' layout wrong.
