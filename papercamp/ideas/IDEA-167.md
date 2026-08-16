---
id: IDEA-167
title: Git status vocabulary and chrome
type: fix
status: review
created: 2026-08-13
updated: 2026-08-14
tags:
  - app
  - git
  - ux
subject: App UI
order: 4
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

One of three slices over `features/git/`: [[IDEA-166]] → **[[IDEA-167]] (this)** → [[IDEA-165]]. Carrying `status` onto `FileDiffEntry` here is what lets [[IDEA-165]] render a partially-staged file, so this lands before it.

### Phases
- [x] Carry `status` through the diff model onto `FileDiffEntry`
      Thread git's two-character code from `/api/git/status` into the entry the diff model builds.
      run: 55s · 5.7k in · 3.1k out · sonnet-5
- [x] Render a per-file status marker in the sidebar and diff header
      Use git's own A/M/D/?? letter vocabulary, matching the `renameSource` treatment already in place.
      run: 2m11s · 520 in · 8.1k out · sonnet-5
- [x] Add page and per-file headings plus a labelled nav list
      An `h1` for the page, a heading one level down per file section, and the changed-files sidebar as a navigation landmark.
      run: 2m59s · 528 in · 14.5k out · sonnet-5
- [x] Replace the breadcrumb with a page title
      run: 40s · 236 in · 2.1k out · sonnet-5
- [x] Re-weight the action buttons: Push primary, Sync and Pull secondary
      run: 31s · 240 in · 1.6k out · sonnet-5
- [x] Fix the status-bar branch glyph and migrate the inline styles
      Swap `⌥` for `GitBranchIcon`, move the thirteen static layout styles to Tailwind, and narrow the guard allowlist to the texture alone.
      run: 2m16s · 522 in · 10.5k out · sonnet-5
- [x] Give loading and failure states a retry affordance
      run: 1m27s · 383 in · 5.3k out · sonnet-5

### Thread
- [x] 2026-08-16 [review] [agent] Comments · 1 finding — Phases 2–7 are delivered cleanly: the status marker, semantic headings/nav, dropped breadcrumb, re-weighted buttons, branch-glyph fix, inline-style migration, and retry affordances all match the spec, and tsc plus the inline-styles guard test pass. Phase 1 ("Carry status through the diff model onto FileDiffEntry") is a no-op box-check — its commit changed only the idea markdown because FileDiffEntry.status already existed on main (added upstream by IDEA-165 #160) and getWorkingDiff already populated it. Nothing is broken; the marker reads a field that is genuinely present and populated.
