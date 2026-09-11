---
id: IDEA-253
title: Settings in the plans row grammar
type: refactor
status: idea
created: 2026-09-10
tags:
  - app
  - ui
  - settings
subject: App UI
order: 3
---

The settings page is the one surface that still looks like a form from
another app. Every section wraps its controls in one tall kraft `Card`
with `Divider`s inside — Project Info alone stacks name, icon, port, the
toolbar toggle, and seven agent rows into a single slab — while the Plans
page renders one thin `plan-row-card` per item with a small gap, so a list
reads as a list. Three titles land before the first control: the
breadcrumb, the "Settings" `PageTitle`, and the section's own `h2`. Inputs
sit at natural width on the left and leave the rest of the row empty.
Booleans are buttons with flipping labels — *Disable/Enable* for the dev
toolbar, *Don't show Setup on open* for the setup flag, *Yes/No* text in
Merge Policy — and only Release Please is a `Switch`. Desk repeats the
*Name / Command / Port* labels on every row, and each Setup connection is
a paragraph even when it is fine.

**One row grammar, taken from the plans list.** Every setting is one
`plan-row-card` (kraft, `size="small"`, `gap-1` between rows): the label
on the left, an optional hint in small muted text under it, and the
control right-aligned in a fixed 260px control column so controls line
up on one vertical line across sections. Groups are headed by the
handwritten group label the worklist uses for subjects
(`subjectHeaderClass`), never an `h3` plus a card. The section name
becomes the page's `h1` in the `PlansHeader` shape — title on the left,
the section's primary action inline on the right — and the "Settings"
`PageTitle` goes, since the breadcrumb already carries it. Three
components in `features/settings/components` carry this:
`SettingsHeader`, `SettingGroup` (label plus optional action slot,
mirroring `SidebarSection`), and `SettingRow` (label, hint, control). A
tabular group — the agent table, Desk services and checks — is a header
row card with handwritten column labels followed by one row card per
entry, exactly the worklist's header-then-rows shape, with unlabeled
small inputs in the rows.

**Booleans are switches.** Every on/off setting is a paper-ui `Switch`
(`size="small"`) in the control column, phrased positively: *In-app dev
toolbar*, *Show Setup on open* (checked = `setupDismissed` false),
*Release Please*, and the three Merge Policy booleans. No flipping button
labels remain.

**Project Info.** The `h1` row carries the version stamp and the
initialized date. Four rows — Project name, Icon (thumbnail plus *Choose
file*), Port (hint: default for `paper-camp dev`, restart to apply), In-app
dev toolbar switch — then a *Default agents* group as the header-then-rows
table with Task, Agent, Model, Effort columns.

**Setup.** Two groups, *External services* and *Local adapters*. A
healthy row is name, *Ready* stamp, and a Recheck icon button. Only when
the status is not `ok` does the row grow: the *Unlocks* and detail lines
appear under the label, the warning stamps sit beside the status, and the
connect action — run command, sign in, or link — joins the control column.
For a healthy row the detail is reachable from a `Tooltip` on the stamp.
The incomplete-connections `Alert` stays above the groups; the dismiss
button becomes the *Show Setup on open* switch row at the bottom.

**Merge Policy.** The `h1` row shows the repo slug, the match stamp, and
*Apply recommended*. Allow squash merge, Allow merge commit, and Allow
rebase merge are live switch rows: toggling one PATCHes that single field
on GitHub through `applyMergePolicy`, which gains an optional
`Partial<MergePolicy>` argument and sends only the fields given — the
no-argument call keeps applying the full recommended policy. The route
under `routes/system` and `config-api.ts` pass the partial through. A row
whose value differs from the recommendation shows *recommended: off* (or
on) as its hint. Squash commit title and message stay read-only value rows.

**Desk.** *Discover from project* / *Re-scan with discovery* sits in the
`h1` row. *Services* and *Checks* are `SettingGroup`s with a small *Add*
action on the label row, a header row card naming the columns, and one
row card per entry with the remove icon button as the last column. *CI*
is three rows: Repo, Branch, Release Please switch.

**Subjects leaves Settings.** The section, its sidebar entry, and
`subjects-section.tsx` are deleted; Roadmap owns that vocabulary and the
section only mirrored it with a button back to Roadmap. The
`SettingsSection` union in `use-route-selection.ts` drops `subjects`.

Only paper-ui components and `--pui-*` tokens; no new colors. The
mobile breakpoints keep the worklist's behaviour: rows stack their control
under the label below 480px.

### Out of scope

The Toolbar section and its install agent ([[IDEA-247]]). The
Notifications section ([[IDEA-252]]), which adopts these primitives when
it lands. Stamp colours in `settings/constants.ts`, which follow the
app-wide `STATUS_STAMP` pattern and move together in [[IDEA-111]].

### Phases
- [ ] Add `SettingsHeader`, `SettingGroup`, and `SettingRow`
      In `features/settings/components`; kraft `plan-row-card` rows with a 260px control column, handwritten group labels, and a `PlansHeader`-shaped section header. Drop the "Settings" `PageTitle` from `settings-page.tsx`.
- [ ] Rebuild Project Info on the row grammar
      Version stamp and initialized date in the header row; name, icon, port, toolbar switch rows; the agent table as header-then-rows.
- [ ] Rebuild Setup with collapsing connection rows
      Healthy rows are one line with a tooltip on the stamp; incomplete rows show detail and the connect action. *Show Setup on open* switch replaces the dismiss button.
- [ ] Make Merge Policy booleans live switches
      `applyMergePolicy(root, partial?)` PATCHes only the given fields; the route and `config-api.ts` pass the partial through; recommended hint on rows that differ.
- [ ] Rebuild Desk as header-then-rows tables
      Group label with *Add* action, column header row, unlabeled inputs per row, CI as three rows with the Release Please switch.
- [ ] Remove the Subjects section
      Delete `subjects-section.tsx`, its sidebar entry, and `subjects` from the `SettingsSection` union.
