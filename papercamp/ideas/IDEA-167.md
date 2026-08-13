---
id: IDEA-167
title: Git status vocabulary and chrome
type: fix
status: idea
created: 2026-08-13
updated: 2026-08-13
tags:
  - app
  - git
  - ux
subject: App UI
---

The git page never says what happened to a file, and the chrome around it
misstates where you are.

**No A/M/D/?? anywhere.** `FileDiffEntry` carries `path`, `staged`, `binary`,
counts, `contentKind` and `patch` — no status. Added, modified, deleted and
untracked files render identically in the sidebar and in the diff header. The
data already exists: `/api/git/status` returns git's two-character code (`" M"`,
`"??"`), and the diff model drops it. Carry `status` onto `FileDiffEntry` and
render a per-file marker in both places, using the same letter vocabulary git
uses so the reading transfers straight to the terminal. This is also the field
[[IDEA-165]]'s partially-staged display depends on.

**Rename is the one case already handled** — `renameSource` renders `old → new`
and distinguishes "renamed, no content changes" from "renamed with unrelated
content — diff omitted". That is the standard the other statuses should meet.

**Zero headings on the page.** No `h1`; each `[data-diff-path]` is a bare `div`
and its path a `span`. A screen reader gets an unstructured run of text with no
way to move between files. The page takes a real heading, each file section
becomes a heading one level down, and the changed-files sidebar becomes a
labelled navigation list.

**The breadcrumb asserts a hierarchy that doesn't exist.** "Plans › Git" — git
is not under Plans, and you arrive from the status bar's git icon, not from the
Plans page. Clicking "Plans" is a lateral jump dressed as "up". Drop the
breadcrumb; the page gets a title instead.

**Three equal-weight primary buttons, most dangerous first.** Sync to main, Push
and Pull are all plain `<Button>` — primary green — with Sync leftmost. Sync is
the most consequential of the three; on a dirty tree it launches an agent task.
Push stays primary, Sync and Pull become `variant="secondary"` per
CODE_STYLE §1.

**`⌥` is used as the branch glyph** in the status bar. That is the macOS Option
key symbol, not a branch. `GitBranchIcon` is imported in the same file and used
two elements away for the git button.

**`status-bar-core.tsx` is fourteen inline style objects** in a Tailwind
codebase. It is allowlisted in `inline-styles.guard.test.ts` with the reason
"paper-ui's `getTextureStyles()` has no className form" — true of exactly one of
them; the other thirteen are static layout. The guard's own comment restricts
opt-outs to "genuinely dynamic values that can't be a class". Migrate the
thirteen and narrow the allowlist entry to the texture alone.

**Loading and failure states are bare paragraphs.** "Couldn't load the
working-tree diff." offers no retry.
