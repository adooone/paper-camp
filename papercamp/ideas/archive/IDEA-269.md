---
id: IDEA-269
title: Agents and desk as editable tables
type: fix
kind: fix
status: done
idea: IDEA-267
created: 2026-09-15
updated: 2026-09-15
tags:
  - app
  - settings
  - ui
subject: App UI
order: 1
---

Settings → General lists the default agents as `AgentTaskRowHeader` plus
one `AgentTaskRow` per task kind: a hand-built grid of three fixed pixel
widths carrying a task label and three controls, with its own header row
faking column titles. It was a table pretending to be rows even while the
rows were cards; now that [[IDEA-267]] has taken the cards away, it is a
table pretending to be nothing.

**paper-ui already has the table.** `Table` takes `columns` with a `cell`
render function, `density="compact"`, `hideHeader`, and a `toolbar`, and a
cell may render any node — so a `Select` in a cell is an editable cell with
no new component. The default-agents list becomes one `Table`: a Task
column carrying the kind's label, then Agent, Model, and Effort columns
whose cells are the same controls the rows use today, saving on change
exactly as they do now. `agent-task-row.tsx`, `agent-task-row-header.tsx`,
and the three width constants go.

**The rules it already enforces stay.** A model list filtered to the chosen
agent, the code-review model excluded from matching the author's
([[IDEA-170]]), the free-text model input for an agent with no fixed list,
and the fallback when a config names an unknown agent — all of it moves
into the cell renderers unchanged.

**The desk's own lists are the same shape.** Services and checks in
Settings → Desk are the same header-plus-rows construction, each with its
own grid class and header component: `DESK_SERVICE_GRID_CLASS` over name,
command, port and healthcheck, and the check grid over name, command and
fix command. Both become `Table`s with those cells editable in place,
saving on blur as the rows do now, a trailing actions column for remove,
and the add-row action in the table's `toolbar`. `desk-service-row.tsx`,
`desk-service-row-header.tsx`, `desk-check-row.tsx`,
`desk-check-row-header.tsx`, and both grid constants go.

**The CI block stays a pair of fields.** `DeskCiEditor` is two values, a
repo and a branch, not a list — it keeps its `SettingRow`s, because a
table of one row is a worse way to read two settings.

### Out of scope

Which task kinds exist, what an agent config holds, and what a desk
service or check declares. The CI block and every other settings section,
which are plain rows and stay that way.

### Phases
- [x] Render the default agents as one Table
      Task, Agent, Model, and Effort columns whose cells carry today's controls
      and save on change.
      run: 5m24s · 78 in · 27.4k out · sonnet-5 · sess:06fa04bc-ffef-4e7e-868d-2ea953b19115
- [x] Carry the agent rules into the cells
      Agent-filtered models, the excluded author model, the free-text input, and
      the unknown-agent fallback.
      run: 35s · 16 in · 1.8k out · sonnet-5 · sess:06fa04bc-ffef-4e7e-868d-2ea953b19115
- [x] Turn the desk services and checks into tables
      Editable name and command cells, row actions in a trailing column.
      run: 2m48s · 44 in · 26.7k out · sonnet-5 · sess:06fa04bc-ffef-4e7e-868d-2ea953b19115
- [x] Delete the retired rows, headers, and grid constants
      Drop them from `views/index.ts` too.
      run: 32s · 16 in · 1.6k out · sonnet-5 · sess:06fa04bc-ffef-4e7e-868d-2ea953b19115
