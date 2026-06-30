---
id: FEAT-21
title: Settings config workspace
kind: feat
status: done
created: 2026-06-27
idea: IDEA-2
updated: 2026-06-27
tags:
  - app
  - settings
---

Turns Settings from a single static info+icon page into a real sidebar-driven
configuration workspace, scoped to what this repo's stack actually has — auto-discovered
config files, structured package.json rendering, and editable project identity.
Built across FEAT-5 (sidebar layout + config discovery) and FEAT-9 (package.json table +
editable project name). The original write-path for biome.json/tsconfig.json/etc. was
deliberately dropped (those are editor/LSP-backed files) and split into IDEA-13.

### Phases
- [x] Add Settings sidebar layout
      Sidebar layout — a left rail of sections mirroring PlansSidebar's structure,
      main area showing whichever section is selected; "General" is the default
      landing section
- [x] Add dynamic configs endpoint
      GET /api/configs scanning the repo root for config files that actually exist
      (biome.json, tsconfig.json, tailwind.config.ts, vite.config.ts, vite.app.config.ts,
      postcss.config.js, package.json) and returns only hits
- [x] Add structured package.json rendering
      ConfigEditorSection special-cases package.json into a name → command table
      instead of a raw CodeBlock
- [x] Make project name editable
      The General card's project name becomes an editable Input, saved through
      POST /api/config
