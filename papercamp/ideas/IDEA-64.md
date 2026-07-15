---
id: IDEA-64
title: Sort the worklist by column header
type: feat
status: idea
created: 2026-07-15
tags:
  - app
  - plans
  - ui
---

The sort control was a `Select` of six keys plus a direction toggle, parked in the plans header — a second, abstract copy of the column names the table already shows. It's been removed. Sorting should live where the data is: click `Id` / `Title` / `Updated` / `Progress` / `Status` in the worklist header to sort by it, click again to flip direction.

The state and the sort itself already exist and are untouched — `PlanListFilters.sortKey`/`sortDirection`, the `setPlanSortKey`/`togglePlanSortDirection` store actions, and the comparators in `selectWorklistRows`. Both actions are currently callerless: this idea is the wiring, not new logic.

- **Make the header cells the control.** `worklist-rows.tsx` renders the header row through paper-ui's `Table`; the labels need to become buttons that call `setPlanSortKey` (or `togglePlanSortDirection` when already the active key). Check `Table` for header-cell/render support before hand-rolling a header — see the paper-ui sibling repo, not just the `.d.ts`.
- **Show the active key and direction.** A caret on the sorted column, since without the Select there's no other signal for how the list is ordered.
- **Only the columns that map to a key.** `sortKey` covers `status`, `updated`, `created`, `title`, `id`, `progress`. `created` has no column and the actions column isn't sortable — either surface `created` somewhere or drop it from the key union rather than leaving a key nothing can reach.
- **Keyboard and a11y.** Real `<button>`s in the header cells with `aria-sort` on the column, not click handlers on text.

Follows the same instinct as removing the "needs review" section: fewer abstract controls stacked above the list, more acting directly on what's shown. Behaviour of the sort is unchanged, so the check suite plus clicking each column is the gate.
