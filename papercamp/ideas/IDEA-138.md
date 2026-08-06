---
id: IDEA-138
title: Single-bar toolbar with a Stack-style chat sidebar
type: feat
status: idea
created: 2026-08-06
tags:
  - integration
  - app
  - ux
  - chat
subject: In-app dev toolbar
---

Owner review feedback on the shipped [[IDEA-133]] toolbar (v0.15.0, seen live
in func-ui): the overall feel is right — top, full-width, in layout — but the
UI shape isn't. Three directions:

1. **One bar, not two.** The strip and the action row collapse into a single
   bar — there's enough width for the current actions inline. Everything
   that doesn't earn a permanent spot moves into a **dropdown on the bar**
   (an overflow menu), not a second row.

2. **No more small popups.** The downward panels under each segment are the
   wrong interaction for anything content-bearing. Actions that need space —
   chat, idea capture — open a **slide-in side panel styled like the desk's
   Stack panel**: the dark chalkboard surface with card sections (the
   Stack/Agent/Deliver column on the desk is the reference).

3. **Chat-first sidebar.** Since Scout chat is a full surface
   ([[IDEA-130]]: capture is a chat capability, questions fold in, replies
   resume runs), the sidebar should essentially *be* the chat — the owner's
   words: "we can do everything directly in chat". Layout: most of the
   panel's space for the chat thread; card sections around it for links and
   glance data (branch/checks, focus, open-desk and other deep links).
   Dedicated capture UI dissolves into chat once capture-by-chat works;
   until then it can live as a card.

Supersedes the popup/panel interaction model from [[IDEA-133]] (bar position,
layout, and always-visible behaviour stay). The desk-only write-safety
boundary from [[IDEA-128]] still holds — the sidebar's chat writes through
guarded corpus paths, no structural operations from the embed.

### Thread
- [ ] 2026-08-06 [question] [agent] Height handling: the in-flow bar pushes the host app down, but child `100vh`/`100dvh` layouts still measure the full window — full-viewport apps (e.g. the func-ui showcase) overflow by the bar height, and no CSS can redefine vh for a subtree from outside. Options: (a) accept the push — fine for scrolling apps, breaks full-viewport ones; (b) iframe harness — the plugin serves a shell page (toolbar + same-origin iframe at `calc(100dvh − bar)` loading the real app) so the child's vh measures the remaining space, zero child changes, cost is URL/history + title sync and `window.top` edge cases; (c) both behind `integration.toolbar.mode: 'frame' | 'flow'`. Agent recommends (c) with frame as the full-viewport answer — owner to confirm the mode split and default.

### Phases
- [x] Collapse the toolbar into one bar with an overflow dropdown
      Inline the actions that earn a permanent spot; move the rest into a single bar-mounted overflow menu, dropping the second action row.
- [ ] Replace the downward popups with a Stack-styled slide-in side panel
      Reuse the desk Stack panel's chalkboard surface and card-section layout for the space-needing actions.
- [ ] Make the chat thread the sidebar's primary surface
      Give most of the panel to the Scout chat thread, with the surrounding cards sized around it.
- [ ] Add the glance/deep-link cards around the thread
      Branch/checks, focus, open-desk and other deep links as card sections beside the chat.
- [ ] Keep capture as a card until capture-by-chat lands
      Hold a dedicated capture card that dissolves once chat capture works.
- [ ] Enforce the desk-only write-safety boundary and run the checks
      Confirm chat writes route through guarded corpus paths, then type-check and test.
