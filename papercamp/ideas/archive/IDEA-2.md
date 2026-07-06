---
id: IDEA-2
title: Settings config workspace
type: feat
status: done
created: 2026-06-27
updated: 2026-06-27
tags:
  - app
  - settings
---

Extended Settings into a config workspace: auto-discovered config files, structured package.json rendering, and editable project identity.

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
