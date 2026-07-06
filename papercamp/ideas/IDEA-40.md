---
id: IDEA-40
title: Make sub-views real routes
type: feat
status: review
created: 2026-07-04
updated: 2026-07-06
tags:
  - app
  - ui
  - routing
  - navigation
---

Opening FEAT-28 doesn't change the URL: plan/idea/doc sub-views are store state (`activePlanTitle` & co. in `app-store.ts`, multiplexed in `plans-page.tsx`), so refresh loses your place, the browser back button exits the app instead of going back a level, and nothing is shareable. Three wayfinding systems coexist: global nav, sidebar lists, and hand-rolled "← All plans" buttons.

- **Sub-views become routes.** `/plans/FEAT-28`, `/ideas/IDEA-16`, `/docs/readme` via TanStack Router params in `router.tsx`; selection navigates, active highlighting derives from the URL, and "← All plans" becomes a real link — or a `Breadcrumb` (in the package since the [[IDEA-32]] bump): Plans / FEAT-28.
- **Plans and Review merge.** Review is a status filter, not a place: fold `/review` into the Plans route as a `Tabs` row (List | Board | Review | Closed — `Tabs` is already in the package), shrinking the header nav to Plans / Docs / Settings.
- **Docs lands on content.** Default `/docs` to the README instead of "Select a section from the sidebar", and give doc sections a route segment so the Stack's consistency-finding links survive reloads.
- **Store cleanup falls out.** `activePlanTitle` / `activeIdeaTitle` / `activeDocSection` become derived-from-URL instead of imperative globals, removing the pathname-reset effect in `router.tsx`.

No paper-ui dependency left — the [[IDEA-32]] bump landed `Breadcrumb`. Coordinates with [[IDEA-39]]'s review queue on who owns the `/review` merge.

Opening a plan doesn't change the URL: plan/idea/doc sub-views are store state
(`activePlanTitle` & co. in `app-store.ts`, multiplexed in `plans-page.tsx`), so a
refresh loses your place, the browser back button exits the app instead of going up a
level, and nothing is shareable — while three wayfinding systems coexist (global nav,
sidebar lists, and hand-rolled "← All plans" buttons). This plan makes the URL the
source of truth: `/plans/FEAT-28`, `/ideas/IDEA-16`, and `/docs/readme` become TanStack
Router param routes in `router.tsx`, selection navigates and active highlighting
derives from the route, and the back buttons become a real paper-ui `Breadcrumb`
(Plans / FEAT-28 — in the package since the [[IDEA-32]] bump). Review stops being a
place: `/review` folds into the Plans route as a `Tabs` row (List | Board | Review |
Closed — `Tabs` is already in the package), dropping Review from the header nav; and
`/docs` lands on the README instead of "Select a section from the sidebar", with doc
sections getting a route segment so the Stack's consistency-finding links survive
reloads.

The store cleanup falls out rather than being a separate migration:
`activePlanTitle` / `activeIdeaTitle` / `activeDocSection` become derived-from-URL
values instead of imperative globals, which removes the pathname-reset effect in
`router.tsx`. Scope boundaries: this plan owns the route-level `/review` merge, while
the inline needs-review queue on the Plans landing is [[FEAT-39]]'s — the two plans'
coordination notes agree on that split. The Ideas nav item [[FEAT-37]] added stays;
whether `/ideas` later merges back into one worklist is [[IDEA-43]]'s question, and
per-item param routes work the same either way. Nothing blocks this — no paper-ui
dependency is left since the [[IDEA-32]] bump landed `Breadcrumb`.

### Phases
- [x] Add param routes for plans, ideas, and docs
      Define `/plans/$planId`, `/ideas/$ideaId`, and `/docs/$section` as TanStack
      Router param routes in `router.tsx`; clicking a plan, idea, or doc section
      navigates to its route instead of setting store state.
- [x] Derive selection state from the URL
      Replace the `activePlanTitle`/`activeIdeaTitle`/`activeDocSection` globals in
      `app-store.ts` with values derived from route params (active highlighting and
      detail rendering included), and drop the pathname-reset effect in `router.tsx`.
- [x] Replace back buttons with Breadcrumb
      Swap the hand-rolled "← All plans" (and idea/doc equivalents) for paper-ui
      `Breadcrumb` links — Plans / FEAT-28 — on the plan, idea, and doc detail views.
- [x] Fold Review into the Plans route
      Render List | Board | Review | Closed as a `Tabs` row on the Plans page, retire
      the standalone `/review` page, and drop Review from the header nav (keeping
      [[FEAT-39]]'s inline queue untouched).
- [x] Land Docs on the README
      Default `/docs` to the readme section instead of the "Select a section from the
      sidebar" placeholder.
- [x] Type-check and visual pass
      `tsc --noEmit`, `biome check`, tests, and a browser pass over deep links,
      refresh, back-button behavior, and the merged Plans tabs.
