---
id: IDEA-40
title: Deep-linkable routes and breadcrumbs
---

## IDEA-40: Deep-linkable routes and breadcrumbs

Opening FEAT-28 doesn't change the URL: plan/idea/doc sub-views are store state (`activePlanTitle` & co. in `app-store.ts`, multiplexed in `plans-page.tsx`), so refresh loses your place, the browser back button exits the app instead of going back a level, and nothing is shareable. Three wayfinding systems coexist: global nav, sidebar lists, and hand-rolled "← All plans" buttons.

- **Sub-views become routes.** `/plans/FEAT-28`, `/ideas/IDEA-16`, `/docs/readme` via TanStack Router params in `router.tsx`; selection navigates, active highlighting derives from the URL, and "← All plans" becomes a real link — or a `Breadcrumb` (after [[IDEA-32]]): Plans / FEAT-28.
- **Plans and Review merge.** Review is a status filter, not a place: fold `/review` into the Plans route as a `Tabs` row (List | Board | Review | Closed — `Tabs` already exists in 0.2.0), shrinking global nav to Plans / Docs / Settings.
- **Docs lands on content.** Default `/docs` to the README instead of "Select a section from the sidebar", and give doc sections a route segment so the Stack's consistency-finding links survive reloads.
- **Store cleanup falls out.** `activePlanTitle` / `activeIdeaTitle` / `activeDocSection` become derived-from-URL instead of imperative globals, removing the pathname-reset effect in `router.tsx`.

Mostly independent of the paper-ui bump (only `Breadcrumb` needs [[IDEA-32]]). Coordinates with [[IDEA-39]]'s review queue on who owns the `/review` merge.
