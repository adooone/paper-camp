---
id: IDEA-285
title: Back to the pixel
type: fix
status: idea
created: 2026-09-24
tags:
  - app
  - ui
  - paper-ui
subject: One design system
order: 1
---

Three adoptions ran, then two rounds of fixes spread over three ideas,
and the app still does not look like it did at `7a58b8b7`, the last
commit before the migration. A side-by-side of that build and this one
in the browser shows what is left: list dates in serif where they were
handwritten, the idea heading in body serif at weight 400 instead of the
display face at 600, everything a size larger, the deliver-check stamps
without their pencil ring, the log's six columns folded into four, the
roadmap's stamp and progress cells swapped, git file rows wrapping onto
two lines, the chalkboard *done* stamp a faint wash instead of a plate,
a hover fill on every list row, and the sidebar's branch note truncated.
Most of the font drift has one cause, fixed upstream in paper-ui's
IDEA-8: `Text` never applied its props in any published build. The rest
is this app's own. This idea is the one run that finishes it; the unrun
fixes on [[IDEA-279]], [[IDEA-280]] and [[IDEA-281]] are folded in here
and deleted there.

**Bump first, to the release that carries paper-ui's IDEA-8.** That
release also carries 0.22.3's type-scale correction, so nothing here
compensates for size: where a size looks wrong after the bump, the fix
is a paper-ui fix, not a class on this side.

**The log list gets its six columns back.** `run-row.tsx` and the header
share the template `100px 128px minmax(0,1fr) 100px 72px 84px`: Time,
Type as a neutral `Stamp` in its own cell, Entry, Agent, Duration,
Outcome, with Time, Agent and Duration handwritten 14px at .55. No
column is `auto`, since each `Row` is its own grid. The worklist header
gives Updated and Progress their own 64px and 52px cells.

**Roadmap rows read stamp, then progress.** `roadmap-item-row.tsx` and
`standing-concern-row.tsx` use `minmax(0,1fr) 6rem 8rem` with the state
stamp in the 6rem cell and the progress line handwritten 12px at .70;
no horizontal padding inside the accordion title; `highlighted` outlines
the wrapper around the whole item.

**Plan rows keep their breakpoints.** The Updated column hides below
`lg` through `hideBelow`, rows stack at 480px, fix rows return to
`76px minmax(0,1fr) 92px` with `fix.idea` in the title as mono xs at
.45, and em-dash placeholders are serif 16px at .30.

**Sidebars and the git list.** Every `SidebarCard` passes
`className="shrink-0"`. The git file list's `Row` omits `id` and `meta`
instead of giving them `0px`, and marks the active file with `active`,
never `highlighted`. The six sidebar lists still on `ListItem` with
`pc-row` move to `SidebarItem` with `active` and `action`, and `.pc-row`
and `.pc-row-label` leave `utilities.css`.

**Stamps.** `deliver-checks-row.tsx` stamps pass `disabled` rather than
`pointer-events-none`, keep `aria-controls`, and the stack panel's
stamps get their chalkboard `Tooltip` back. `shared.tsx` paints
chalkboard stamps through `surface="chalkboard"` — the opaque plates —
and deletes its `withAlpha(color.chalk*, 0.16)` washes.
`commit-history.tsx` shows `· prefix` in the meta line below 640px.

**Leftovers from the other two.** Every page title that lost its 24px
gap has it; `run-entry-page` puts its button in `EmptyState`'s `action`
slot; every `LightbulbIcon` and `NoteIcon` passes `opacity={0.55}`; the
stop button in `agent-section.tsx` is its 20px override; `CheckAllIcon`
in the git list is size 14; the four bare `CommandLine`s render unboxed.

**Delete what paper-ui now owns.** In `utilities.css`: the 600-weight
rule (paper-ui's `globals.scss` carries it), `.pc-nested-fold`,
`.plan-row-card`, `.pc-setting-row`, and `.phase-table-phone`; in
`tailwind.config.ts` the dead `colors.btn` map. What stays is the
`--pc-*` layout variables, `.pc-app-header`, `.pc-git-file-row`,
`.archive-row-action`, `.run-meta-full` and the 44px tap-target rules.

**The last phase is the comparison.** With the dev server up, the
Vercel deployment of `7a58b8b7` and this build are opened on the same
daemon, and Plans, an idea, Roadmap, Git, Log, Settings and the stack
panel are compared at 1440px and 420px. Any remaining difference in
font, size, weight, colour, spacing, texture, border or hover is logged
as a fix on the paper-ui idea that owns the component, and this idea
does not close until that list is empty.

### Out of scope

Charts and the drawer, which are [[IDEA-282]] and [[IDEA-283]] and have
not run. Anything the baseline did not draw.
