---
id: IDEA-154
title: Git view replaces the toolbar's four actions
type: feat
status: review
created: 2026-08-11
tags:
  - app
  - git
  - ux
subject: App UI
---

The toolbar's `StatusBar` carries four full icon+label buttons — Sync,
Push, Pull, Commit (`status-bar-core.tsx`) — eating the bar's entire
right side. Changes, meanwhile, are reachable only one hop deep: the
`/diff` page ([[IDEA-145]]) has no nav entry at all, only a "N files
changed" link from whichever idea's Deliver panel happens to be open.
Both move into one new page.

1. **A new `/git` route holds the repo-wide git surface**: Sync/Push/
   Pull actions, a commit form (title + suggest-from-diff + Commit —
   the same shape as an idea's Deliver panel, just scoped to the whole
   working tree instead of one idea's branch), and the diff content
   `/diff` already renders (file-list sidebar + one paper page of
   hunks). `/diff` is absorbed into this route, not kept as a second
   destination.

2. **The toolbar drops to ambient status only.** Sync/Push/Pull/Commit
   leave `StatusBarCore` entirely; the toolbar keeps branch name and
   changed-file count as plain text, plus a small icon button (matching
   [[IDEA-153]]'s notification icon) that opens `/git`. Desk-scoped,
   this idea doesn't touch the embedded Scout panel's own top stripe —
   that surface already settled on status-only content in [[IDEA-147]].

3. **Per-idea Deliver is unaffected.** An idea's own commit flow
   ([[IDEA-146]], [[IDEA-151]]) still lives in that idea's Phases table
   footer, scoped to that idea's branch — `/git` is the repo-wide
   complement for git actions and changes with no specific idea open,
   not a replacement for it.

### Phases
- [x] Add the `/git` route and page shell
      Register the route and a nav entry; empty two-column layout matching the diff page.
      run: 3m27s · 10.9k in · 16.7k out · sonnet-5
- [x] Fold the diff content into `/git` and retire `/diff`
      Move the file-list sidebar and hunk page in; redirect or drop the old `/diff` route.
      run: 1m52s · 658 in · 7.7k out · sonnet-5
- [x] Add the repo-wide commit form to `/git`
      Reuse the Deliver panel shape (title + suggest-from-diff + Commit), scoped to the whole working tree.
      run: 2m35s · 529 in · 10.2k out · sonnet-5
- [x] Move Sync/Push/Pull actions onto `/git`
      run: 1m48s · 384 in · 5k out · sonnet-5
- [x] Strip the four actions from `StatusBarCore`
      Leave branch name and changed-file count as plain status text.
      run: 4m38s · 4.4k in · 14.3k out · sonnet-5
- [x] Add the toolbar icon button that opens `/git`
      Match [[IDEA-153]]'s notification icon.
      run: 3m22s · 3k in · 7.5k out · sonnet-5

### Thread
- [x] 2026-08-11 [decision] One new page absorbs both the toolbar's four action buttons and the orphaned `/diff` route; the toolbar becomes status-only. Per-idea Deliver keeps its own separate commit flow — this is the repo-wide surface, not a merge of the two.
