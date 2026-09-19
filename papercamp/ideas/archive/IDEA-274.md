---
id: IDEA-274
title: Commit history on a clean tree
type: feat
status: done
created: 2026-09-19
updated: 2026-09-19
tags:
  - app
  - server
  - git
  - ui
subject: App UI
order: 1
---

With nothing changed, the Git page is a sidebar saying so and a main column
saying *No changed files.* — a whole screen that answers nothing. The
question a clean tree actually raises is what is on this branch and what
has not been pushed, and today the only answer in the app is the status
bar's `↑1`, a count with no commits behind it.

**The clean state shows the branch's history.** When `files.length === 0`,
`git-page.tsx` renders a `CommitHistory` view in place of the `EmptyState`;
with any changed file the diff view is exactly as it is now. The header
gains one muted line on the right, the branch in mono and *1 ahead of
origin* from the `ahead` the status route already returns.

**One rail, newest first.** The history is the current branch's
first-parent line — `git log --first-parent` — so it is a single vertical
rail and never a branching graph; trunk work with squash merges is one
line anyway. The rail and its dots are drawn with `roughGenerator`, the
same generator the charts use, inside one parchment `Card`, rows separated
by the sketch `Divider`.

**A row is a subject, a meta line, and stamps.** The title is the commit
subject with its conventional prefix removed; the prefix moves to the
handwritten meta line beside the short hash in mono and the relative
time, so `fix(app): Redesign night report` reads *Redesign night report*
over `b11bf121 · fix(app) · 1 minute ago`. On the right, `Stamp`s for what
git already knows: a success stamp per release tag, a neutral stamp where
`origin/<branch>` sits, and an info stamp for the idea named by the
commit's `Refs:` trailer, which navigates to that idea. Rows are not
otherwise clickable.

**Unpushed commits stand apart.** Every commit above the remote marker has
a hollow dot, a dashed rail segment, and a warning *not pushed* stamp. A
branch with no upstream marks every commit that way and shows no remote
stamp.

**The server reads it in one call.** `GET /api/git/log?skip=<n>` runs one
`git log --first-parent -n 30 --skip=<n>` with a `%x1f`-separated format
of hash, subject, committer date, decorations and the `Refs` trailer, and
returns `{ commits, upstream, hasMore }`, each commit carrying `hash`,
`subject`, `prefix`, `date`, `tags`, `isUpstreamHead`, `pushed` and
`ideaId`; `pushed` comes from `git rev-list <upstream>..HEAD`. The parser
lives in `src/core/git-log.ts` with its tests. The view loads the first 30
on mount and after every commit, push, pull and sync, and *Show older*
under the card appends the next 30 while `hasMore` holds.

### Out of scope

Opening a commit's diff. Other branches, merge parents, and any graph
beyond the one rail. Acting on a commit — revert, reset, cherry-pick.

### Phases
- [x] Parse the first-parent log in core
      Extend `src/core/git-log.ts` with the `%x1f` format, decoration and prefix
      splitting, and `pushed` from `rev-list`, covered by `git-log.test.ts`.
      run: 2m19s · 22 in · 11.9k out · sonnet-5 · sess:238d7a7e-3917-4545-822b-6dce383de951
- [x] Serve `GET /api/git/log?skip=<n>`
      Add the route to `src/app/server/routes/git.ts` returning
      `{ commits, upstream, hasMore }`, and the fetcher in `git-api.ts`.
      run: 1m1s · 30 in · 3.3k out · sonnet-5 · sess:238d7a7e-3917-4545-822b-6dce383de951
- [x] Draw the rail and commit rows
      A `CommitHistory` view with `roughGenerator` rail, dots, dashed unpushed
      segments, and the subject / meta / `Stamp` row.
      run: 5m30s · 78 in · 16.7k out · sonnet-5 · sess:238d7a7e-3917-4545-822b-6dce383de951
- [x] Show history on a clean tree
      Swap the `EmptyState` in `git-page.tsx`, add the branch and ahead line to
      the header, reload after commit, push, pull and sync.
      run: 3m55s · 92 in · 13.3k out · sonnet-5 · sess:fdc58dce-e279-4cce-82c4-8024705653eb
- [x] Append older commits
      Wire *Show older* to the next `skip` page while `hasMore` holds.
      run: 2m14s · 46 in · 6.2k out · sonnet-5 · sess:fdc58dce-e279-4cce-82c4-8024705653eb
