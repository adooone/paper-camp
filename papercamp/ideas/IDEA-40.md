---
id: IDEA-40
title: Deep-linkable routes and breadcrumbs
---

## IDEA-40: Deep-linkable routes and breadcrumbs

Opening FEAT-28 doesn't change the URL: plan/idea/doc sub-views are store state (`activePlanTitle` & co. in `app-store.ts`, multiplexed in `plans-page.tsx`), so refresh loses your place, the browser back button exits the app instead of going back a level, and nothing is shareable. Three wayfinding systems coexist: global nav, sidebar lists, and hand-rolled "← All plans" buttons.

- **Sub-views become routes.** `/plans/FEAT-28`, `/ideas/IDEA-16`, `/docs/readme` via TanStack Router params in `router.tsx`; selection navigates, active highlighting derives from the URL, and "← All plans" becomes a real link — or a `Breadcrumb` (in the package since the [[IDEA-32]] bump): Plans / FEAT-28.
- **Plans and Review merge.** Review is a status filter, not a place: fold `/review` into the Plans route as a `Tabs` row (List | Board | Review | Closed — `Tabs` is already in the package), shrinking the header nav to Plans / Docs / Settings.
- **Docs lands on content.** Default `/docs` to the README instead of "Select a section from the sidebar", and give doc sections a route segment so the Stack's consistency-finding links survive reloads.
- **Store cleanup falls out.** `activePlanTitle` / `activeIdeaTitle` / `activeDocSection` become derived-from-URL instead of imperative globals, removing the pathname-reset effect in `router.tsx`.

No paper-ui dependency left — the [[IDEA-32]] bump landed `Breadcrumb`. Coordinates with [[IDEA-39]]'s review queue on who owns the `/review` merge.
