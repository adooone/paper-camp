---
id: IDEA-45
title: Build core library
type: feat
status: done
created: 2026-06-18
tags:
  - core
  - cli
---

Built the core library: markdown parsing/serialization for plans, decisions, and open questions, zod validation, and the init/dev/add-plan CLI commands.

### Phases
- [x] Design per-file schemas in about.md
      Design and document the per-file schemas in about.md
- [x] Parser with non-fatal warnings
      Parser with non-fatal warnings on malformed entries
- [x] `init` and `add plan` CLI commands
      `init`/`add plan` CLI commands
- [x] Fix Vite CLI build entry
      Fix vite.config.ts so `dist/cli/index.js` actually gets built
