---
id: IDEA-38
title: Dense plans worklist
---

## IDEA-38: Dense plans worklist

The Plans list spends ~280px of kraft card per plan (1.3rem serif title, rank number, status stamp, date, tags, progress bar), so a typical laptop window shows ~1.5 plans per screen; the ideas board wraps titles into a ~100px column while the right half of every row sits empty; and the sidebar repeats the exact same plans and ideas as a second, truncated list. The fix is one authority for lists, sized for scanning:

- **Plans become table rows, not cards.** Replace `list-view.tsx`'s stacked `PlanCard`s with paper-ui `Table` rows (+ `expandable`, as `plan-detail.tsx` already uses): FEAT-id `Stamp`, title, tags, updated, phase progress, status. Status edits inline via `TableCellDropdown` (in the package since the [[IDEA-32]] bump). The Table `toolbar` hosts Audit-all and the list/board toggle instead of the ad-hoc header row in `plans-page.tsx`.
- **Ideas join the same layout.** Rework `ideas-board.tsx`'s two-lane board into full-width rows in the same style, fixing the wrapped-title/empty-half problem; "Draft plan" stays a per-row action.
- **Closed plans get bounded.** `closed-section.tsx` dumps 40+ titles behind one toggle; add `Pagination` (also in the package now) or a windowed "show more".
- **The sidebar stops duplicating the list.** With a scannable table, `plans-sidebar.tsx`'s In progress/Planned/Ideas/Backlog item lists are redundant — their removal was explicitly deferred out of [[IDEA-34]] to this idea. Replace them with section filters plus counts, or drop the Plans sidebar entirely (Docs and Settings keep theirs — those are real section navigation).
- **Plan detail compresses its preamble.** `plan-detail.tsx` stacks five metadata rows (status select, date+tags, clarify button, progress, agent select) before any content; fold them into a single header line and one meta line.

[[IDEA-34]]'s responsive shell (FEAT-33) and the [[IDEA-32]] bump (FEAT-34) have both landed — no blockers left.
