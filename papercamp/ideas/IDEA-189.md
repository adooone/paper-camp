---
id: IDEA-189
title: Page texture fills the centre column
type: feat
status: review
created: 2026-08-17
updated: 2026-08-18
tags:
  - app
  - ui
  - layout
subject: App UI
---

The page texture runs the full height of the centre column, navigation included.
The left column stays grid paper. The header stops being one band across both.

### Today

`router.tsx` gives `Layout` `background={{ texture: 'speckle', ruledType: 'grid',
ruledColor: 'blue' }}` and `showHeader` with a `headerActions` slot holding
`ProjectIdentityHeader` plus the six nav buttons. That header is a single strip
spanning the whole viewport on grid paper, and the parchment `Page` starts
beneath it. So the centre column is grid at the top and parchment lower down,
and the seam runs straight across the layout.

### The split

**Left column — grid paper, top to bottom.** `ProjectIdentityHeader` (icon,
project name) moves out of the shared header and sits at the top of the sidebar
column, on the same speckled grid as the sidebar beneath it. One surface, no
seam.

**Centre column — parchment, top to bottom.** The `Page` sheet starts at the top
of the viewport rather than below a header, so the texture is continuous from
the first pixel to the bleed at the bottom ([[IDEA-186]] already put the bleed
there). Navigation becomes an island sitting **on** that parchment, top-right.

**Right column — unchanged.** The Stack keeps its chalkboard.

### The island already exists

paper-ui 0.16.0 exposes a **`navigationIsland`** slot on `Layout`, with its own
`island` style in the bundle. `router.tsx` does not use it — the nav is in
`headerActions` today. So this is a slot swap plus dropping `showHeader`, not new
component work, and `Island` does not need building.

Composing the two halves ourselves rather than through one `showHeader` band is
the actual restructuring: the shell stops being header-over-columns and becomes
three columns that each own their full height.

### Refactor the sidebar

It is the weakest surface on the Plans page and needs density and contrast, not
just relocation.

**Labels are the smallest and faintest thing available.**
`sectionLabelClass` is `text-2xs font-semibold tracking-[0.08em] uppercase
text-ink-300` — the smallest step in the type scale combined with the muted ink
token. Every section header (Show, Status, Subject, Order, Actions) uses it, so
nothing in the column has any hierarchy: the labels recede uniformly and the
controls float without grouping.

**Actions are invisible as actions.** `PlanActionsColumn` renders Run all, Fix
review, Review PR, Approve & close and Mark dropped as plain `ListItem`s,
visually identical to the read-only Status stamp and the Subject and Order
fields stacked above them. The one interactive block in the column looks exactly
like the static ones. Give Actions a distinct treatment — its own grouping and
enough weight that it reads as the thing you came to click.

**Denser overall.** Review every title and position: tighten the vertical
rhythm, and settle which sections deserve a label at all versus reading from
their content.

### Out of scope

The Stack panel, the page's own content, and the three-column widths
([[IDEA-186]]). This is the shell's surfaces and the sidebar's interior.

### Phases
- [x] Move ProjectIdentityHeader to the top of the sidebar column
      It renders on the same speckled grid as the sidebar beneath it, one surface.
      run: 2m17s · 5.9k in · 10.2k out · sonnet-5
- [x] Place paper-ui's Island component with our own top-right positioning
      Use paper-ui's Island component (not the navigationIsland slot, which is hardcoded to fixed bottom-center), but override its positioning in our app so it sits top-right on the parchment instead of paper-ui's default fixed bottom-center placement.
      run: verified with `pnpm run check-types` and `pnpm biome check` only (headless agent, no browser) — visual placement needs human confirmation.
      run: 4m10s · 15.9k in · 26.3k out · sonnet-5
- [x] Start the Page at the top of the centre column
      Parchment runs continuous from the first pixel to the existing bleed.
      run: no code change needed — dropping `showHeader` in the prior phase already removed the 48px header band, and the scroll container's existing padding-cancelling (`-mt-8`/`pt-0`, nothing re-adds top) plus `Page`'s own zero top margin mean it already renders flush from row 0. Verified by tracing the CSS cascade and `pnpm run check-types`; no browser available to confirm visually.
      run: 4m35s · 366 in · 21.9k out · sonnet-5
- [x] Give sidebar section labels real hierarchy
      Replace the uniform sectionLabelClass so headers step above the controls.
      run: bumped `sectionLabelClass` in `plan-actions-column.tsx` and `plan-filter-column.tsx` from `text-2xs`/`text-ink-300` (smaller than the `text-xs` control text below it, and washed-out) to `text-xs`/`text-ink-700` — labels now sit at or above the controls' size and read with real contrast. Left Roadmap's and Git's identical-looking labels untouched — out of this idea's Plans-page scope. Verified with `pnpm run check-types` and `pnpm biome check`; no browser available to confirm visually.
      run: 1m50s · 245 in · 7k out · sonnet-5
- [x] Set Actions apart as the interactive block
      Group and weight PlanActionsColumn so it no longer reads like the static stamps.
      run: wrapped the Actions list in paper-ui's `Card` (`size="small"`, default parchment texture) in `plan-actions-column.tsx` — its own bordered, textured surface distinct from the plain-list Show/Status/Subject/Order sections above it, so the interactive block reads as a raised block rather than another stack of `ListItem`s. Verified with `pnpm run check-types` and `pnpm biome check`; no browser available to confirm visually.
      run: 2m17s · 509 in · 9.1k out · sonnet-5
- [x] Tighten sidebar density and prune redundant labels
      Settle rhythm and which sections read from content without a label.
      run: in `plan-actions-column.tsx`, tightened the column rhythm (`gap-4`→`gap-3`, label `mb-1.5`→`mb-1`) and dropped the "Status" and "Actions" labels — the Stamp's own text already reads as a status, and the new Card (phase 5) already sets Actions apart visually, so both labels were pure duplication. Kept Show/Subject/Order, whose bare Select/Input/toggle values don't self-explain the field. Matched the same rhythm tightening (`gap-8`→`gap-3`, `mb-2`→`mb-1`) in `plan-filter-column.tsx` for a consistent density across both sidebar states; kept its "Status" label since a filter-chip list needs the context a lone value wouldn't. Verified with `pnpm run check-types` and `pnpm biome check`; no browser available to confirm visually.
      run: 2m37s · 4k in · 10.2k out · sonnet-5
- [x] [manual] Unify plan progress, cost, and status stamps on grid
- [x] [manual] Drop dead rgba fallback on texture-shade stamp

### Thread
- [x] 2026-08-17 [question] [agent] Run-all parked on phase 2 ("Swap nav into the navigationIsland slot and drop showHeader") — the agent needs a decision: The plan says the nav should become "an island sitting on that parchment, top-right," and asserts paper-ui's `navigationIsland` slot needs no new component work. But I checked the actual paper-ui source (`~/dev/paper-ui/src/components/layout/layout.tsx` and `island.module.scss`): `navigationIsland` renders in `.navIslandFixed` (`position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%)`), and `Island` itself is also hardcoded `position: fixed; bottom: 1.5rem; left: 50%`. It's a viewport-fixed bottom-center floating dock, not a top-right element anchored to the page — there's no built-in way to place it top-right without overriding paper-ui's own fixed positioning. Should I (a) use the slot as-is and accept a bottom-center floating nav dock instead of the top-right placement described in the idea, or (b) build a custom top-right-positioned nav element outside the `navigationIsland` slot to match the idea's stated design?
- [x] 2026-08-17 [chat] we should use separate island component from paper-ui and position it inside our app
- [x] 2026-08-17 [chat] [agent] Got it — swapping in a standalone island component we position ourselves, rather than the fixed bottom-center navigationIsland slot. I'll rework phase 2 to build a custom top-right nav island instead of using paper-ui's built-in slot.
- [x] 2026-08-17 [clarification] it should be island component from paper-ui but with our own positioning
- [x] 2026-08-17 [chat] [agent] Got it — Island stays a paper-ui component, we just override its positioning ourselves instead of using it via the fixed navigationIsland slot or building a fully custom one.
- [x] 2026-08-18 [review] [agent] Comments · 2 findings — The shell restructuring lands as specified: showHeader is dropped, the parchment now runs from the top of the centre column, ProjectIdentityHeader moves into the sidebar, and the nav becomes a top-right Island whose fixed positioning is overridden in-app — honoring the settled decision to use paper-ui's Island with our own positioning. The sidebar density, Card-wrapped Actions, and unified stamps are all present. Two things stand out: a hardcoded rgba fallback that runs against the only-paper-ui-colors rule, and the fact that an unrelated ideas/index.md removal is bundled into this UI PR.
