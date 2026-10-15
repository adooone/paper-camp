---
id: IDEA-297
title: A compact Deliver footer
type: feat
status: review
created: 2026-10-15
tags:
  - app
  - ui
  - plans
  - git
subject: App UI
order: 6
---

The Deliver footer under an idea's phases is taller than the work it reports.
It stacks a row of six check stamps (*types*, *lint*, *test*, *build*,
*Consistency*, *Docs*) and the stash surface, then either the commit form or a
"No changed files." line, then three sync buttons (*Sync to main*, *Push*,
*Pull*). It reserves `min-h-[7rem]` even when nothing has changed. Most of the
time the reader only wants to know whether everything is green and whether
there is something to push. The Git page header carries the same pieces in its
own arrangement (`GitSyncActions`, `GitStashSurface`, a branch line), so the two
places that deliver work look and behave differently. *Sync to main* is no
longer needed anywhere: the Git page's branch list is where switching branches
happens.

**One row, two at most.** The footer becomes a single 40px row, left to right:
- the **check status** label, then a muted state line (*Up to date with
  origin*, *3 commits ready*, or *4 files changed*)
- a spacer
- **Push**, a primary button with the up-arrow icon reading *Push 3* with the
  count of commits ahead. It shows only when `gitAhead > 0`.
- **Pull**, a ghost icon button with the down-arrow icon, labelled *Pull* for
  screen readers and in its tooltip. It is always present.

When the working tree has changes, a second row holds the commit form: the
title input taking the width, the suggest-message icon button, and *Commit*.
`CommitMessageFields` and `DeliverCommitButton` are reused unchanged. The
`min-h-[7rem]` reservation goes, so the footer is one row clean and two rows
dirty, and never anything in between.

**One status label for every check.** The six stamps collapse into one stamp
that summarises the project's configured desk checks plus the Docs findings:
- *Checks passing* (success) when all pass
- *N checks running…* (warning) while any run, with the ellipsis slot reserved
  so the width holds
- *lint failing · 1 of 6* (error) naming the first failing check, and
  *2 of 6 failing* when more than one fails
- *Checks not run* (neutral) when every check is stale

When a check fails, a *Fix* button sits right after the label, running the
existing `fixCheck` flow. *Auto-fix* takes its place when the failing check has
a `fixCmd`.

**The label opens every check.** Clicking the status label opens a paper-ui
`Menu` anchored to it, with one row per check in manifest order: the status
dot, the name, and its action (*Run*, or *Auto-fix* for a failing check with a
`fixCmd`). A last *Run all* row runs every check. The *Docs* row reads *no
findings* or *3 findings*. Choosing it when it has findings toggles the
existing findings list under the footer, so `DeliverChecksRow`'s docs behaviour
carries over. The "The lint check failed." sentence and the separate fix
stamps go; the label and the *Fix* button carry that now.

**One component, both pages.** The bar is a shared `DeliverBar` in
`src/app/components/git/`, with the same status label, menu, Push, Pull and
commit row wherever it appears. It is a footer on both pages, so delivering
always means looking down:
- **Idea page:** the footer of the phases table, as now. Not sticky, since the
  phases card already fits on screen.
- **Git page:** a footer pinned to the bottom of the page column
  (`sticky bottom-0`) while the diffs or history scroll above it. It takes the
  card surface the idea-page footer uses, with a top border so it reads as
  separate from the scrolling content. The page reserves bottom padding equal
  to the bar's height (40px, 80px with the commit row), so the last diff or
  history row never sits under it. The state line names the branch
  (*main · 3 commits ready*). The title row keeps only *Git* and the stash
  surface; `GitSyncActions` leaves it.

`DeliverChecksRow` is rewritten as the status label and its menu inside
`DeliverBar`, keeping `useDeliverChecksRow` as its data source.

**Sync to main goes.** `GitSyncActions` and its *Sync to main* button are
deleted, along with `DeliverEmptyState` and the sync call path that only they
used (`runGitSync` stays only if something else still calls it). The stash
surface stays on the Git page only, beside its title, since a parked stash is
rare and belongs with the full git view.

**Switching branches on the Git page.** With *Sync to main* gone, the Branches
list in the Git sidebar becomes where branches change. Clicking a branch row
checks it out through a new `POST /api/git/checkout` (`{ branch }`), which runs
`git checkout <branch>` in the git manager and answers 409 with a reason when
the working tree has changes or the branch doesn't exist. The list only shows
on a clean tree already, so a dirty checkout is a server-side guard, not a UI
state. The current branch's row isn't clickable. A branch named for an idea or
ticket keeps that link as a small id stamp at the row's end, which opens the
entity without checking anything out. After a checkout the git status, the
branch list, the history and the plans reload, and a toast names the branch.

Done when the idea page and the Git page show the same bar, the clean bar is
one row with a single green label and the Pull icon, a failing check reads as
one red label with Fix beside it, every check is one click away in the label's
menu, *Sync to main* is gone, and a branch is switched from the Git page's
branch list.

### Out of scope

The rest of the Git page's layout. Adding or editing checks (Project › Settings › Desk).
The commit form's fields.

### Phases
- [x] Collapse the check stamps into one status label
      Summary stamp with passing, running, failing and not-run states, Fix or
      Auto-fix beside it on a failure, and the menu of every check with Run,
      Run all and the Docs findings toggle.
      run: 8m39s · 114 in · 27.1k out · sonnet-5 · sess:0a6a28be-5f22-49ea-9fd1-cf53757e7899
- [x] Lay the footer out as one row with Push and Pull
      Status, state line, Push button with the ahead count and the Pull icon
      button; the commit form as a second row only when there are changes;
      min-height reservation removed.
      run: 3m38s · 64 in · 16.1k out · sonnet-5 · sess:0a6a28be-5f22-49ea-9fd1-cf53757e7899
- [x] Put the same bar on the Git page and remove Sync to main
      `DeliverBar` shared in `components/git/`, rendered as the idea page's
      phases footer and as the Git page's sticky footer with its bottom
      padding; `GitSyncActions` leaves the title row; delete
      GitSyncActions, DeliverEmptyState and the unused sync path; stash stays on
      the Git page only; tests updated.
      run: 8m45s · 164 in · 36.5k out · sonnet-5 · sess:cd265b22-8420-4e65-82cd-e13f6ade5ca4
- [x] Switch branches from the Git page's branch list
      `POST /api/git/checkout` refusing a dirty tree or unknown branch; branch
      rows check out on click, the current one inert, idea and ticket ids as a
      small stamp that opens the entity; reloads and a toast after switching.
      run: 4m45s · 98 in · 13.6k out · sonnet-5 · sess:f6411f77-62fc-496f-9adb-3156c6480b40
