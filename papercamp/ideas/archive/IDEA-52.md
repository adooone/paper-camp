---
id: IDEA-52
title: Build Settings page
type: feat
status: done
created: 2026-06-19
updated: 2026-06-19
tags:
  - app
  - settings
---

Turned Settings from a static info page into a sidebar-driven configuration workspace scoped to what the repo's stack actually has.

### Phases
- [x] Add Settings sidebar layout
      Sidebar layout — a left rail of sections mirroring `PlansSidebar`'s structure, main area showing whichever section is selected; "General" (the existing project-info card) becomes the default landing section instead of the whole page
- [x] Add dynamic configs endpoint
      Add a `GET /api/configs` endpoint that scans the repo root for config files that actually exist (`biome.json`, `tsconfig.json`, `tailwind.config.ts`, `vite.config.ts`, `vite.app.config.ts`, `postcss.config.js`, `package.json`) and returns only those — never a hardcoded list
- [x] Add read-only config viewer
      Read-only config viewer — selecting a config file loads its text and renders it with a `<CodeBlock>` component
