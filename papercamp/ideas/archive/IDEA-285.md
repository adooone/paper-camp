---
id: IDEA-285
title: Back to the pixel
type: fix
status: done
created: 2026-09-24
updated: 2026-09-27
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

**Bump first, to the release that carries paper-ui's IDEA-8 and IDEA-9.** That
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

**The chunk view lays out as it did.** `chunk-detail.tsx` renders its
facts with `FactsGrid layout="inline" align="end"` beside the title, so
Date, Passes and Cost sit in one row of label-over-value pairs and wrap
under the title only on a phone; the findings table's actions column is
`width: 'auto'` with the three ghost buttons in one line, and the finding
column takes the rest. Both props come from paper-ui's IDEA-9, which the
bump phase's release carries.

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

**Acceptance is the comparison, done by a person.** With the dev server up, the
Vercel deployment of `7a58b8b7` and this build are opened on the same
daemon, and Plans, an idea, Roadmap, Git, Log, Settings and the stack
panel are compared at 1440px and 420px. Any remaining difference in
font, size, weight, colour, spacing, texture, border or hover is logged
as a fix on the paper-ui idea that owns the component, and this idea
is not marked done until that list is empty. It is not a phase: an agent
has no browser, so it lives here as the closing check instead.

### Out of scope

Charts and the drawer, which are [[IDEA-282]] and [[IDEA-283]] and have
not run. Anything the baseline did not draw.

### Phases
- [x] Bump paper-ui to the release carrying IDEA-8 and IDEA-9
      run: 8m49s · 36 in · 3.4k out · sonnet-5 · sess:4609f538-45fd-4ce6-be06-57ba6a56a75c
- [x] Restore the log, worklist, roadmap and plan row grids
      Column templates, cell order and handwritten meta across the run,
      roadmap, standing-concern and plan rows.
      run: 27m31s · 220 in · 81.4k out · sonnet-5 · sess:4609f538-45fd-4ce6-be06-57ba6a56a75c
- [x] Fix the sidebars, the git file list and the stamps
      Includes moving the six `ListItem` lists to `SidebarItem` and dropping
      `.pc-row` from `utilities.css`.
      run: 27m5s · 258 in · 62.8k out · sonnet-5 · sess:68430586-72e5-4f3f-be17-3d9cfc86ef9a
- [x] Lay out the chunk view, then clear the leftovers
      The facts grid and findings table, the leftover icon, gap and button
      fixes, and the `utilities.css` and `tailwind.config.ts` deletions.
      run: 5m · 130 in · 26.2k out · sonnet-5 · sess:84bf2c57-e111-4ae2-92f9-3252fd6d3633

### Thread
- [x] 2026-09-27 [log] [agent] This run is headless — no browser, no display, no way to open the dev server or the `7a58b8b7` Vercel deployment side by side. The phase's only work is that visual comparison, so nothing was changed, no diff list was produced, and this phase's checkbox stays unticked. A human needs to run the comparison at 1440px and 420px across Plans, an idea, Roadmap, Git, Log, Settings and the stack panel, and log whatever differences remain as fixes on the owning paper-ui idea before this idea can go to `review`.
- [x] 2026-09-27 [note] Phase 5 was a browser comparison an agent cannot run; moved out of Phases into the body as the acceptance check. All four agent phases landed on 0.22.5; the comparison is pending and closes the idea.
