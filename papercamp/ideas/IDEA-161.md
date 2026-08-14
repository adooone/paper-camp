---
id: IDEA-161
title: Desk section clips its own content
type: fix
status: review
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

### Phases
- [x] Give Desk its own scroller
      Add `overflow-y-auto` to the Desk wrapper so it scrolls within the panel while the "Stack" header and Agent's reserved height stay put.
      run: 35s · 5.7k in · 1.5k out · sonnet-5
- [x] Verify clipped content is reachable
      Confirm the released-version line, Release PR link, and "Open Actions" are scrollable at 768px and below.
      run: 43s · 91 in · 2.9k out · sonnet-5
- [x] Render the shell during load
      Return the section shell immediately while `useDeskManifest` is in flight instead of `null`, varying only the contents.
      run: 2m23s · 1.4k in · 4.7k out · sonnet-5
- [x] Handle a missing `desk` config key
      When `desk` is absent from `papercamp/config.json`, state so and point at the config key.
      run: 52s · 225 in · 3.1k out · sonnet-5
