---
id: IDEA-186
title: Use the whole width
type: feat
status: review
created: 2026-08-17
updated: 2026-08-17
tags:
  - app
  - ui
  - layout
subject: App UI
---

The shell wastes horizontal space at every width below 1440px, and the page stops
short of the bottom edge instead of running under it.

### The good layout already exists — it is gated

`router.tsx`'s `isLarge` (`min-width: 1440px`) switches three things at once:

- the content column becomes `flex-[1_1_0%]` instead of `flex-[0_1_800px]`
- `Page` gains `max-w-none`, dropping the 800px cap
- the root reserves the panel's width with `min-[1440px]:pr-[480px]`, so the
  Stack docks instead of overlaying

Above 1440 that is exactly the wanted layout. Below it, everything inverts:
the page is capped and centred, and the Stack becomes an overlay.

Measured at a 1200px viewport:

| band | px | |
|----|----|----|
| left margin | 0 – 75 | unused |
| sidebar | 75 – 300 | |
| gap | 300 – 325 | unused |
| page | 325 – 1125 | capped at 800 |
| right margin | 1125 – 1200 | unused |

The header spans the full 0 – 1200 across all of it, so it visibly fails to line
up with the sheet beneath — the misalignment is the cap, not the header.

There is room for the docked layout at this width: sidebar 225 + Stack 480
leaves ~495 for the page.

### Fill the width

Sidebar left, page centre, Stack right, edge to edge, with no centring gutters
and no 800px cap. The three-column shell becomes the default rather than a
large-screen reward.

Lower the breakpoint to where three columns genuinely fit rather than deleting
it — the drawer behaviour still has to survive narrow widths. Derive the
threshold from the real minimum page width instead of picking a round number:
sidebar + minimum readable page + Stack. By the arithmetic above that lands near
1200, which is exactly the width this was reported at.

`max-w-none` and `flex-[1_1_0%]` stop being conditional. The `800px` basis goes.

### Let the page run under the bottom edge

Only the content scrolls — that invariant holds today and is guarded by
`chrome-outside-scroll.guard.test.ts`. What is missing is the visual cue: the
sheet ends above the fold with padding beneath it, so a short page looks
finished and a long one gives no hint that more follows.

The sheet should bleed past the bottom of the viewport at any content height, so
there is always the suggestion of something below. `Layout` already receives
`bleedBottom`; the two knobs that fight it are `Page`'s
`min-h-[calc(100vh-160px)]` and the scroller's
`pb-[var(--pc-content-pad-bottom,32px)]`. Keep the phone-breakpoint bottom
padding — it clears the fixed bottom nav and is load-bearing there.

### Out of scope

The Stack panel's own internals ([[IDEA-163]]), the nav island, and what the
sidebar contains per route. This is the shell's column geometry only.

### Phases
- [x] Derive the three-column breakpoint from real widths
      sidebar + minimum readable page + Stack, landing near 1200 — a named
      constant, not a round number.
      run: 2m7s · 6.8k in · 8.6k out · sonnet-5
- [x] Lower `isLarge` to that threshold in `router.tsx`
      run: 46s · 238 in · 1.9k out · sonnet-5
- [x] Make the docked three-column layout unconditional
      Drop the `flex-[0_1_800px]` basis and un-gate `max-w-none` and
      `flex-[1_1_0%]`; keep the narrow-width drawer fallback.
      run: 40s · 355 in · 2k out · sonnet-5
- [x] Bleed the sheet past the bottom edge
      Relax `Page`'s `min-h-[calc(100vh-160px)]` and the scroller's
      `pb` so short and long pages both run under the fold, preserving the
      phone-breakpoint bottom padding.
      run: 2m36s · 388 in · 11.5k out · sonnet-5
- [x] Confirm the scroll and alignment guards still pass
      run: 2m15s · 362 in · 1.5k out · sonnet-5
