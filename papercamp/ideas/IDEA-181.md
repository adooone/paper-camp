---
id: IDEA-181
title: Fetch from GitHub only when asked
type: feat
status: review
created: 2026-08-15
updated: 2026-08-16
tags:
  - server
  - github
  - core
subject: Run & monitor
---

GitHub is read when the human asks for it, and at no other time. No timers, no
fetches triggered by local file activity.

Three GraphQL quota exhaustions in one day, each of which silently rewrote the
worklist — merged work regressing to `review`, archived ideas resurfacing as
`planned` and re-entering `run-order.md` — came from fetching on a schedule
nobody asked for.

### What fetches automatically today

1. **`pollOpenPrs`** — a boot sweep plus `setInterval` every 60 seconds, running
   `gh pr list --state all --limit 2000` (all ~162 PRs, closed and merged
   included) and a nested `reviewThreads(first: 100)` query per open PR.
2. **`use-ci-release.ts`** — refetches CI on every SSE `changed` tick, meaning
   every corpus write. During an agent run that is continuous, and each tick is
   a GitHub call.
3. The PR review trigger, already becoming manual under [[IDEA-174]].

### The manual path is already built

`RefreshButton` → `refreshAll()` → `dropServerCaches()` →
`POST /api/refresh` → `clearPrCache()` + `clearCiCache()` +
`invalidateCorpusCache()` → reload every slice. Its toast already reads
"Plans, ideas, checks and PR review state re-read."

Nothing needs building here. The automatic callers just stop:
`setInterval(pollOpenPrs, …)` and the boot sweep are deleted, and
`use-ci-release` drops its activity-stream subscription and fetches on mount and
on explicit refresh only.

### The one thing that must be built first

`resolvePrsByEntity`'s cache is `const cache = new Map<string, PrMapCacheEntry>()`
— in memory, gone on every dev-server restart.

With nothing auto-fetching, that makes the degraded phases-only guess the
**default state after every restart**, until someone clicks Refresh: archived
ideas showing as `planned`, merged ideas showing as `review`. That is the exact
failure this idea exists to stop, so it must not become the resting state.

Persist the PR map to disk and load it at boot. This is safe precisely because
**a merged PR never un-merges** — a stale map is behind, never wrong. The only
thing it can miss is an open→merged transition, which is what the refresh is
for.

### What gets accepted

Status is as fresh as the last refresh. A PR merged on GitHub does not show as
`done` until asked. That is the trade, and it is the right one: the alternative
is what today produced — a worklist that rewrites itself without being asked and
without saying so.

Actions that inherently need GitHub still reach for it as part of the action:
Review PR ([[IDEA-174]]), Fix review, push. Those are the human asking, just
through a different button.

### Effect on [[IDEA-178]]

Its "spend less quota" section becomes moot — there is no longer a schedule to
back off from, and the REST-vs-GraphQL split matters far less at a handful of
requests a day. Its other halves matter **more**: archive location as a closed
signal, refusing to cache a read computed while PR state was unresolved, and
saying in the UI when status is a guess. With refresh on demand, a degraded read
lives longer, so it has to be visible and it must not be cached.

### Out of scope

The local activity stream and file watching — those are cheap, local, and stay
automatic. Local git reads (`git status`, branch, diff) are not GitHub and are
unaffected.

### Phases
- [x] Persist the PR map to disk, load it at boot
      resolvePrsByEntity's in-memory Map is written to a gitignored file and reloaded on start so the degraded phases-only guess is never the resting state.
      run: 7m25s · 10.1k in · 16.2k out · sonnet-5
- [x] Stop pollOpenPrs from auto-fetching
      Delete the boot sweep and the 60s setInterval; nothing schedules the `gh pr list` sweep anymore.
      run: 5m54s · 647 in · 4.2k out · sonnet-5
- [x] Fetch CI on mount and explicit refresh only
      use-ci-release drops its activity-stream subscription so corpus writes no longer trigger a GitHub call.
      run: 4m10s · 393 in · 9.9k out · sonnet-5
- [x] Confirm the manual refresh path re-reads every GitHub-backed slice
      Exercise RefreshButton → /api/refresh end to end after the auto-callers are gone.
      run: 3m43s · 528 in · 7.2k out · sonnet-5
- [x] [manual] Stop run-order pass from live-fetching PRs
- [x] [manual] Move IDEA-162 back to planned with the Fixes phase
- [x] [manual] Fix a plans-actions barrel import cycle in desk-section

### Fixes
- [x] Promote the refresh out of the idea view
      The only manual GitHub fetch in the app is an unlabelled `IconButton` in `entity-detail.tsx`'s header, beside the `updated <date>` text — nothing outside that file calls `refreshAll`/`dropServerCaches`, so on the Plans list, the git page or Settings there is no way to fetch at all. With polling removed this button is the sole path to GitHub data and has to live on a surface present on every page: the Stack panel's Desk section, labelled as fetching from GitHub rather than reloading a view. The in-idea one stays.
      run: 1m28s · 6k in · 5.7k out · sonnet-5
- [x] Show when GitHub data was last fetched
      `papercamp/pr-map.json` already stores `fetchedAt`, and with on-demand fetching "as of 14:32" is load-bearing information that nothing displays. Surface it next to the refresh control and on the PR badge, so a stale PR state is legible where it is actually read rather than silently presented as current.
      run: 6m51s · 1.9k in · 19k out · sonnet-5

### Thread
- [x] 2026-08-16 [review] [agent] Requests changes · 1 finding — The disk-persistence, CI-subscription removal, and last-fetched UI surfacing are well-built and match the spec's mechanics. But the PR only deletes the setInterval poll; the shared resolvePrsByEntity still performs a live GitHub fetch whenever its cache/persisted map is older than the 5-minute TTL, and that function is reached automatically from the papercamp/ file watcher via runRunOrderPass → readWorkEntries. So local file activity during an agent run still triggers `gh pr list` roughly every 5 minutes, which is exactly the 'fetches triggered by local file activity' the idea says must stop.
