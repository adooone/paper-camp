---
id: IDEA-281
title: Adopt paper-ui's rows and sidebars
type: refactor
status: review
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
- [x] Swap the local sidebar kit and settings rows for the library's
      Delete the four `sidebar-*.tsx` files, `setting-row.tsx` and `SETTING_ROW_GRID_CLASS`, then rebuild each settings section as a `SettingGroup`.
      run: 5m31s · 168 in · 35.4k out · sonnet-5 · sess:7e9fcd97-3e6c-41ca-822b-56985a0ca951
- [x] Drop the table overrides and hand-rolled disclosures
      run: 3m55s · 94 in · 13.6k out · sonnet-5 · sess:d2016cc8-d989-4a4b-91c1-829dcc1231f6
- [x] Trim `utilities.css` down to the `--pc-*` layout variables and the run-meta container query
      run: 3m11s · 46 in · 17.2k out · sonnet-5 · sess:d2016cc8-d989-4a4b-91c1-829dcc1231f6

### Fixes
- [ ] Bump to the paper-ui release carrying the parity fixes, and use the final forms
      The fixes above were written with "until paper-ui ships it" fallbacks; paper-ui 0.22.2 shipped most of them and the next release the rest. Bump to that release first, then apply each fix in its final form — the library prop, never the fallback — and delete every fallback that a previous run left in place.
- [ ] The log list gets fixed columns back
      `run-row.tsx`'s `Row` template is `100px 128px minmax(0,1fr) 100px 72px 84px` with the Type stamp in its own cell, Time/Agent/Duration as handwritten 14px at .55, and the header sharing the template; `id: 'auto'` is never used, since each `Row` is its own grid. The worklist header gets Updated and Progress their own 64px and 52px cells.
- [ ] Roadmap rows keep stamp before progress, and the whole item highlights
      `roadmap-item-row.tsx` and `standing-concern-row.tsx` templates are `minmax(0,1fr) 6rem 8rem` with the state stamp in the 6rem cell; the progress line is handwritten 12px at .70; no horizontal padding inside the accordion title; `highlighted` outlines the wrapper around the whole item, not the title row.
- [ ] Plan rows keep their responsive drop and fix rows their own grid
      `plan-rows.tsx` hides the Updated column below `lg` (a `hideBelow` on the column once `Row` has it, a `max-lg:` class until then) and stacks at 480px; fix rows return to `76px minmax(0,1fr) 92px` with `fix.idea` in the title as mono xs at .45; em-dash placeholders are serif 16px at .30.
- [ ] Sidebar cards do not compress, and the git file's active state is the green wash
      Every `SidebarCard` passes `className="shrink-0"`; `git-file-list.tsx` marks the active file with `Row active` once it exists, `ListItem active` until then, never the amber `highlighted`.
- [ ] The checks row keeps disabled, tooltips, aria-controls and the phone prefix
      `deliver-checks-row.tsx` stamps pass `disabled` (not `pointer-events-none`) and `aria-controls`; `StampButton`'s chalkboard `Tooltip` is restored around the stack-panel stamps; `commit-history.tsx` shows `· prefix` in the meta line below 640px again.
- [ ] The bare `CommandLine` stays bare
      `runtime-unavailable`, `relay-fallback-guide`, `connect-action-view` and `add-machine-footer` render the unboxed command with wrapping code and no prompt glyph, through paper-ui's `boxed={false}` once it ships and a local wrapper until then.

### Thread
- [x] 2026-09-23 [question] [agent] Run-all parked on phase 3 ("Swap the local sidebar kit and settings rows for the library's") — the agent needs a decision: paper-ui's `SidebarItem` (the IDEA-5 spec, confirmed against `~/dev/paper-ui`'s source and showcase) only takes `icon`, `count`, `note`, `busy`, `tone`, `disabled` — it has no `active`/selected state (ListItem's blob-fill highlight is gone entirely) and no free-form `action` slot. Six current `ListItem` + `pc-row` call sites rely on exactly those two things: `docs-sidebar.tsx`, `settings-sidebar.tsx`, `plan-actions-column.tsx` (current-page/tab highlighting via `active`), and `roadmap-sidebar.tsx`, `plan-filter-column.tsx` (both `active` toggle-highlighting *and* an `action`/custom-content slot holding a count span or a `Stamp`). Converting them to `SidebarItem` as the phase literally instructs would silently drop the selected-item highlight from every sidebar nav list and drop the Stamp/count trailing content from the roadmap and plan filters. Should I (a) proceed and accept that loss as part of adopting the leaner library component, (b) keep `ListItem` (not `pc-row`) for these six active/action call sites and only convert the sidebar rows that don't need those two props, or (c) something else (e.g. simulate the selected state with a custom class using a `--pui-*` token)?
- [x] 2026-09-24 [chat] Decision: option (b), and the gap is fixed upstream. paper-ui's SidebarItem was specified without `active` and `action`; a fix on paper-ui IDEA-5 adds both, and the next paper-ui release will carry them. For this run: convert every sidebar row that needs neither prop to SidebarItem now; leave the six call sites that need `active` or an `action` slot on ListItem, keeping their `pc-row` class so nothing visibly changes, and note in the phase log that they wait on the SidebarItem fix. Do not drop a highlight or a trailing Stamp anywhere. Then continue to phase 4.
- [x] 2026-09-24 [chat] [agent] Got it — phase 3 stays scoped to the sidebar/settings kit swap, waiting on the paper-ui SidebarItem fix for the six active/action call sites. Continuing to phase 4.
- [x] 2026-09-24 [log] [agent] Chose option (b): convert sidebar rows to SidebarItem now, leave 6 active/action call sites on ListItem pending paper-ui's upcoming SidebarItem fix, then proceed to phase 4.
- [x] 2026-09-24 [log] [agent] Phase 5: deleted only the CSS that's actually dead — `.plan-row-card` (2 rules, superseded by `Row`) and `.pc-sidebar-card`/`.pc-setting-row` (unused since the sidebar-kit/`SettingGroup` swap). Kept `.pc-row`/`.pc-row-label` since the 6 call sites from the phase-3 decision above are still on `ListItem` pending the SidebarItem fix — deleting their styling now would break those sidebars. Also kept `header[class*="headerActions"]`, the phone-width IconButton/Checkbox tap-target bump, `.pc-app-header`, `.pc-git-file-row`'s Checkbox resize, and `.archive-row-action` — none of these are Row/sidebar/SettingRow/table leftovers from this idea; they're live workarounds for other paper-ui components (Layout, Checkbox, IconButton, Button) outside this idea's scope, and removing them would break rendering with no replacement in this phase. `utilities.css` isn't literally down to just `--pc-*` vars and the run-meta query — flagging this gap for the human review pass.
