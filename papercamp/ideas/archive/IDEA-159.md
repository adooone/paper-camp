---
id: IDEA-159
title: Git actions time out instead of hanging
type: fix
status: done
created: 2026-08-12
updated: 2026-08-13
tags:
  - app
  - git
  - ux
subject: Infrastructure
---

"Sync to main" can spin forever. Nothing in the chain is bounded:
`runGit` spawns git with no timeout and no kill, the route only answers
once `runGitSync()` resolves, and `syncToMain()`'s `fetch` carries no
`AbortSignal` — so one stalled `git fetch` leaves the button reading
"Syncing…" until the page is reloaded, with `activeGitAction` still set
and Push/Pull/Fix silently blocked behind the same lock. The pattern to
copy already exists twice in the repo: `createBranch` bounds its fetch
at 5s with `GIT_TERMINAL_PROMPT=0`, and every `gh` spawn gets a 15s
timeout plus `proc.kill()`. `runGit` — which serves status, commit,
push, pull and sync — got neither.

1. **Every `runGit` call is bounded.** One uniform 30s cap: on expiry
   the child is killed and the promise rejects with an error naming the
   command, e.g. `git fetch timed out after 30s`. `GIT_TERMINAL_PROMPT:
   '0'` goes into the same spawn env so a credential prompt can't block
   it either. One number for every command, not a per-command table — a
   local git call that needs 30s is already broken.

2. **The client stops waiting too.** Every deterministic git call in
   `git-api.ts` carries `AbortSignal.timeout(45_000)`. The client cap
   sits above the server's so the server's named error is what wins
   whenever it fires; the client's own only covers a response that
   never arrives at all.

3. **The post-sync refresh is inside the spinner, so it gets the same
   cap.** `handleSync` awaits `refreshAfterUpstream()` — git status,
   plans and ideas — before its `finally` releases `activeGitAction`,
   so a loader that never settles leaves the button reading "Syncing…"
   long after the git work has landed. The same `AbortSignal.timeout`
   covers those three loaders; a refresh that times out reports itself
   and still releases the lock, because a completed sync must never be
   undone by a failed re-read.

4. **Agent-backed endpoints are exempt.** `suggestCommitMessage` runs an
   agent inline and legitimately takes minutes, so it keeps waiting. The
   cap covers the deterministic endpoints only: status, commit, branch,
   diff, push, pull, sync, fix-divergence.

5. **The toast names the stall.** A timeout surfaces through the failure
   path the actions already have, so the user reads "Sync failed: git
   fetch timed out after 30s" and can retry — instead of staring at a
   dead button.

6. **The action lock stays as it is.** One `activeGitAction` gating all
   four actions is the right design; it was only dangerous because it
   could never be released. Bounded calls make the existing `finally`
   sufficient — no new recovery state, no manual unstick.

### Phases
- [x] Bound every `runGit` spawn with a 30s cap
      Kill the child on expiry, reject with a command-named error, and put `GIT_TERMINAL_PROMPT: '0'` in the spawn env.
      run: 1m14s · 5.7k in · 2.6k out · sonnet-5
- [x] Add a 45s `AbortSignal.timeout` to deterministic `git-api.ts` calls
      Cover status, commit, branch, diff, push, pull, sync, fix-divergence; leave `suggestCommitMessage` uncapped.
      run: 1m12s · 388 in · 3.9k out · sonnet-5
- [x] Cap the post-sync refresh loaders inside `handleSync`
      Apply the same timeout to the status/plans/ideas re-read so a stalled refresh reports itself and still releases `activeGitAction`.
      run: 2m32s · 526 in · 11k out · sonnet-5
- [x] Confirm a timeout surfaces via the existing failure toast and frees the lock
      run: 4m42s · 395 in · 6.8k out · sonnet-5

### Thread
- [x] 2026-08-12 [decision] One uniform 30s server cap and a 45s client cap rather than per-command budgets; the client's sits above the server's so the named server error is what the user sees. Agent-backed git endpoints are exempt.
- [x] 2026-08-12 [log] Evidence that the stall is downstream of git, not in it: the reflog shows a stuck-looking sync whose git work completed in full (`stash push` → `checkout main` → `merge origin/main: Fast-forward`, all at 11:33:51) while the button still read "Syncing…". That is why the cap has to cover the refresh leg, not just the `/api/git/sync` POST.
- [x] 2026-08-12 [log] Measured on the dev box: `git fetch --prune` takes 1.70s, of which ~1.24s is the SSH handshake to github.com; the rest of a sync (status, stash, checkout, ff-merge, pop) totals ~0.13s. That cost is a machine-level fix — ssh `ControlMaster` multiplexing drops the fetch to ~0.58s — not code, so it stays out of scope here.
