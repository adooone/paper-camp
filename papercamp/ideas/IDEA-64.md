---
id: IDEA-64
title: Sort the worklist by column header
type: feat
status: review
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

### Phases
- [x] Resolve the `created` key with no column
      `sortKey` covers `status`/`updated`/`created`/`title`/`id`/`progress` but no column maps to `created` and the actions column isn't sortable. Decide before wiring: drop `created` from the key union (and any callerless references) so every key reaches a header, or surface `created` as a column. Default to dropping unless there's a reason to show it.
- [x] Confirm paper-ui `Table` header support
      Read the real `Table` source + showcase in the paper-ui sibling repo (`~/dev/paper-ui`), not just the `.d.ts`, to find how header cells render and whether they take arbitrary content / render props — so the header buttons and `aria-sort` sit on the supported seam rather than a hand-rolled header.
- [x] Make the header labels sortable buttons
      In `worklist-rows.tsx`, turn each sortable column label (`Id`/`Title`/`Updated`/`Progress`/`Status`) into a real `<button>` that calls `setPlanSortKey`, or `togglePlanSortDirection` when it's already the active key. No handlers on plain text.
- [x] Add the active-key caret and `aria-sort`
      Show a caret on the sorted column reflecting `sortDirection` (the only ordering signal now the `Select` is gone), and set `aria-sort` on the active column so keyboard/AT users see the state. Non-sorted columns carry no caret and no `aria-sort`.
- [x] Gate: checks plus click each column
      Run `tsc --noEmit`, `npx biome check .`, and `pnpm test`, then click each sortable header once to sort and again to flip. Sort behaviour is unchanged from the old `Select`, so this is the acceptance gate.
