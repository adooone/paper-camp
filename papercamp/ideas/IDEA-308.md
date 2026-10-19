---
id: IDEA-308
title: Honest checks, git and services
type: fix
status: planned
created: 2026-10-19
tags:
  - server
  - git
  - checks
  - services
subject: Code health
---

The managers under `src/app/server/` report state that can be stale or wrong,
and several of them hang or misreport on an error.

Check results are reused when their recorded HEAD matches the current HEAD
(`status.ts` `getCachedOrRunChecks`, `desk-checks.ts`), so an edit that is not
committed yet reuses the previous pass or fail in the run-all baseline. The
Docs check reads the working-tree corpus but is keyed on HEAD too.
`desk-checks.ts` reads HEAD after the command finishes, so a commit landing
during a long test run stamps a result produced on the old tree with the new
sha. If `getHeadSha` rejects, the check stays `running` forever and the route
has no catch; nothing in `src` handles `unhandledRejection`.
`runChecksAndWait` wraps an async function in a Promise executor that only ever
resolves, so any throw inside hangs the run-all gate, and both `close` and
`error` of the biome spawn are wired to the same runner.

`desk-services.ts` `killAll` kills without marking runtimes `stopping`, so the
exit handler reports every service as crashed and appends (and may push) a
"stopped unexpectedly" notification each time the daemon unmounts a project.
`GET /api/services` probes the healthcheck of every stopped service, up to
three seconds each. The capability and agent-auth probes
(`capabilities.ts`) have no TTL; a `claude login` in a terminal leaves the
"not signed in" badge wrong until the server restarts, and
`local-adapters.ts` runs its own uncached `claude auth status`, so the
connections list and the badge can disagree.

`git.ts` runs without `GIT_OPTIONAL_LOCKS=0`, so a background status takes
`index.lock` while a commit from another tab fails on it, and `commit` runs its
`git add` outside the `withIndex` queue. `/api/git/status` spawns about twelve
git processes, several of them repeated `getCurrentBranch` and `hasUpstream`
calls. `runGitPull` and `fixDivergence` are the same operation; `ensureBranch`
and `checkoutBranch` repeat the same exists check; the behind count compares
HEAD with local `main` on one side and `mainRef()` on the other. The desk
manifest is read by three separate loaders (`loadManifestServices`,
`loadManifestChecks`, `loadManifestCi`), and `clearCiCache()` drops every root.

**Checks are keyed on the tree, not HEAD.** A desk check records
`{ headSha, treeHash }`, where `treeHash` is the sha-1 of
`git status --porcelain=v2` output, both captured before the command starts.
A result is fresh when both still match. The Docs check is keyed on the corpus
fingerprint. A failing `getHeadSha` records `null` and the check still settles;
`routes/checks.ts` catches and answers 500. `runChecksAndWait` becomes a plain
async function that awaits the biome fixer with `once('close')` and lets
errors reach the caller.

**The run-all gate lives in the check manager.** `runChecksAndWait` and
`getCachedOrRunChecks` move into `desk-checks.ts`, which already owns the
runtimes they read. `StatusManager` is removed: `/api/status` returns
`{ prFetchedAt }` from the route, `StatusManagerState` leaves the Vite
hot-swap, and the seven call sites in `routes/agent.ts` call `checks` directly.

**Services stop on purpose.** `killAll` marks every runtime `stopping` before
`kill()`, so no crash notification is written. `restart` on a `stopping`
runtime waits for the exit, then starts. `GET /api/services` reports a stopped
service from its pid alone and polls a healthcheck only while the service is
running.

**Probes expire.** The capability and auth caches carry a 60-second TTL;
`/api/capabilities` and `/api/agent/auth-status` honour `?recheck=1` the way
`/api/connections` does; `agentSignedIn` in `local-adapters.ts` reads the same
cached probe.

**Git does less.** `runGit` sets `GIT_OPTIONAL_LOCKS=0`; `commit`'s add runs
inside `withIndex`. `/api/git/status` is built from one
`git status --porcelain=v2 --branch` (branch, upstream, ahead, behind, entries)
plus `git stash list`; `getAheadCount`, `getBehindCount`, `hasUpstream` and
the repeated `getCurrentBranch` calls go. `runGitPull` and `fixDivergence`
become one function; `ensureBranch` and `checkoutBranch` share one exists
check; `isMergedIntoMain` and `getPhaseStateAtRef` stop being exported; the
behind count uses `mainRef()` on both sides.

**One manifest reader.** `loadDeskConfig(root)` in `src/core` replaces the
three loaders, and `clearCiCache(root)` clears one root.

Done when editing a file without committing makes the stack panel's lint stamp
go stale, a daemon unmount writes no crash notification, `claude logout`
followed by a reload shows the badge within a minute, `/api/git/status` shows
at most three git spawns in a traced request, and `status.ts` no longer
exists.

### Phases
- [x] Check freshness keyed on the tree
      `{ headSha, treeHash }` captured before the run, Docs on the fingerprint,
      settled results on `getHeadSha` failure, async `runChecksAndWait`; tests.
      run: 4m59s · 78 in · 26.3k out · sonnet-5 · sess:9639e81b-bba2-4453-b55c-3cda24701f5d
- [x] The run-all gate inside the check manager
      `runChecksAndWait` and `getCachedOrRunChecks` move; `StatusManager` and
      its hot-swap state removed; `/api/status` inlined; call sites updated.
      run: 7m42s · 196 in · 32.3k out · sonnet-5 · sess:9639e81b-bba2-4453-b55c-3cda24701f5d
- [x] Services stop on purpose
      `stopping` before `kill()` in `killAll`, restart-while-stopping, no
      healthcheck probes for stopped services; tests.
      run: 1m14s · 32 in · 5.4k out · sonnet-5 · sess:d0043b9f-e28a-49f9-82f9-657326427a62
- [x] Probes with a TTL and a recheck
      60 s TTL, `?recheck=1` on both routes, one shared auth probe; tests.
      run: 3m58s · 104 in · 17.9k out · sonnet-5 · sess:d0043b9f-e28a-49f9-82f9-657326427a62
- [x] Git with fewer spawns and no lock races
      Optional locks off, add inside `withIndex`, one porcelain status
      command, duplicate pull and branch paths folded, consistent main ref;
      tests.
      run: 12m8s · 130 in · 60.2k out · sonnet-5 · sess:d0043b9f-e28a-49f9-82f9-657326427a62
- [ ] One manifest reader and a per-root CI cache
      `loadDeskConfig(root)` replaces the three loaders; `clearCiCache(root)`.
