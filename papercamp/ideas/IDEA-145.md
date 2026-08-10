---
id: IDEA-145
title: Changes page in Plans style
type: fix
status: idea
created: 2026-08-07
tags:
  - app
  - ui
  - git
subject: App UI
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

3. **Code never escapes the page.** Long lines currently overflow past
   the container so the line can't be read. Constrain the width chain
   (`min-w-0`/`max-w-full`) down to each hunk's `pre`, which keeps
   `overflow-x-auto` — a hunk scrolls horizontally inside the page and
   never widens the sheet.

4. **Diffs go live.** The page fetches once on mount and never again —
   stale the moment an agent writes a file. Refetch on the activity
   stream tick, debounced like every other listener, plus on window
   focus (the [[IDEA-134]] remote-liveness pattern).

### Phases
- [x] Move the file list into the left sidebar
      Frameless desk-background slot like the Plans filter column, keeping the staged stamp and +/− counts per row.
      run: 4m26s · 5.8k in · 17.8k out · opus-4-8
- [x] Add scroll-spy active state to the file list
      Highlight the row for the file currently in view as the sheet scrolls.
      run: 1m38s · 233 in · 6k out · opus-4-8
- [ ] Render all diffs in one paper page
      File sections divided by rules with a path/rename/stamp/counts header row; keep the binary, too-large, and rename-only states.
- [ ] Constrain the hunk width chain so code stays inside the sheet
      Thread min-w-0/max-w-full down to each hunk pre so it scrolls horizontally instead of widening the page.
- [ ] Refetch diffs live
      Debounced refetch on the activity stream tick plus window focus.

### Thread
- [x] 2026-08-07 [decision] The Changes page adopts the Plans grammar — sidebar in the shell, one sheet of content. Per-file Cards and the in-content sticky column are removed, not restyled. Captured as findings only; no direct edits shipped with the review.
