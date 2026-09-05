---
id: IDEA-238
title: Sidebar as a card on solid paper
type: feat
status: idea
created: 2026-09-05
tags:
  - app
  - ui
subject: App UI
order: 6
---

The project shell draws two surfaces where one would do. `app-shell.tsx`
wraps every route's content in paper-ui's `Page` — a raised, shaded sheet with
a left rule — and sets it beside a `SidebarShell` that is nothing but a
transparent 224px column, sticky, capped to the viewport by `--pc-sidebar-h`
and scrolling inside itself. Making that pairing look right costs
`utilities.css` four scoped overrides on `.pc-page`: a doubled selector to
outweigh paper-ui's own `.flat .surface`, a squared silhouette with the clip
path removed, a 2rem top inset the sidebar then mirrors with a blank `h-8`
spacer so the two first lines meet, and a `padding-right` of the Stack's width
so the sheet can pass under the panel while its content does not.

The one sidebar element that reads as finished is the actions card in
`plan-actions-column.tsx`: a small kraft `Card`, inset from the edges, as tall
as what it holds. Everything else in the column — the Plans filters above it,
the Docs, Settings, and Roadmap sidebars, the Git file list — sits directly on
the parchment with no edge of its own.

The card becomes the sidebar, and the sheet goes.

**One kraft card per sidebar.** `SidebarShell` renders its children inside a
single `Card size="small" texture="kraft"`, inset from the top and the sides
by the same gutter the actions card keeps today. Its height is its content's:
no `--pc-sidebar-h` cap, no inner scroll region. The card stays sticky at the
top while the content column scrolls; when the card is taller than the
viewport it scrolls with the page rather than inside itself. The `h-8`
alignment spacer is deleted, since there is no sheet inset left to match.

**Plans folds into that card.** `PlanFilterColumn` and `PlanActionsColumn`
render as two sections of the one card with a divider between them, and the
actions column drops the `Card` it wraps its buttons in today. Docs, Settings,
Roadmap, and the Git file list keep their sections and markup exactly as they
are; they only gain the card around them.

**The content sits on the paper.** The `Page` element and its `pc-page` class
are removed from `app-shell.tsx`; the breadcrumb and `Outlet` render straight
into the content column on the `Layout`'s paper background, with the same
2rem top inset as the card so the card's top edge and the page title share a
line. The four `.pc-page` rules in `utilities.css` are deleted with it. The
column keeps the Stack's width clear on the right the way the sheet's
`padding-right` did, so nothing runs under the panel.

**Phones are unchanged.** Below `lg` the drawer opens as it does now, with the
same backdrop, focus handling, and Escape; the card is simply the drawer's
content.

### Out of scope

The app bar, status bar, and Stack panel. Any change to what the sidebars
contain, how the Plans filters behave, or the Hub, which has its own shell.
The 480px bottom navigation.

### Phases
- [x] Wrap the sidebar in one kraft card
      `SidebarShell` renders its children inside the card, drops `--pc-sidebar-h`,
      the inner scroll region, and the `h-8` spacer.
      run: 6m36s · 58 in · 31.2k out · sonnet-5
- [x] Fold the Plans filters and actions into that card
      Two sections with a divider between them; `PlanActionsColumn` loses the `Card`
      it wraps its buttons in.
      run: 2m · 34 in · 7.1k out · sonnet-5
- [x] Drop the `Page` sheet from the app shell
      The breadcrumb and `Outlet` render into the content column, which keeps the
      2rem top inset and the Stack's width clear on the right.
      run: 4m31s · 32 in · 8.3k out · sonnet-5
- [ ] Delete the four `.pc-page` rules from `utilities.css`
- [ ] Check the drawer and each sidebar area
      Docs, Settings, Roadmap, and the Git file list in the card, and the mobile
      drawer's backdrop, focus, and Escape below `lg`.
