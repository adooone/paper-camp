---
id: IDEA-189
title: Page texture fills the centre column
type: feat
status: idea
created: 2026-08-17
updated: 2026-08-17
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
