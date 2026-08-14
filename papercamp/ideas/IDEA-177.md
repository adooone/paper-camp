---
id: IDEA-177
title: Surface dangling stashes
type: feat
status: idea
created: 2026-08-14
updated: 2026-08-14
tags:
  - app
  - git
  - ux
subject: Run & monitor
---

Paper-camp creates stashes and then forgets them. This repo currently holds six,
four of paper-camp's own making:

```
stash@{0}  On feat/idea-170-…             papercamp-sync
stash@{1}  WIP on fix/idea-134-…
stash@{2}  On refactor/idea-111-…         papercamp-sync
stash@{3}  On fix/idea-83-…               papercamp-sync
stash@{4}  On fix/idea-66-…               sync-idea-66: uncommitted work before switching to main
stash@{5}  WIP on feat/feat-24-…
```

Three `papercamp-sync` entries and one `sync-idea-66` were written by
`runGitSync`. Each is a sync whose pop failed, leaving real work parked. Nothing
in the app has ever mentioned them.

### The gap is durability, not detection

Sync already detects it. `runGitSync` returns `stashPending: true` with a clear
message — *"Synced to main, but restoring your changes hit a conflict … the
originals are still in `git stash`"* — plus a `recoveryPrompt` from
`buildGitSyncRecoveryPrompt`.

But that lives only in the sync call's response. Navigate away, reload, or come
back tomorrow and nothing remembers. The stash from stash@{3} dates to
`fix/idea-83`; the app has been through hundreds of loads since without ever
saying so.

### Surface it

`GET /api/git/status` gains a `stashes` array — index, branch, message, and age
per entry, parsed from `git stash list`. It is a cheap local call and the
endpoint is already polled.

Render it where git hygiene already lives, beside `branchHygiene`: on the `/git`
page and in the Deliver section. A stash is not an error, so the resting state is
informational — *"3 stashes"* — and it escalates to a warning when any entry is
paper-camp's own (`papercamp-sync` / `sync-…` prefix), because those mean a sync
pop failed and work is parked rather than a human deliberately setting something
aside.

The warning names the recovery that actually works, and offers `git stash show
-p stash@{N}` per entry so a stash can be inspected without leaving the app.

**Read-only.** No apply, pop, or drop from the UI. Popping a stash is how this
mess is made; the app surfaces the state and the human chooses. Age matters more
than count — a stash from today is a live conflict, one from `feat-24` is
sediment — so entries show their age and sort newest first.

### Why it earns a place

Six stashes accumulated invisibly across the project's whole history, and the
one that mattered was found only because someone went looking after a failure.
Anything paper-camp parks on your behalf should be visible until you deal with
it.

Pairs with [[IDEA-176]], which stops sync putting the corpus in a stash at all.
This one is the safety net for the times it still happens.

### Out of scope

Stash management (apply/drop/pop). Stashes created outside paper-camp are listed
but never flagged — a human WIP stash is not a problem to solve.
