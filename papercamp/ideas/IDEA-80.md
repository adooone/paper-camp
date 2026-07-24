---
id: IDEA-80
title: Dev-server reload honesty
type: fix
status: review
created: 2026-07-22
tags:
  - dev-server
  - vite
  - api
subject: Workflow
---

server code changes silently don't apply until restart (the globalThis API cache). Either hot-reload routes or show a visible "restart needed" signal. This footgun bit three times in one week.

From the roadmap: Horizon 1 — Ready for daily use.

### Phases
- [x] Pin down the staleness boundary
      Confirm the exact cause in `vite.app.config.ts`: `g.__paperCampApi` is cached on
      `globalThis` and reused across Vite's in-process restarts, so edits under
      `src/app/server/**` never re-run `createApiMiddleware()`. Note the one thing the
      cache legitimately protects — the live agent task (`agent.current`) that would be
      orphaned by a naive reload — since any fix must preserve it.
- [x] Hot-reload the server API graph on change
      Watch `src/app/server/**` and, on change, rebuild the middleware via a fresh
      `ssrLoadModule('/src/app/server/api.ts')` (invalidate the SSR module first) instead
      of returning the stale cached instance, so route/handler edits apply live.
- [x] Carry live agent state across the reload
      Hand the old instance's `agent.current` (and any other in-flight tracking) to the
      new middleware so a running agent task survives the hot-reload rather than being
      silently orphaned — the exact regression the globalThis cache was added to prevent.
- [x] Show a visible "restart needed" fallback
      For any server change that can't be safely hot-swapped (e.g. an edit landing mid
      agent-run), surface an unmistakable signal — a dev-only banner in the UI and/or a
      loud terminal log — so the footgun can never again apply silently.
- [x] Gate the pass
      `tsc --noEmit`, `npx biome check . --write`, and `pnpm test` clean across the repo;
      verify by editing a server route while `pnpm dev` runs and confirming the change
      takes effect (or the restart signal fires) without a manual kill.
