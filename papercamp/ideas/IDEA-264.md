---
id: IDEA-264
title: The hub as one list with numbers
type: feat
status: idea
created: 2026-09-12
tags:
  - app
  - ui
  - multi-project
subject: Multi-project
order: 4
---

The hub shows every project twice. `projects-column.tsx` lists the
projects this browser has opened, `add-project-column.tsx` lists every
project on every machine, and one project appears in both with different
names: the left uses the `package.json` name over the address, the right
the folder slug with the package name beside it, which is how `func-ui`
reads as "film-ui func-ui". *Version mismatch* repeats on every row of a
machine although it is the runtime's, *Can execute* stamps the normal
state green, and "Add a project" names an action the hub does not do —
a project is added by `init` on the machine; the hub only ever adds a
machine. Meanwhile every reachable project answers `/api/stats` with
weekly runs, cost, tokens, capacity, questions, and night findings, and
the hub shows none of it.

**One list, grouped by machine.** The page is two columns, two thirds
and one third, that stack below the phone breakpoint. The left column is
the list. Each machine is a section: its host in the handwritten face, the
runtime version in mono, and the machine-level stamps — *update X
waiting* from the pending-update field, *waiting for local network* or
*offline* from the reach state — once, in the header. The version
mismatch stamp moves there. Under it one row per project: the folder slug
as the name, the package name in muted mono only when it differs, one
stamp — *Running · IDEA-N* from the agent status, *N interrupted* in
rose, *Missing* for a folder that moved, *Idle* in gray otherwise — and
when this browser last opened it, from `last-route-store.ts`. Rows sort
running first, then most recently opened. Machines sort by their most
recent activity. A row opens the project; rename and forget stay in the
row's menu. Above the list a *Continue* strip names the project opened
last with its running task when there is one, and opens it in one tap.

**Adding a machine is one line.** The two columns' "Add a project"
heading, the get-started card, and the this-machine card go. The list's
footer says how a machine is added — open the link a daemon printed —
with a *Paste a link* field for the same. A machine's projects appear
under it as the daemon reports them; nothing is chosen by hand.

**The right column is the numbers.** Six figures, each drawn with
Rough.js — already bundled by paper-ui for its sketched borders, so the
strokes match every card — through three helpers in
`src/app/components/charts/`: an arc gauge, a bar chart, and a stacked
bar, each a few dozen lines. Values are in the handwritten face. Every
figure reads the stats endpoint of each reachable project and sums:

- *Capacity* — two gauges, the five-hour and seven-day windows from the
  latest snapshot on the Continue project's machine, the seven-day floor
  marked.
- *Runs, last 8 weeks* — bars from `tasksPerWeek`, failed runs hatched
  in rose, the total and failed count beside.
- *Spend this week* — cost and tokens from `usagePerWeek`, with the
  change against the week before.
- *Waiting on you* — the sum of `openQuestions`.
- *Ideas in flight* — `entitiesByStatus` summed into one stacked bar
  with a legend line.
- *Last night* — passes, cost, and findings by severity from the night
  findings.

A project that is unreachable is left out of the sums and the column
says how many were counted. With no reachable project the column shows
the figures empty, not an error.

**A search row appears above eight projects**, filtering rows by name
and slug; below that it is not drawn.

### Out of scope

Per-project figures that belong on the Stats page: coverage, comment
ratio, the health map. Charts anywhere else in the app; the three helpers
are built for the hub and may be reused later. Pairing and trust rules.

### Phases
- [x] Build the machine-grouped hub model
      Merge the remembered entries with each daemon's reported projects into one
      list, with the row stamp and the sort order.
      run: 7m55s · 100 in · 45.9k out · sonnet-5 · sess:5ef2063c-0577-4f96-bdd5-2e62b0ffc93b
- [x] Replace the two columns with the one list
      Machine sections, project rows, the Continue strip, the search row, and the
      add-a-machine footer; the old columns and cards go.
      run: 9m17s · 158 in · 52.9k out · sonnet-5 · sess:9ca06fbb-cf6a-4687-8e0e-11c7ba0e38bc
- [x] Add the arc gauge, bar, and stacked-bar helpers
      run: 6m9s · 88 in · 22.7k out · sonnet-5 · sess:e1f36ef8-97a5-413a-a006-3d413f8da5fc
- [ ] Sum the stats of every reachable project
- [ ] Draw the six figures in the right column
