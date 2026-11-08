---
id: IDEA-328
title: Daemon reads with no per-request work
type: feat
status: planned
created: 2026-11-08
updated: 2026-11-08
tags:
  - server
  - core
  - performance
subject: Infrastructure
---

Every slow answer the daemon gives is work it does again on each request:
spawning `gh` or `git`, parsing the ideas folder, walking `src/`, or
serialising entities a reader never looks at. IDEA-327 moved the web
ideas page onto the worklist; this idea removes the per-request work
behind every other read, for the web and for the phone, and fixes what
makes the hosted client's first paint slow. Measured against the 0.46.0
daemon on deimos:

- `GET /api/stats` takes 1.3 s for paper-camp and 2.9 s for radio on
  every call: `computeProjectStats` (`src/core/stats.ts`) spawns
  `scripts/comment-stats.mjs`, walks `src/` for test lines and reads the
  coverage summary each time.
- `GET /api/merge-policy` takes 1.05 s on every call: `getMergePolicy`
  (`src/app/server/merge-policy.ts`) spawns `gh repo view` and then
  `gh api repos/<slug>`.
- `GET /api/ci` takes 1.2 to 1.4 s whenever its 60 s cache expires, and
  the caller waits for the `gh` run (`src/core/ci/ci-release.ts`).
- `GET /api/machine/projects` takes 0.25 to 0.3 s: `readMachineProjectSummaries`
  (`src/cli/daemon-server.ts`) awaits `getLocalStateDriftCount` for every
  mounted project, which runs `git rev-parse` and `git ls-files` each time.
  The web polls this route every 5 s and the phone calls it twice per
  refresh, so seven projects cost fourteen git processes per poll.
- Ten call sites parse the whole ideas folder with `readEntities` instead
  of reading the corpus snapshot: `src/app/server/agent.ts` (four),
  `src/app/server/routes/agent.ts` (three), `src/app/server/routes/chat.ts`
  (two, so `GET /api/chat` takes 0.17 s) and
  `src/app/server/routes/content/entities.ts` (one).
- `readCorpus` (`src/core/corpus.ts`) cannot tell it has a cache hit
  without stating every idea file and spawning `git symbolic-ref` and
  `git rev-parse`. Only the worklist and entity routes reuse that key,
  for one second. No file watcher exists on the server; `agent.ts`
  invalidates by hand after a run.
- `GET /api/roadmap` is 229 KB for paper-camp because `resolveRoadmap`
  (`src/core/roadmap.ts`) embeds full `PlanEntry` objects, thread and 815
  run attempts included, in every horizon, standing concern and the
  `unfiled` list. The roadmap page reads id, title and status; the ideas
  page's `useRoadmapItemNames` reads names.
- `GET /api/agent/status` is 18 KB raw because every finished task carries
  its `lines`. The phone polls it every 4 to 5 s on three screens;
  `GET /api/tasks/output` already serves lines on demand.
- The hosted client at paper.adoo.one serves `main-*.js` (320 KB brotli)
  and `main-*.css` with `cache-control: public, max-age=0, must-revalidate`,
  so a reload revalidates both hashed files against Vercel before the app
  can run. `index.html` also loads 14 weights of Cormorant Garamond and
  Caveat through a render-blocking Google Fonts stylesheet, and
  `vite.app.config.ts` emits one 1 MB chunk.

**Reads answer from memory.** The daemon owns the project folder, so it
learns about changes from a watcher instead of re-deriving them per
request. Each mounted project gets one `fs.watch` on `papercamp/ideas`
(recursive), `papercamp/.local/run-order.md`, `.git/HEAD` and
`.git/refs/heads`; any event calls `invalidateCorpus`. While the watcher
is alive, `readCorpus` returns the cached snapshot without stating files
or spawning git, and re-checks the fingerprint at most once every 30 s as
a safety net for a watcher that missed an event. The key resolution's
`gh` and `git` calls run only when the snapshot is rebuilt. Every direct
`readEntities` call on the server becomes `(await readCorpus(root)).entries`.

**Probes never make a caller wait.** A `cachedProbe(key, ttl, load)`
helper (`src/app/server/probe-cache.ts`) returns the last value at once
and refreshes in the background once the TTL has passed; the first call
after mount awaits the load. `getMergePolicy`, `fetchCiReleaseState`,
`probeCapabilities`, `probeConnections` and `readLocalStateDrift` go
through it. A refresh that changes the value publishes a `changed`
message with area `services` (or `git` for drift and CI) so clients
refetch, and `?fresh=1` / `?recheck` force a synchronous reload as today.
`computeProjectStats` runs at mount and on a debounced corpus change,
never on the request path; `/api/stats` serves the last result.

**Payloads carry what their readers use.** `resolveRoadmap` returns
`RoadmapItemRef` (`id`, `title`, `status`, `type`) where it returned
`PlanEntry`, including `unfiled`; the roadmap page and
`useRoadmapItemNames` read those fields. `GET /api/agent/status` drops
`lines` from finished tasks and keeps them on running ones.
`MachineProjectSummary` gains `active: { id, title } | null`, the entity
of the project's running task, so the phone's runtime snapshot stops
fetching a corpus to name it.

**The hosted client paints from cache.** `vercel.json` sends
`Cache-Control: public, max-age=31536000, immutable` for `/assets/*`.
The two families are self-hosted under `public/fonts` in the weights the
compiled CSS uses, declared with `@font-face` and `font-display: swap`,
and the Google Fonts links leave `index.html`. `vite.app.config.ts` splits
`react` and `react-dom`, `@tanstack/*` and `@dendelion/folk-ui` into their
own chunks so an app release does not re-download the vendor code.

`/api/plans` and `/api/ideas` stay until paper-camp-mobile reads the
worklist; nothing here changes them.

**Acceptance.** With the daemon idle, every GET under `/api/` for a mounted
project answers in under 50 ms on a warm cache, `/api/stats`,
`/api/merge-policy`, `/api/ci` and `/api/machine/projects` included. A
hand edit to an idea file is visible on the next read without a request
having to stat the folder. `/api/roadmap` for paper-camp is under 30 KB
and `/api/agent/status` under 4 KB with no task running. A reload of
paper.adoo.one makes no request for `main-*.js` or `main-*.css` when
they are cached, and no request to fonts.googleapis.com.

### Phases
- [ ] The corpus snapshot invalidated by a watcher
      Add `watchCorpus(root, onChange)` in `src/core/corpus-watch.ts` (recursive `fs.watch` on `papercamp/ideas`, plus `.local/run-order.md`, `.git/HEAD`, `.git/refs/heads`), started per mount in `src/app/server/api.ts` and closed on unmount; `readCorpus` skips key resolution while a watcher is registered for the root and re-fingerprints at most every 30 s; replace the ten `readEntities` calls in `agent.ts`, `routes/agent.ts`, `routes/chat.ts` and `routes/content/entities.ts` with snapshot reads. Tests for invalidation on write and for the 30 s fallback.
- [ ] Probes and stats answer from cache
      `src/app/server/probe-cache.ts` with `cachedProbe` (stale-while-revalidate, first call awaits, forced reload on `?fresh`/`?recheck`); route `getMergePolicy`, `fetchCiReleaseState`, `probeCapabilities`, `probeConnections` and the per-mount drift count through it, publishing `services` or `git` when a value changes; `computeProjectStats` runs at mount and on a debounced corpus change, with `/api/stats` serving the stored result. Tests on the helper and on the stats route.
- [ ] Payloads shaped for their readers
      `RoadmapItemRef` in `src/types/index.ts`; `resolveRoadmap` and `/api/roadmap` return refs in horizons, standing concerns and `unfiled`; the roadmap feature and `useRoadmapItemNames` read them. `/api/agent/status` omits `lines` on finished tasks. `MachineProjectSummary.active` from the agent manager's running task in `readMachineProjectSummaries`. Route tests for all three shapes.
- [ ] Hosted client first paint
      Immutable `Cache-Control` for `/assets/*` in `vercel.json`; Cormorant Garamond and Caveat self-hosted under `public/fonts` in the weights the compiled CSS uses, `@font-face` with `font-display: swap` in the global stylesheet, Google Fonts links removed from `index.html`; `manualChunks` in `vite.app.config.ts` for react, `@tanstack/*` and `@dendelion/folk-ui`. `pnpm build:app` output lists the vendor chunks.
