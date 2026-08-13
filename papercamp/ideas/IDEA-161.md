---
id: IDEA-161
title: Desk section clips its own content
type: fix
status: idea
created: 2026-08-13
updated: 2026-08-13
tags:
  - app
  - stack
  - layout
subject: App UI
---

The Stack panel's Desk section has no scroll container, so everything past the
panel's height is clipped and unreachable.

`stack-panel.tsx`'s root is `overflow-hidden`, and `desk-section.tsx`'s wrapper
is `min-h-0 flex-1 p-6` with no `overflow-y-auto`. `AgentSection` has its own
scroller; Desk doesn't. Measured live at 480px panel width:

| viewport height | CI & release px lost |
|----|----|
| 887 | 47 |
| 800 | 134 |
| 768 | 166 |
| 700 | 234 |

At 768px — an ordinary laptop — the released-version line, the Release PR link
and "Open Actions" are all permanently out of reach. Nothing signals the loss:
no scrollbar, no fade, no half-cut row. The panel simply ends.

The Desk section scrolls within the panel: the "Stack" header stays fixed,
Agent keeps its own scroller and its reserved `basis-[9.25rem]` height
(deliberate, IDEA-109 — leave it alone), and Desk gets `overflow-y-auto` and
scrolls independently. The whole panel body does not become one scroller.

Second, related layout-stability bug in the same file: `desk-section.tsx`
returns `null` while `useDeskManifest` is in flight, so the bottom half of the
panel pops in after the config fetch. Render the section shell immediately and
vary its contents, per UX_PRINCIPLES §1. When `desk` is absent from
`papercamp/config.json` entirely, the section says so and points at the config
key rather than silently rendering nothing.
