---
id: IDEA-155
title: Only the page container scrolls
type: fix
status: review
created: 2026-08-11
tags:
  - app
  - ui
  - layout
subject: App UI
---

The outer chrome (`router.tsx`'s root layout) is already close to this —
`h-screen` on the root, `overflow-y-auto` only on the inner content div
(`router.tsx:272`) — but that inner div is a hand-rolled scroll
container, not paper-ui's `Page` (used here purely as a visual sheet,
`showPage={false}`). It never got the `scrollbar-gutter: stable` fix
[[IDEA-146]]'s row-click investigation added to paper-ui's own `Page`
surface — so switching between a short list page and a tall idea-detail
page can still pop the scrollbar in and out, shifting content width.
Two settled fixes:

1. **`scrollbar-gutter: stable` on the app's real scroll container**
   (`router.tsx:272`), not just inside paper-ui's `Page` — this app
   doesn't route scrolling through `Page` at all, so the earlier fix
   never reached it. Header, toolbar, and sidebar chrome stay outside
   this container and never scroll, as they already don't today — this
   codifies that as an explicit invariant, not just current behavior.

2. **Desktop drops its bottom padding.** `--pc-content-pad-bottom`
   (32px on desktop, `utilities.css`) reserves space purely for visual
   symmetry with the top — nothing sits below the content to clear.
   Content runs to the container's real end instead of stopping short.
   The mobile value (96px) stays exactly as-is — it clears the fixed
   bottom nav bar (`router.tsx:350-353`) that replaces the header nav
   at phone widths, and removing it would hide content behind that bar.

### Phases
- [x] Add `scrollbar-gutter: stable` to the content scroll container
      Set it on the `overflow-y-auto` div at `router.tsx:272`.
      run: 32s · 5.6k in · 1.1k out · sonnet-5
- [x] Zero the desktop `--pc-content-pad-bottom`, leave the mobile 96px value
      Edit only the desktop declaration in `utilities.css`.
      run: 21s · 239 in · 921 out · sonnet-5
- [x] Confirm header, toolbar, and sidebar chrome stay outside the scroll container
      Codify the no-chrome-scrolls invariant against the current layout.
      run: 1m59s · 392 in · 8.2k out · sonnet-5

### Thread
- [x] 2026-08-11 [decision] Bottom-padding removal is desktop-only — mobile's reserve is load-bearing (clears the fixed bottom nav), not decorative, and stays untouched.
