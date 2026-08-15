---
id: IDEA-176
title: Sync stops stashing over the corpus
type: fix
status: idea
created: 2026-08-14
updated: 2026-08-14
tags:
  - server
  - git
  - plans
subject: Run & monitor
---

`runGitSync` stashes the whole dirty tree — corpus included — then pops it back
after reconciling onto `origin/main`. When the pop conflicts, the sync leaves an
unmerged index with no `MERGE_HEAD`, which is not a state `git merge --abort` or
`git reset --keep` can clear, and the work sits in a stash nobody looks at
again.

This is [[IDEA-137]]'s incident in the sync path. IDEA-137 fixed *run-all* by
committing pending `papercamp/` changes at branch setup so a phase agent's
destructive git could not erase them. `runGitSync` still does exactly what that
fix forbids agents from doing.

### What happened (2026-08-14)

A sync stashed the tree as `papercamp-sync`, reconciled onto `origin/main`, and
the pop conflicted. Six files came back unmerged (`UU`/`DU`), among them
`papercamp/config.json` and `papercamp/run-order.md` — the two files the server
live-writes while an operation is in flight, and therefore the two most likely
to differ between stash and destination. IDEA-172 vanished from disk (it was in
`origin/main`, so it came back on recovery). Recovery needed
`git restore --source=origin/main --staged --worktree .` followed by
`git merge --ff-only`, plus a manual `nextId.idea` repair, because the incoming
`config.json` counter was behind the ideas already on disk.

Nothing was lost, but only because everything at risk had already been pushed.

### The fix

Commit the corpus before stashing, exactly as run-all does. `git.ts` already has
`commitCorpus(title, id)` from IDEA-137 — a `docs(ideas): … — plan` commit with
a `Refs:` trailer, `noVerify`, no-op on a clean corpus. `runGitSync` calls the
same helper (with a sync-appropriate subject) before its `stash push`, so
`papercamp/` never enters the stash and the two files most prone to conflict are
already committed.

Only genuine source changes are then stashed, which is what stashing is for.

### When the pop still conflicts

A source-only pop can still conflict, and the current failure is a dead end:
the message names `git stash` and leaves an index state neither `merge --abort`
nor `reset --keep` can clear.

`stashPending: true` already exists and already carries a `recoveryPrompt`
through `buildGitSyncRecoveryPrompt`. Make that state **durable** rather than a
one-shot response field — see [[IDEA-177]], which surfaces dangling stashes —
and have the message name the recovery that actually works
(`git restore --source=origin/main --staged --worktree .`, then
`git merge --ff-only`), not just "the originals are still in `git stash`".

### Out of scope

The `resolve-conflict` agent task and `git-sync-recovery.ts`, which exist for
this and either did not fire or did not finish — worth its own look, but this
idea is about not creating the conflict in the first place.

### And a safety net for when it still happens

Prevention is not enough on its own: a source-only pop can still conflict, and
paper-camp has quietly created four stashes across this project's history —
three `papercamp-sync` and one `sync-idea-66`, the oldest dating to
`fix/idea-83` — without ever mentioning them.

Sync already detects the failure and returns `stashPending: true` with a
recovery prompt, but that lives only in the sync call's response: navigate away
and nothing remembers. `GET /api/git/status` gains a `stashes` array (index,
branch, message, age from `git stash list`), rendered beside `branchHygiene` on
`/git` and in the Deliver section. Informational at rest, escalating to a
warning when an entry is paper-camp's own — those mean a pop failed and work is
parked, rather than a human deliberately setting something aside.

Read-only: no apply, pop, or drop from the UI. Popping a stash is how this mess
gets made; the app surfaces the state and the human chooses. Age matters more
than count, so entries show their age and sort newest first. Stashes created
outside paper-camp are listed but never flagged.

### Phases
- [x] Commit the corpus before stashing in `runGitSync`
      Call `commitCorpus` with a sync-appropriate subject ahead of `stash push`.
      run: 10m57s · 6.2k in · 37.7k out · sonnet-5
- [x] Confirm only source changes reach the stash
      Verify the commit is a no-op on a clean corpus and `papercamp/` never enters the stash.
      run: 3m5s · 238 in · 6.6k out · sonnet-5
- [x] Make `stashPending` durable instead of one-shot
      run: 4m44s · 800 in · 12.4k out · sonnet-5
- [x] Rewrite the recovery message to name the working recovery
      Point at `git restore --source=origin/main --staged --worktree .` then `git merge --ff-only`.
      run: 3m2s · 288 in · 3.1k out · sonnet-5
- [ ] Parse stashes in the git status endpoint
      Add a `stashes` array (index, branch, message, age) to `GET /api/git/status`, parsed from `git stash list`.
- [ ] Flag paper-camp's own entries
      Mark entries with a `papercamp-sync` / `sync-…` prefix so the UI can escalate them from informational to warning.
- [ ] Render the stash surface beside branch hygiene
      Show it on the `/git` page and in the Deliver section, resting-informational and sorted newest first.
- [ ] Offer per-entry inspection and recovery guidance
      Wire `git stash show -p stash@{N}` per entry and name the recovery that works when the surface is in warning state.
