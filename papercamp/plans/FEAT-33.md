---
id: FEAT-33
title: Responsive layout and Stack panel redesign
kind: feat
status: planned
created: 2026-07-01
idea: IDEA-34
tags:
  - app
  - ui
  - layout
  - navigation
  - stack
  - paper-ui
  - responsive
---

A design review of the running app (visual pass across desktop/laptop/tablet widths in Chrome at deimos:3333, plus a read of `router.tsx`, `stack-panel.tsx`, and the shared `paper-ui` `Layout`/`NavigationIsland` components) found the current three-column layout, floating nav island, and Stack panel don't scale down and actively obscure content at common window widths. This plan fixes the layout system, navigation, and Stack panel ahead of the [[IDEA-32]]/[[IDEA-33]] paper-ui migration, so that migration can build on the real `NavigationIsland`/`Accordion`/`Divider` components instead of reworking hand-rolled equivalents twice.

Sequencing: land after [[IDEA-32]]'s mechanical 0.2→0.5 bump, before the rest of [[IDEA-33]]'s opportunistic component swaps.

### Findings addressed
1. No responsive breakpoints — layout breaks below ~1900px, unusable below ~1024px.
2. Nav island overlaps sidebar list content and the plan-detail phases table; resizes per-route.
3. Stack panel's Commit section can push its own Commit button off-screen with enough changed files.
4. Agent card renders a full scrolling log instead of a scannable summary.
5. `ProjectIdentityHeader` is duplicated (sidebar + nav island) and truncates without an ellipsis.
6. Stack panel defaults to open, permanently reserving 480px even when empty.

### Phases
- [ ] Add responsive breakpoints to the root layout
      In router.tsx / the shared paper-ui Layout, stop reserving a fixed paddingRight for the Stack panel (`layoutConfig.stackPanelWidth`, 480px, applied at router.tsx:93 whenever `stackOpen`) — let it overlay content instead of pushing it, below a defined breakpoint (e.g. <1440px). Make the content column flex: 1 with a flexible max-width instead of the current stack of fixed widths (paper-ui `Page` caps content at max-width 800px, sidebar holds 220px) that stops fitting at common window sizes. Below ~1024px, collapse the sidebar into paper-ui Layout's existing mobile sidebar mechanics (`mobileOpen` toggle + overlay in layout.tsx, currently unused by paper-camp) rather than a fixed 220px column.
- [ ] Adopt paper-ui NavigationIsland and drop the duplicate identity/search
      Replace the hand-rolled <Island> composition in router.tsx with paper-ui's real NavigationIsland (nav pills only). Remove ProjectIdentityHeader from the island — it stays in the sidebar only. Move the Docs search input out of the nav island into the Docs page's own sidebar/header, since it only applies to one route. Note: this reverses the 2026-06-19 decision "Docs search lives in the nav island as a page-specific tool" — when this phase lands, add a superseding entry to decisions.md (and mark the old one superseded) so the record stays consistent.
- [ ] Fix bottom padding so the nav island never overlaps content
      Apply the nav-island-height bottom padding consistently to every scrollable column that can sit under the fixed island (SidebarShell lists, not just the main Page), or switch the island to position="top" to remove the problem at its root. Verify visually on the Plans sidebar list and the plan-detail phases table, both of which were observed overlapped.
- [ ] Default the Stack panel to closed
      Change the RootLayout's stackOpen useState(true) to false in router.tsx. Nothing in the panel is populated on load; it should be opened on demand rather than reserving 480px of width from first paint.
- [ ] Redesign the Stack panel Commit section with a bounded scroll region
      Restructure stack-panel.tsx's Commit card so the changed-files Accordion scrolls within a bounded height and the commit title/message/Commit button sit in a non-scrolling footer that stays reachable regardless of file count. Replace the fixed flex: 2/1/2 ratios across Agent/Status/Commit with sizing driven by actual content.
- [ ] Simplify the Agent card to a title and one status line
      Replace the full agentStatus.lines scrolling log in the Agent card with just the latest line next to the title; move the full log behind an Accordion (consistent with the Commit section) for anyone who wants to expand it.
- [ ] Fix ProjectIdentityHeader truncation
      Add overflow: hidden and text-overflow: ellipsis (with a matching min-width: 0 on its flex container) to project-identity-header.tsx so long project names truncate with an ellipsis instead of being hard-clipped mid-word by the sidebar edge.
- [ ] Visual verification pass across viewport widths
      Re-run the same Chrome visual check that surfaced these issues (deimos:3333) at ~1600px, ~1024px, and ~834px widths, plus the Stack panel with 10+ changed files and an active agent run, to confirm no regressions from the earlier findings.
