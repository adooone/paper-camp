---
id: IDEA-281
title: Adopt paper-ui's rows and sidebars
type: refactor
status: idea
created: 2026-09-22
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
