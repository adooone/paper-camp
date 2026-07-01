---
id: IDEA-34
title: Responsive layout and Stack panel redesign
---

## IDEA-34: Responsive layout and Stack panel redesign

Ahead of the [[IDEA-32]] / [[IDEA-33]] paper-ui migration, a live design review of the running app (deimos:3333, at several viewport widths) turned up structural UX and scalability problems worth fixing as their own pass rather than folding into the version bump:

- **Layout has no responsive behavior.** The three-column layout (sidebar 220px + content max-w-layout 1044px + Stack panel 480px) is entirely fixed-pixel with no breakpoints. Below ~1900px window width the content column visibly squeezes; below ~1024px it collapses into an unreadable sliver. This is the root scalability problem.
- **The floating nav island overlaps real content.** Only the main `Page` column reserves bottom padding for the fixed-position island; the sidebar's scrollable lists and the plan-detail phases table do not, so list items and table rows render underneath the translucent bar. The island also resizes per-route (it grows a search input only on `/docs`), causing a visible jump on every navigation.
- **Stack panel Commit section can lose its own submit button.** The panel's Agent/Status/Commit sections use fixed flex ratios regardless of content. With enough changed files, the file-accordion pushes the commit title/message/Commit button out of the fixed-height section with no way to reach them.
- **Agent card is a raw log dump** — every line of agent output renders in a scrolling monospace block, the busiest and least scannable thing in the panel, when a title + one live status line would do.
- **Project identity is duplicated and truncates badly.** `ProjectIdentityHeader` renders both in the sidebar and again inside the nav island with no clear reason for both, and its `white-space: nowrap` with no overflow/ellipsis handling means long project names get hard-clipped mid-word.
- **The Stack panel is open by default**, permanently reserving 480px of width even before there's anything in it, compounding the squeeze on smaller screens.

paper-ui 0.5.0 already ships a dedicated `NavigationIsland` component (nav-pills only, positionable `top`/`bottom`) that paper-camp's hand-rolled nav bar should adopt instead of composing its own — see [[IDEA-33]]'s note on this. It doesn't solve the overlap/responsiveness problems by itself, so this idea covers the layout and panel work those component swaps depend on.
