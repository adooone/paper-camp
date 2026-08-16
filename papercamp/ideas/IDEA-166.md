---
id: IDEA-166
title: Readable diffs on the git page
type: feat
status: idea
created: 2026-08-13
updated: 2026-08-14
tags:
  - app
  - git
  - ui
subject: App UI
---

The diff renders at a prose line-height, has no line numbers and cannot be
collapsed, so reviewing anything past a couple of files is impractical.

**Line-height 2.51.** Measured on the running page: 12.75px mono text at 32px
line-height. The `<pre>` in `file-diff-section.tsx` sets `text-2xs` but no
`leading-*`, so it inherits from paper-ui's `<main class="layout-module__content">`
— body prose leading, applied to code. A three-file changeset of 121 diff lines
occupies 4,424px, five full screens. At a normal 1.4–1.5 that is roughly two
screens back on a tiny diff, and the saving scales with the diff. One class, and
the highest-impact change on the page.

**No line numbers.** Hunk headers give `@@ -8,7 +8,7 @@` and the lines
themselves carry nothing. Add an old/new gutter per line, dimmed and
non-selectable so copying a hunk still yields valid patch text.

**No collapse.** Every file renders fully expanded, an untracked 110-line file
included — untracked content arrives as `contentKind: 'raw'` and is rendered
whole. Each `FileDiffSection` gets a collapsible header; files past a size
threshold start collapsed, and the sidebar's scroll-spy expands a file when you
jump to it.

**The commit control is five screens from the diff.** `GitActionsRow` and the
commit row are `position: static` at the top of the page; ten scroll ticks put
the Commit button at `top: -764`. You review the diff, then scroll all the way
back to act on it. The commit row becomes sticky under the page chrome, carrying
the staged count from [[IDEA-165]].

**Paths truncate at the wrong end.** The sidebar's three rows all read
`papercamp/…` — `papercamp/config.js…`, `papercamp/ideas/ind…`,
`papercamp/ideas/I…`. `text-ellipsis` cuts the tail, so the shared directory
prefix survives and the filename, the only distinguishing part, is lost. Render
the basename at full weight with the directory dimmed ahead of it, and truncate
the directory rather than the name. Same fix in the diff section's own
`FileHeader`.

**`CountBadge` is defined twice**, identically, in `git-file-list.tsx` and
`file-diff-section.tsx`, differing only by a `shrink-0`. Extract it.

One of three slices over `features/git/`, shippable in this order: **[[IDEA-166]] (this) → [[IDEA-167]] → [[IDEA-165]]**. This one first because the line-height fix is a single class that makes every later change to the page reviewable; 167 then adds the status vocabulary that 165's partial-staging display depends on.

### Phases
- [x] Set a code line-height on the diff `<pre>`
      Add a `leading-*` class so mono text stops inheriting body prose leading.
      run: 28s · 5.6k in · 999 out · sonnet-5
- [x] Add old/new line-number gutters
      Dimmed and non-selectable so copied hunks stay valid patch text.
      run: 3m5s · 1.1k in · 5.1k out · sonnet-5
- [x] Make each `FileDiffSection` collapsible
      Collapsible header, files past a size threshold start collapsed, scroll-spy expands a file on jump.
      run: 4m7s · 663 in · 13k out · sonnet-5
- [ ] Stick the commit row under the page chrome
      Carry the staged count from [[IDEA-165]].
- [ ] Fix path truncation in the sidebar and `FileHeader`
      Full-weight basename, dimmed directory ahead of it, truncate the directory not the name.
- [ ] Extract the shared `CountBadge` component
