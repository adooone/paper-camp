---
id: IDEA-140
title: Bottom-center island
type: feat
status: done
created: 2026-08-06
updated: 2026-08-07
tags:
  - integration
  - app
  - ux
  - motion
subject: In-app dev toolbar
---

Owner pivot from the top full-width bar ([[IDEA-133]] / [[IDEA-138]] phase 1):
the embed becomes an **island at the bottom center** of the host app.

Shape:

- **Hidden by default.** The only permanent affordance is a small
  bottom-center trigger bearing the paper-camp logo — minimal footprint,
  floating, never in the way.
- **Hover reveals the island** with a polished animation — the island grows
  out of the trigger (spring/expand feel worth prototyping) into a floating
  card holding the glance info and quick actions: branch + changed count,
  focus/phase, check stamps, and the action set (sync/push/commit, capture,
  chat, open desk — final split per the [[IDEA-138]] overflow decision).
- **Floating overlay, zero layout space.** Because it's hidden by default,
  overlay is acceptable — it only covers the app while in use. This
  dissolves the height problem the in-flow bar had: no push, no vh
  mismatch, no iframe harness needed for the default experience (the
  harness question stays parked on [[IDEA-138]] should a persistent mode
  ever return).
- Full circle, deliberately: [[IDEA-128]] originally specced a bottom-docked
  bar collapsing to an idle pill. The island is that concept matured —
  branded trigger instead of a pill, reveal animation instead of a static
  collapse, richer content instead of glance labels.

Interaction notes for the plan (not decided, flagged):

- Hover-only reveal is mouse-specific — the trigger needs click/tap for
  touch and focus/Enter for keyboard; hover-intent delay so it doesn't
  flash open on drive-by cursor passes.
- The island should pin while the pointer is inside it or a panel/menu is
  open, and dismiss on outside-click / Escape / pointer-leave with a grace
  period.

The Stack-style chat sidebar ([[IDEA-138]] phases 2–5) is expected to stay
as the deep surface, opened *from* the island's chat action — island for
glance + quick verbs, sidebar for chat and anything content-bearing.

**UI**

Built on paper-ui's existing `Island` component (`surface="paper"`), so the
embed inherits the library's card language instead of inventing chrome. Two
lines, mirroring the StatusBar charter — glance above, verbs below:

1. **State line (read-only):** branch name (mono, middle-truncated for long
   plan branches) + changed count and ahead marker, with check status as a
   compact stamp/pill on the right.
2. **Action line:** the verbs inline — Sync, Push, Commit, Capture, Chat,
   Desk. Because the island is revealed on demand, the [[IDEA-138]]
   overflow dropdown is likely unnecessary here — all verbs fit; overflow
   only returns if the list grows.

Optional slim footer when a plan is active: focus glance
(`IDEA-3 · phase 2/8 running`).

Surface split on purpose: island = `paper`, chat sidebar = `chalkboard` —
the quick surface and the deep surface stay visually distinct, and the
chalkboard remains the signature of the big thinking space.

Reveal animation: the island grows out of the trigger
(transform-origin at the bottom center, spring/overshoot feel), trigger
morphs into/behind the card rather than coexisting with it.

### Phases
- [x] Add the bottom-center logo trigger
      A floating, always-present affordance that overlays the host app with zero layout space.
- [x] Wire reveal and dismiss interaction
      Hover-intent delay, click/tap, and focus/Enter to open; pin while pointer is inside or a menu is open; dismiss on outside-click, Escape, or pointer-leave with a grace period.
- [x] Assemble the Island card on `surface="paper"`
      State line (branch, changed count, ahead marker, check stamp) above the action line, with the optional focus footer when a plan is active.
- [x] Wire the action verbs
      Sync, Push, Commit, Capture, Desk inline; Chat opens the IDEA-138 chalkboard sidebar.
- [x] Build the grow-from-trigger reveal animation
      Transform-origin at bottom center with a spring/overshoot feel; trigger morphs into the card rather than coexisting.
- [x] Swap the top full-width bar mount for the island overlay

### Thread
- [ ] 2026-08-06 [question] [agent] Confirm the split: island = glance info + quick actions, Stack-style chat sidebar (IDEA-138) stays as the deep surface opened from the island — or should the island itself grow into the chat surface?
- [x] 2026-08-06 [decision] Island layout: built on paper-ui's `Island` component; branch name (with counters/checks) on the top line, action row beneath. Agent addenda accepted into the spec: on-demand reveal makes the overflow dropdown unnecessary unless the verb list grows; paper surface for the island vs chalkboard for the sidebar.
