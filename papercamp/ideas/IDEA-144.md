---
id: IDEA-144
title: Changes page in Plans style
type: fix
status: idea
created: 2026-08-07
tags:
  - app
  - ui
  - git
subject: Planning surface
---

The Changes page (`/diff`, [[IDEA-110]]) doesn't speak the desk's layout
language: its file list is a sticky 288px column *inside* the content
area, and every file renders as its own separate Card — a stack of boxes
where every other page is one paper sheet. Review findings (2026-08-07)
and the restructure, settled:

1. **File list moves to the real left sidebar.** Same slot and frameless
   desk-background treatment as the Plans filter column ([[IDEA-134]]),
   with the staged stamp and +/− counts kept per row, and a scroll-spy
   active state — the list currently gives no indication of which file
   you're reading.

2. **One paper page for all diffs.** File sections with a header row
   (path, rename arrow, staged stamp, counts) separated by dividers
   inside a single page card — not one Card per file. Binary, too-large,
   and rename-only states carry over unchanged; they're good.

3. **Code never escapes the page.** Each hunk scrolls horizontally
   inside the page (`min-w-0`/`max-w-full` chain down to the `pre`,
   which keeps `overflow-x-auto`) — a long line must never widen or
   overflow the sheet. The clamp is applied as an interim fix on the
   current cards; the redesign keeps it structurally.

4. **Diffs go live.** The page fetches once on mount and never again —
   stale the moment an agent writes a file. Refetch on the activity
   stream tick, debounced like every other listener, plus on window
   focus (the [[IDEA-134]] remote-liveness pattern).

### Thread
- [x] 2026-08-07 [decision] The Changes page adopts the Plans grammar — sidebar in the shell, one sheet of content. Per-file Cards and the in-content sticky column are removed, not restyled.
