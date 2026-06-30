---
id: IDEA-5
title: Repo health status
---

### IDEA-5: Repo health status

A third section in the already-built Stack panel (`src/app/components/stack-panel.tsx`), next to "Active" and "Live", showing whether the repo is actually green right now — lint, format, and tests — without opening a terminal. This is the concrete version of a promise the original pitch already made ("analog gauges display project health and momentum") rather than a new concept: three small status pills wired to checks the project already runs by hand.

No new tooling — it wraps the scripts already in `package.json`: `biome check .` (covers both lint and format in one pass, since this repo uses Biome instead of separate ESLint/Prettier) and `vitest run` for tests.

**Look:** a "Status" section using the panel's existing `sectionLabelStyle`, placed at the very top of the panel, above "Active" — it's the most "at a glance" of the panel's sections. (The "Commit section in The Stack" idea below adds a second top-of-panel section; final top-to-bottom order ends up Status → Commit → Active → Live.) Three `Stamp` pills (`variant="chalkboard"`, same component already used elsewhere in the panel/showcase), labeled "Lint", "Format", "Tests", each in one of four states: `pass` (green), `fail` (red), `running` (amber, pulsing), `stale`/`unknown` (gray — shown before the first check has ever run). Clicking a `fail` pill expands a `CodeBlock` (`variant="chalkboard"`) inline beneath it with the raw error output — biome's own error list for lint/format, vitest's failed-test summary for tests — so the failure detail lives in the same panel, no tab-switching to a terminal.

**Feature ideas, roughly in build order:**

- **Backend status cache** — a small in-memory store on the dev server (sits next to `createActivityManager` in `src/app/server/activity.ts`, or a sibling module) holding `{ lint: CheckResult, format: CheckResult, test: CheckResult }`, where `CheckResult` is `{ status: 'pass' | 'fail' | 'running' | 'stale', lastRun: string | null, output: string }`. Starts as all `stale` on server boot.
- **`GET /api/status`** — new route in `src/app/server/api.ts` returning the current cache as-is (no run triggered), same shape as the other read routes (`/api/plans`, `/api/progress`, etc.).
- **Lint/format — auto, on file change** — `biome check .` is near-instant, so it's safe to run on every relevant file change. Reuses whatever file watcher the existing "Live activity feed" item (see "The Stack" idea above) ends up using for `papercamp/` — extend it to also watch `src/`, debounced ~500ms, and spawn `biome check .` on settle. Push the result as a new SSE event type over the *existing* `/api/activity/stream` channel (`activity.ts` already has the pub/sub; this just adds a second event shape, not a second stream) instead of building a parallel connection.
- **Tests — manual first, auto later if it proves worth it** — `vitest run` is too slow/costly to fire on every keystroke. Start with a "Run tests" button inside the Status section (`POST /api/status/test`, triggers a one-off `vitest run`, streams `running` → `pass`/`fail` over the same SSE channel). Only graduate to auto-run (e.g. on a longer debounce, or cached by a hash of `src/**`/`tests/**` so unchanged code skips a re-run entirely) once the manual version shows people actually want it live.
- **In-flight guard** — track a single boolean per check ("lint/format running" / "test running") so a burst of file saves can't spawn overlapping `biome`/`vitest` child processes; a change that arrives mid-run just queues one more run after the current one finishes, instead of stacking processes.
- **Strictly localhost, repo-root-only** — same trust note as the "Agent orchestration" idea above: this spawns real child processes (`biome`, `vitest`), always against the fixed project root the dev server already knows, never a user-supplied path. Fine for a tool that only binds to `127.0.0.1`, but worth keeping explicit as the one boundary not to relax.

Why this is a natural next step rather than a new subsystem: it's the same SSE plumbing the Stack panel's activity feed already needs, pointed at `biome`/`vitest` exit codes instead of `papercamp/` file diffs — no new infrastructure, just a second source feeding the same pipe.
