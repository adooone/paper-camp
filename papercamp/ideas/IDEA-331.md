---
id: IDEA-331
title: Reconcile never strands a stash
type: fix
status: planned
created: 2026-11-14
updated: 2026-11-14
tags:
  - server
  - git
subject: Infrastructure
---

Three `git stash` entries named `papercamp-reconcile` sat in this repo
from 2026-11-04 to 2026-11-14. Each held `papercamp/config.json`,
`papercamp/about.md`, `papercamp/chat.md`, the idea files IDEA-323 to
IDEA-326 and, in the two older ones, a day's source edits. Nobody saw
them: the four ideas were simply gone from the Ideas page for ten days,
`nextId.idea` came back from an older copy of `config.json` and fell
behind the ids on disk (doctor's `id-counter-stale`), and the source
edits were later swept into `docs(ideas): IDEA-323 run bookkeeping`
commits under an idea that no longer existed on disk.

**How they got there.** `reconcileOnto` (`src/app/server/git.ts`) runs
before every pull, sync and fix-divergence. When a fast-forward is not
possible it calls `stashDirtyPapercamp`, which stashes the dirty tree,
rebases, and runs `git stash pop --index`. When the pop fails the method
throws `StashPendingError` once, with a message telling the user to run
`git stash pop --index` themselves. Nothing stores that state: the next
reconcile finds a clean tree, stashes the new churn under the same name,
and the pile grows. The sibling path `runGitSync` already avoids this for
`papercamp/`: it commits the corpus first (`commitCorpus('docs(ideas):
sync corpus')`) "so papercamp/ never enters the stash", and only stashes
what is left. `reconcileOnto` never got the same treatment, and since
2026-11-06 it refuses to run at all when anything outside `papercamp/` is
dirty, so the stash it still makes only ever holds the daemon's own
writes, which have no reason to be stashed in the first place.

**Reconcile commits, never stashes.** `reconcileOnto` commits a dirty
`papercamp/` with `commitCorpus('docs(ideas): reconcile corpus')` before
the rebase, exactly as `runGitSync` does. With the existing refusal for
anything dirty outside `papercamp/`, nothing remains to stash, so
`stashDirtyPapercamp` and `StashPendingError` are deleted. The bookkeeping
commit rides the rebase like any other local commit, and a content
conflict in an idea file goes through `driveRebaseToCompletion` as today.

**Stranded stashes are visible and restorable.** The daemon lists its own
stashes (`papercamp-reconcile`, `papercamp-sync`, the parser at
`listStashes` already reads `git stash list`) in two places. Doctor gets a
`stranded-stash` rule (error) naming each entry with its date and the
`papercamp/` files it holds. The git card in the Stack panel shows the
same rows with a *Restore* action: `POST /api/git/stash-restore` with the
stash index checks out that stash's `papercamp/` files onto the tree
(tracked files from the stash commit, untracked ones from its third
parent), refuses to overwrite a `papercamp/` file that differs on disk
and names it instead, and drops the stash entry once every file is back.
Files outside `papercamp/` are left in the stash and named in the
response, since they are the user's to restore.

**Acceptance.** A pull or sync with an uncommitted idea file leaves no
stash entry and the file in a `docs(ideas): reconcile corpus` commit on
the branch. A repo with a `papercamp-reconcile` stash shows it in doctor
and in the git card; *Restore* puts its idea files back and the entry
disappears from `git stash list`.

### Phases
- [ ] Reconcile commits the corpus instead of stashing
      In `src/app/server/git.ts`, `reconcileOnto` calls `commitCorpus('docs(ideas): reconcile corpus')` before the rebase and no longer stashes; delete `stashDirtyPapercamp` and `StashPendingError` and every reference. `git.test.ts`: a dirty idea file survives a rebase as a commit on the branch, `git stash list` stays empty, and a dirty file outside `papercamp/` still makes the reconcile refuse.
- [ ] Stranded stashes in doctor and the git card
      A `stranded-stash` doctor rule listing `papercamp-reconcile` and `papercamp-sync` entries with date and `papercamp/` paths; `POST /api/git/stash-restore` restoring that stash's `papercamp/` files (tracked from the stash, untracked from its third parent), refusing differing files by name, dropping the entry when complete, and naming the non-`papercamp/` files it left; a row per stash in the git card with *Restore*. Route and rule tests, including the refuse path.

### Thread
- [x] 2026-11-14 [chat] Which git.ts function does phase 1 change, and does it touch runGitSync too?
- [x] 2026-11-14 [chat] [agent] Phase 1 changes `reconcileOnto` in `src/app/server/git.ts`: before the rebase it commits a dirty `papercamp/` with `commitCorpus('docs(ideas): reconcile corpus')`, and with the existing refusal for anything dirty outside `papercamp/` there is nothing left to stash, so `stashDirtyPapercamp` and `StashPendingError` get deleted. `runGitSync` is not changed — it already does the commit-first step (`commitCorpus('docs(ideas): sync corpus')`) and is the pattern phase 1 copies. The only knock-on is that `runGitSync`'s own leftover-stash handling stays as is; its `papercamp-sync` entries are just picked up by the phase 2 listing.
