---
id: IDEA-34
title: Responsive layout and Stack panel redesign
type: feat
status: done
created: 2026-07-01
updated: 2026-07-02
tags:
  - app
  - ui
  - layout
  - navigation
  - stack
  - paper-ui
  - responsive
---

The responsive layout redesign: global navigation moved into the Layout header (floating island removed), breakpoints added, and the Stack panel reworked.

### Phases
- [x] Add responsive breakpoints to the root layout
      In router.tsx / the shared paper-ui Layout, stop reserving a fixed paddingRight for the Stack panel (`layoutConfig.stackPanelWidth`, 480px, applied at router.tsx:93 whenever `stackOpen`) — let it overlay content instead of pushing it, below a defined breakpoint (e.g. <1440px). Make the content column flex: 1 with a flexible max-width instead of the current stack of fixed widths (paper-ui `Page` caps content at max-width 800px, sidebar holds 220px) that stops fitting at common window sizes. Below ~1024px, collapse the sidebar into paper-ui Layout's existing mobile sidebar mechanics (`mobileOpen` toggle + overlay in layout.tsx, currently unused by paper-camp) rather than a fixed 220px column.
- [x] Move global navigation into a Layout header and remove the nav island
      Replace the hand-rolled floating <Island> composition in router.tsx with paper-ui Layout's built-in header (showHeader): project identity in the logo/title slot on the left, the nav buttons as headerActions (same ghost Buttons with isActive as today — Layout's navigationItems prop renders into its sidebar, not the header, so the buttons stay hand-composed). Remove the navigationIsland slot usage and its stack-open x-shift animation. Move the Docs search input into the Docs page's own sidebar, since it only applies to one route. Give the Stack panel a top offset equal to the header height (its position: fixed currently starts at top: 0) so the panel slides in under the header instead of covering it. Note: this reverses the 2026-06-19 decision "Docs search lives in the nav island as a page-specific tool" — when this phase lands, add a superseding entry to decisions.md (and mark the old one superseded) so the record stays consistent.
- [x] Remove island clearance hacks
      Drop the nav-island bottom padding from the Page style in router.tsx (the navIslandBottom + navIslandHeight calc) and any other island clearance workarounds once the header lands. Verify the Plans sidebar list and the plan-detail phases table — both previously overlapped by the island — now render to the true bottom of the viewport.
- [x] Default the Stack panel to closed and persist the choice
      Change the RootLayout's stackOpen useState(true) in router.tsx to a localStorage-backed value defaulting to false. Nothing in the panel is populated on load; it should be opened on demand rather than reserving 480px of width from first paint, and the user's open/closed choice should survive reloads instead of resetting.
- [x] Redesign the Stack panel Commit section with a bounded scroll region
      Restructure stack-panel.tsx's Commit card so the changed-files Accordion scrolls within a bounded height and the commit title/message/Commit button sit in a non-scrolling footer that stays reachable regardless of file count. Replace the fixed flex: 2/1/2 ratios across Agent/Status/Commit with sizing driven by actual content.
- [x] Simplify the Agent card to a title and one status line
      Replace the full agentStatus.lines scrolling log in the Agent card with just the latest line next to the title; move the full log behind an Accordion (consistent with the Commit section) for anyone who wants to expand it.
- [x] Give the collapsed Stack rail a live status signal
      When the panel is closed, the rail should show state, not the letter "S": a spinner/accent color while an agent is running, a red indicator when Quality/Tests fail or Consistency has findings. In the Status card, make the Quality/Tests/Consistency stamps look like the buttons they are (hover/pressed affordance, or explicit run buttons next to passive status stamps) — clicking them currently launches check runs with no visual hint that they're interactive.
- [x] Make the board view usable at narrow widths
      Give board lanes a min-width with overflow-x: auto and a visible scrollbar on the lane container so partial lanes don't silently hide; below the sidebar-collapse breakpoint, stack lanes vertically instead of panning.
- [x] Fix sidebar truncation (identity header and plan items)
      Add overflow: hidden and text-overflow: ellipsis (with a matching min-width: 0 on its flex container) to project-identity-header.tsx so long project names truncate with an ellipsis instead of being hard-clipped mid-word by the sidebar edge. Let sidebar plan items in plan-nav-item.tsx wrap to two lines or ellipsize with a title tooltip, so items stay identifiable next to their mini progress bars at narrow widths.
- [x] Visual verification pass across viewport widths
      Re-run the same Chrome visual check that surfaced these issues (deimos:3333) at ~1600px, ~1024px, and ~834px widths, plus the Stack panel with 10+ changed files and an active agent run, the collapsed rail during a run and with failing checks, and the board view at each width, to confirm no regressions from the earlier findings.
