---
id: IDEA-46
title: Build dashboard app
type: feat
status: done
created: 2026-06-18
updated: 2026-06-19
tags:
  - app
  - paper-ui
---

Built the local dashboard SPA — the Layout shell, a dev-time API serving the papercamp/ files as JSON, and the first Plans/Focus/Settings views.

### Phases
- [x] Dev-time API middleware endpoints
      Dev-time API middleware (/api/plans, /api/progress, /api/decisions, /api/open-questions, /api/config)
- [x] Router and layout shell
      Router + Layout shell with nav items
- [x] Plans page with real data
      Plans page reading real data from papercamp/plans.md
- [x] Settings page reads config
      Settings page reading .paper-camp/config.json
- [x] Wire dev CLI to built app
      Wire `paper-camp dev` (CLI) to serve a built dist/app
- [x] Drop placeholders, add bottom nav
      Drop Dashboard/Projects placeholder pages; switch nav to bottom NavigationIsland
- [x] Focus mode with phase toggling
      Focus mode with phase toggling and mark-complete
- [x] Integrate paper-ui components
      Integrate paper-ui components throughout (Button, Card, Checkbox, Stamp, Progress, Textarea, ListItem, IconButton, Input, Modal, Alert)
- [x] Add blob backgrounds to wide elements
      Add rectangular blob backgrounds to paper-ui ListItem/Button for wide elements
- [x] Simplify PlansSidebar route rendering
      Simplify PlansSidebar conditional rendering — only show on Plans route (done)
- [x] Add NavItem and ListItem showcase
      Add NavItem/ListItem to paper-ui showcase (done)
- [x] Clean up multi-project vestiges
      Clean up multi-project vestiges from data model and docs (done — single project only)
- [x] Add AI focus handoff prompt
      Add AI focus handoff — one-line copy-prompt per phase with plan title and phase number
- [x] Show ideas.md on Plans page
      Show ideas.md content in Plans page — collapsible "Ideas" section
