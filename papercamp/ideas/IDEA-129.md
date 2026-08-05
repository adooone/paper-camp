---
id: IDEA-129
title: Isolate the StatusBar — store-free core, ready for a second mount
type: refactor
status: planned
created: 2026-08-05
tags:
  - app
  - integration
---

Prerequisite for the in-app dev toolbar ([[IDEA-128]]): the desk's StatusBar (`src/app/components/shell/status-bar.tsx`) is welded to the desk — paper-ui components, `useAppStore` selectors, desk-local styling. To mount it inside a target application it needs a clean seam: a presentation core that doesn't know about the desk, fed by a thin client over the server API.

Isolation is worth doing even before the toolbar ships: it makes the StatusBar testable on its own and forces the "what data does ambient status actually need" question into one typed interface.

### Phases
- [ ] Inventory the StatusBar's dependencies
      List every paper-ui import, `useAppStore` selector, and API call it leans on; decide per item whether it moves into the core, becomes a prop, or stays desk-side.
- [ ] Extract a store-free StatusBar core
      Presentation component taking data + action callbacks as a typed interface — no `useAppStore`, no desk imports.
- [ ] Build the thin status client over the server API
      The segments' data (agent status, git state, setup gaps) fetched/streamed from the existing endpoints, usable outside the desk process.
- [ ] Re-mount the desk shell on the extracted core
      Desk wires the core to the store exactly as today — behaviour and visual parity, no regressions.
- [ ] Make the core embeddable
      Shadow-DOM-safe styling (no reliance on the desk's global CSS) and a package boundary the vite plugin ([[IDEA-128]]) can import.
- [ ] Type-check and test the seam
      Cover the core with props-level tests; `tsc` and lint clean.
