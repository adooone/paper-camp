---
id: IDEA-61
title: Speed up API reads and refetch churn
type: refactor
created: 2026-07-13
tags:
  - app
  - core
  - performance
---

A quick pass over the live API surfaced the hot paths: `/api/git/status` ~170ms, `/api/plans` ~80–120ms, `/api/consistency` ~95–130ms, while the in-memory `/api/status` is ~1ms. None is alarming, but they run often — and a single papercamp write currently fans out into six of them at once. The wins are structural, not micro-tuning.

- **Parallelise the corpus read.** `core/readers.ts` reads all ~57 entity files with a sequential `for … await readFile`, so latency scales linearly with the corpus. Switch the per-file read+parse to `Promise.all` — the files are independent.
- **Cache the parsed corpus, invalidated by the watcher we already have.** `/api/plans` and `/api/ideas` re-read and re-parse the whole `papercamp/ideas` tree on every request even when nothing changed. `activity.ts` already runs a debounced `fs.watch` on `papercamp/` — hang an in-process cache off that signal (invalidate on change, serve parsed entries otherwise) so repeat reads are near-free.
- **Coalesce the SSE-driven refetch.** One papercamp change → the SSE tick fires `loadProgress`, `loadPlans`, `loadStatus`, `loadConsistency`, `loadGitStatus`, and `loadAgentStatus` *simultaneously* (`stack-panel.tsx`), several of them the expensive endpoints above. An agent writing a file per phase stampedes all six each time. Scope the reload to what actually changed and/or debounce it client-side.
- **Parallelise the git status spawns.** `/api/git/status` awaits `getStatus`, `getAheadCount`, and `getBranchHygieneStatus` in series, each spawning git (several processes total) — hence the ~170ms. Run the independent ones with `Promise.all`, or fold them into fewer `git` invocations.
- **(Stretch) Client render + bundle.** Confirm the zustand selectors stay narrow so a single-field update doesn't re-render the whole tree, and lazy-load the non-default routes (Docs/Settings) so the initial dashboard payload is smaller.

Overlaps with [[IDEA-58]] (both touch `readers.ts` and the Stack panel) but is scoped to speed, not readability — worth its own pass so a cache or a parallelised read isn't lost inside a larger refactor. Behaviour is unchanged; the check suite plus a before/after timing of the endpoints above is the acceptance gate.

### Phases
- [x] Capture baseline endpoint timings
      Record before-numbers for `/api/git/status`, `/api/plans`, `/api/consistency`, and `/api/status` so the after-comparison in the acceptance gate has something to measure against.
- [x] Parallelise the corpus read
      In `core/readers.ts`, replace the sequential `for … await readFile` with `Promise.all` over the independent per-file read+parse so latency stops scaling linearly with the corpus.
- [ ] Cache the parsed corpus off the existing watcher
      Hang an in-process cache of the parsed `papercamp/ideas` tree off `activity.ts`'s debounced `fs.watch` signal — invalidate on change, serve parsed entries otherwise — so repeat `/api/plans` and `/api/ideas` reads are near-free.
- [ ] Parallelise the git status spawns
      Run the independent `getStatus`, `getAheadCount`, and `getBranchHygieneStatus` with `Promise.all` (or fold them into fewer `git` invocations) so `/api/git/status` stops paying for them in series.
- [ ] Coalesce the SSE-driven refetch
      Scope the `stack-panel.tsx` reload to what actually changed and/or debounce it client-side so one papercamp change no longer stampedes all six loaders at once.
- [ ] (Stretch) Client render + bundle
      Confirm the zustand selectors stay narrow so a single-field update doesn't re-render the whole tree, and lazy-load the non-default routes (Docs/Settings) to shrink the initial dashboard payload.
- [ ] Run the acceptance gate
      Run the check suite and re-time the endpoints above, comparing against the baseline to confirm the wins with behaviour unchanged.
