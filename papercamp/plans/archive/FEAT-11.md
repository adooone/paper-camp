---
id: FEAT-11
title: Repo health status
kind: feat
status: done
created: 2026-06-21
idea: IDEA-5
updated: 2026-06-24
tags:
  - app
  - stack
---

A third Stack panel section, above "Active", showing whether the repo is actually green
right now — lint, format, tests — without opening a terminal. No new infrastructure:
reuses the file watcher and SSE activity channel FEAT-6 already built, pointed at
`biome`/`vitest` exit codes instead of `papercamp/` file diffs. See ideas.md's "Repo
health status" for the full rationale.

### Phases
- [x] Add backend status cache
      An in-memory `{ lint, format, test }` `CheckResult` store next to `createActivityManager`, starting all `stale` on server boot
- [x] Add GET /api/status route
      Returns the current cache as-is, same shape as the other read routes
- [x] Auto-run lint/format on file change
      Extend the existing file watcher to also watch `src/`, debounced, spawning `biome lint .` + `biome format .` on settle, pushed over the existing `/api/activity/stream` channel
- [x] Add manual Run tests button
      `POST /api/status/test` triggers a one-off `vitest run`, streaming `running` → `pass`/`fail` over the same SSE channel
- [x] Add in-flight guard
      Track a running boolean per check so a burst of file saves can't spawn overlapping `biome`/`vitest` processes; a change mid-run queues one more run after the current one finishes
- [x] Build Status section in Stack panel
      Three chalkboard `Stamp` pills (Lint/Format/Tests) above "Active"; a `fail` pill expands a chalkboard `CodeBlock` inline with the raw error output

### Log
- 2026-06-24: Verified live: stale→fail/running/pass transitions all work, failing pills expand a CodeBlock with raw biome output, auto lint/format fires on a src/ file change (and caught two real pre-existing issues in router.tsx and parser.ts), manual Run tests streams to pass. Approved and closed.
