---
id: IDEA-67
title: Deterministic dirty sync
type: fix
status: done
created: 2026-07-17
updated: 2026-07-19
tags:
  - app
  - server
  - git
  - agent
---

Dirty sync is an agent job today, and it shouldn't be: `/api/git/sync` with `mode: 'dirty'` spawns a Claude task (exclusive — blocks every other agent, takes minutes, costs tokens) whose prompt asks it to "stash **or commit** uncommitted changes, relocate mis-filed content, checkout main, fetch, ff-merge". Everything in that list except the stash-or-commit *choice* is a fixed command sequence, and the choice is precisely what must not be re-decided per run by a model: on its first real outing the agent stashed the user's work, switched to main, and never popped — work stranded in `git stash` (and the alternative branch of that choice commits work onto a dead branch instead). [[IDEA-66]]'s "sync from a dirty merged branch" button is only trustworthy if what it triggers is boring.

The deterministic replacement is the clean path plus three lines: `git stash push -u` → existing `runGitSync` (`checkout main`, `fetch --prune`, `merge --ff-only origin/main`) → `git stash pop`. The one genuine judgment moment — a pop conflict — is handled by stopping loudly ("changes conflict, originals in `git stash`") rather than improvising a merge, which is safer than what an agent would do with it. The "relocate mis-filed content" step drops out entirely: corpus repair is not syncing.

Second bug in the same flow: [[IDEA-66]]'s `stale-merged` gate never fired in the real workflow because `getBranchHygieneStatus` compares against the LOCAL `main` ref (`branch --merged main`, `rev-list HEAD..main`), which only advances on checkout+pull — the very thing sync does. After a GitHub-side merge the branch never looked merged (live repro on PR #46). Compare against `origin/main` when the ref exists, and refresh it with a throttled fire-and-forget `git fetch origin main` so the app notices a merge without anyone fetching manually.

### Phases
- [x] Carry changes through runGitSync with a stash
      `git.ts`: when the tree is dirty, `stash push --include-untracked` before the checkout/fetch/ff-merge and `stash pop` after; a pop conflict throws a clear error (markers in tree, originals still stashed) without masking a primary sync failure.
- [x] Drop the sync agent path
      `routes/git.ts`: `/api/git/sync` loses the `mode` split and the `DIRTY_SYNC_PROMPT`, always calling `runGitSync`; `agent.ts` loses `startSync`. The `sync` TaskKind stays in types/labels so historical `tasks.log` entries still render.
- [x] Compare hygiene against origin/main
      `isMergedIntoMain`/`getBranchHygieneStatus` resolve a main ref — `origin/main` when it exists, `main` otherwise — and hygiene kicks a throttled (60s) fire-and-forget `git fetch origin main` so a GitHub-side merge flips the branch to `stale-merged` without a manual fetch.
- [x] Gate with tests
      Real-repo tests: dirty sync carries uncommitted+untracked files onto main; a pop conflict rejects with the stash preserved; hygiene reports `stale-merged` via `origin/main` while local `main` is stale. Existing suites stay green.
