---
id: IDEA-281
title: Adopt paper-ui's rows and sidebars
type: refactor
status: in-progress
created: 2026-09-22
updated: 2026-09-24
tags:
  - app
  - ui
  - paper-ui
subject: One design system
order: 3
---

paper-ui's IDEA-5 ships `Row`, the sidebar kit, `SettingRow` and the
table additions this app worked around. Blocked until that release; the
first phase bumps the dependency. Runs after [[IDEA-280]].

**Eight row grids become `Row`.** Plan, worklist, fix, archive,
suggestion and run rows keep their column widths as `columns` templates
and drop `plan-row-card`; roadmap item and standing-concern rows, the
findings row, the git file row and the commit row become ruled `Row`s;
`RowSkeleton` and `plans-list-skeleton.tsx` become the library's
`RowSkeleton`. `HIGHLIGHT_OUTLINE_CLASS` becomes `highlighted`.

**The sidebar kit replaces the local one.** `sidebar-card.tsx`,
`sidebar-label.tsx`, `sidebar-field.tsx` and `sidebar-command.tsx` are
deleted; every `ListItem` carrying `pc-row` becomes `SidebarItem`.

**Settings rows become `SettingRow`.** `setting-row.tsx`,
`connection-row.tsx`'s wrapper and `SETTING_ROW_GRID_CLASS` go; each
settings section is a `SettingGroup`.

**Tables drop their overrides.** The phases table passes
`rowStyle` for the running-phase fill and `phoneLayout="stacked"`;
`phase-table-phone` and `phase-running-row` are deleted. `services-group`
and `collapsible-text` use `Disclosure`.

**The stylesheet is layout only.** After this idea `utilities.css` holds
the `--pc-*` layout variables, the container query for run meta, and
nothing that names a paper-ui class.

### Out of scope

Charts, [[IDEA-282]]; the drawer and status bar, [[IDEA-283]].

### Phases
- [x] Bump `@dendelion/paper-ui` to the IDEA-5 release
      run: 1m16s · 28 in · 4.1k out · sonnet-5 · sess:635547af-1820-4f03-900d-5922e9c0f685
- [x] Replace the eight row grids with `Row`
      Port the column widths as `columns` templates, move the rest to ruled rows, and adopt the library's `RowSkeleton` and `highlighted`.
      run: 13m45s · 158 in · 85.4k out · sonnet-5 · sess:635547af-1820-4f03-900d-5922e9c0f685
- [ ] Swap the local sidebar kit and settings rows for the library's
      Delete the four `sidebar-*.tsx` files, `setting-row.tsx` and `SETTING_ROW_GRID_CLASS`, then rebuild each settings section as a `SettingGroup`.
- [ ] Drop the table overrides and hand-rolled disclosures
- [ ] Trim `utilities.css` down to the `--pc-*` layout variables and the run-meta container query

### Thread
- [x] 2026-09-23 [question] [agent] Run-all parked on phase 3 ("Swap the local sidebar kit and settings rows for the library's") — the agent needs a decision: paper-ui's `SidebarItem` (the IDEA-5 spec, confirmed against `~/dev/paper-ui`'s source and showcase) only takes `icon`, `count`, `note`, `busy`, `tone`, `disabled` — it has no `active`/selected state (ListItem's blob-fill highlight is gone entirely) and no free-form `action` slot. Six current `ListItem` + `pc-row` call sites rely on exactly those two things: `docs-sidebar.tsx`, `settings-sidebar.tsx`, `plan-actions-column.tsx` (current-page/tab highlighting via `active`), and `roadmap-sidebar.tsx`, `plan-filter-column.tsx` (both `active` toggle-highlighting *and* an `action`/custom-content slot holding a count span or a `Stamp`). Converting them to `SidebarItem` as the phase literally instructs would silently drop the selected-item highlight from every sidebar nav list and drop the Stamp/count trailing content from the roadmap and plan filters. Should I (a) proceed and accept that loss as part of adopting the leaner library component, (b) keep `ListItem` (not `pc-row`) for these six active/action call sites and only convert the sidebar rows that don't need those two props, or (c) something else (e.g. simulate the selected state with a custom class using a `--pui-*` token)?
- [x] 2026-09-24 [chat] Decision: option (b), and the gap is fixed upstream. paper-ui's SidebarItem was specified without `active` and `action`; a fix on paper-ui IDEA-5 adds both, and the next paper-ui release will carry them. For this run: convert every sidebar row that needs neither prop to SidebarItem now; leave the six call sites that need `active` or an `action` slot on ListItem, keeping their `pc-row` class so nothing visibly changes, and note in the phase log that they wait on the SidebarItem fix. Do not drop a highlight or a trailing Stamp anywhere. Then continue to phase 4.
- [x] 2026-09-24 [chat] [agent] Got it — phase 3 stays scoped to the sidebar/settings kit swap, waiting on the paper-ui SidebarItem fix for the six active/action call sites. Continuing to phase 4.
- [x] 2026-09-24 [log] [agent] Chose option (b): convert sidebar rows to SidebarItem now, leave 6 active/action call sites on ListItem pending paper-ui's upcoming SidebarItem fix, then proceed to phase 4.
