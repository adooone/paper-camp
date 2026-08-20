---
id: IDEA-194
title: Complete an idea without leaving
type: feat
status: done
created: 2026-08-19
updated: 2026-08-20
tags:
  - app
  - git
  - github
subject: Run & monitor
---

One action lands a finished idea: squash-merge its PR, return to a current
`main`, and leave the desk ready for the next one.

### Closing an idea today is six steps in three places

`Approve & close` writes `status: done` into the frontmatter and stops there. It
does not merge, does not switch branch, does not pull. The rest is manual and
happens somewhere else: open the PR on GitHub, squash-merge it, come back,
check out `main`, pull, and delete the branch nobody deletes.

Nothing in the codebase can merge a PR. The only `merge` is `--ff-only` in the
sync path; there is no `gh pr merge` anywhere.

### The gap between merging and resetting is where the damage happens

Every failure this project hits around branches lives in the window between a PR
merging and the local checkout catching up:

- `main` diverges, because a local bookkeeping commit sits unpushed while the
  squash lands upstream — a push then fails as non-fast-forward.
- A run starts from a stale base, which is the whole of [[IDEA-171]].
- A merged branch reads as unmerged, because squashing rewrites the SHA so
  `git branch --merged` can never see it. 97 local branches are in that state.

Doing the merge and the reset as one action closes the window instead of
managing what happens inside it.

### The action is offered when the work is actually finished

Approval is deliberately not a condition. Requiring one would send you to GitHub
to approve — where you could merge in the same click — leaving the button with
nothing left to offer. Clicking Complete *is* the approval. GitHub agrees: `main`
requires the Quality/Tests/Consistency checks and no approving review, so nothing
downstream rejects the merge.

A review that *requested changes* still blocks, which is not the same rule. An
absent review means nobody looked; a change request means someone looked and said
no. Findings usually become fixes, which the phase gate already catches, but not
reliably enough to leave the case unhandled.


Every phase and fix checked, a PR open to merge, CI green. All three are already
known to the app — they drive the phase table, the review thread and the Desk
checks — so completion confirms a state that is visible rather than asserting
one. When any is missing the action says which, rather than disappearing.

### What it does, in order

1. Squash-merge the PR through the runtime's authenticated `gh`.
2. Refuse to go further if the working tree is dirty, naming the uncommitted
   files. Landing the merge and then failing to switch is the worst outcome, so
   the tree is checked *before* the merge, not after.
3. Check out `main` and fast-forward it.
4. Delete the branch locally and on the remote.

Status needs no step of its own. `deriveStatus` already reads a merged PR with
everything checked as `done`, so the merge makes the status true rather than the
app asserting it — the same rule that governs every other entity.

### Squash, because that is what the history already is

Every idea lands as one commit named for the idea, which is what makes
`stamp-release` able to join a commit back to the entity that produced it. The
action inherits that; no merge-method choice is offered.

### Out of scope

Creating the PR, which the draft-PR workflow already handles. Any other merge
method. Reverting a completed idea. Cleaning up the branches that accumulated
before this exists.

### Phases
- [x] Gate completion on finished work
      Offer the action only when every phase and fix is checked, a PR exists and CI is green; name whichever is missing instead of hiding it.
      run: 2m32s · 6.4k in · 9.7k out · sonnet-5
- [x] Guard the working tree before merging
      Refuse when the tree is dirty, naming the uncommitted files, so the merge never lands ahead of a failed switch.
      run: 1m40s · 892 in · 4.5k out · sonnet-5
- [x] Squash-merge the PR through authenticated `gh`
      run: 2m16s · 4.7k in · 7.8k out · sonnet-5
- [x] Return to a current `main`
      Check out `main`, fast-forward it, and delete the branch locally and on the remote.
      run: 2m8s · 883 in · 8.2k out · sonnet-5
- [x] Wire the single action into the idea view
      Replace `Approve & close` with the merge-and-reset action and let `deriveStatus` carry the status change.
      run: 5m23s · 2.4k in · 21.2k out · sonnet-5
- [x] [manual] Report merged-but-unfinished when returnToMain fails

### Thread
- [x] 2026-08-20 [review] [agent] Comments · 2 findings — The diff cleanly delivers the five phases: a completion gate that recomputes from raw phase/fix/PR/CI state, a working-tree guard thrown before the merge, an authenticated `gh pr merge --squash`, a return-to-main routine, and the wired-in idea-view action replacing `Approve & close`. Test coverage is thorough and the ordering guarantee the spec insists on (check tree before merge) is respected. The main risk is that `returnToMain` uses `--ff-only` against `origin/main`, which fails *after* the merge has already landed if local `main` has diverged — precisely the split-main condition this repo is known to hit.
