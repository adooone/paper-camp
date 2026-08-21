---
id: IDEA-161
title: Desk section clips its own content
type: fix
status: done
created: 2026-08-13
updated: 2026-08-15
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
- [x] [manual] Export shared group label constants

### Thread
- [x] 2026-08-14 [review] [agent] Approves · 1 finding — The core change to desk-section.tsx cleanly delivers the spec: the Desk wrapper gets its own overflow-y-auto scroller, the section shell renders immediately with a skeleton during load instead of returning null, and a missing desk config key now shows an explanatory empty state pointing at papercamp/config.json. The imports (groupLabelClassName, Skeleton) and the text-desk-text-muted token are consistent with existing shared.ts usage, so the change is correct and on-spec. The rest of the diff is corpus bookkeeping (idea archiving, phase stamps, index/run-order updates) unrelated to the code change.
- [x] 2026-08-14 [review] [agent] Approves · 0 findings — The core change to desk-section.tsx delivers the spec cleanly: the Desk wrapper gains its own overflow-y-auto scroller, the section shell (Divider + label) now renders immediately with an aria-hidden skeleton during load instead of returning null, and a missing desk config key shows an explanatory empty state pointing at papercamp/config.json. The Agent section and the fixed panel header are left untouched, matching the IDEA-109 constraint, and the new imports and text token follow existing shared.ts conventions. The remainder of the diff is unrelated corpus bookkeeping (archiving, phase stamps, index/run-order edits).
- [x] 2026-08-14 [review] [agent] Approves · 0 findings — The core change to desk-section.tsx cleanly delivers the spec: the Desk wrapper gains its own overflow-y-auto scroller so clipped content is reachable, the section shell (Divider + Desk label) renders immediately with an aria-hidden skeleton during load instead of returning null, and a missing desk config key now shows an explanatory empty state pointing at papercamp/config.json. The extracted group-label constants are wired consistently across the four group components, and the untouched Agent section respects the IDEA-109 reserved-height constraint. The remainder of the diff is unrelated corpus bookkeeping.
- [x] 2026-08-14 [review] [agent] Approves · 0 findings — The core change to desk-section.tsx delivers the spec: the Desk wrapper gains its own overflow-y-auto scroller with min-h-0 flex-1 flex-col so it scrolls independently within the panel, the section shell (Divider + Desk label) now renders immediately with an aria-hidden skeleton during load instead of returning null, and a missing desk config key shows an explanatory empty state pointing at papercamp/config.json. The exported group-label constants are wired consistently and the skeleton's GROUP_LABELS order matches the real render order. The Agent section and fixed panel header are untouched, honoring the IDEA-109 constraint, and the rest of the diff is unrelated corpus bookkeeping.
