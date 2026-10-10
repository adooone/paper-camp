---
id: IDEA-290
title: Three pages instead of seven
type: refactor
status: planned
created: 2026-10-09
tags:
  - app
  - ui
  - plans
  - roadmap
subject: App UI
order: 1
---

The header carries seven tabs — Plans, Roadmap, Docs, Chat, Log, Stats,
Settings — but they cover only three subjects. Plans and Roadmap both show
the project's ideas, and the roadmap only groups them by horizon. Log and Chat
both record what happened: a Scout reply is one more event next to a run. Docs, Stats
and Settings are all about the repo itself. Each page also spends the sidebar
on its own filters, which leaves no room for the project scope that
[[IDEA-291]] needs. The header becomes **Ideas · Activity · Project**, and
filters move out of the sidebar into a toolbar under each page title.

**A page toolbar.** One shared `PageToolbar` in `src/app/components/` holds a
page's search, its chip filters and its grouping control in a single
wrapping row directly under the `PageTitle`, built from paper-ui's `Input`,
`Button` and `Stamp`. A missing toggle-chip or segmented control is added to
paper-ui first and adopted from there, as every color comes from a `--pui-*`
token. The toolbar wraps at phone width; nothing in it is sticky.

**Ideas = Plans + Roadmap, at `/`.** `PlanFilterColumn` goes: its search and
status chips (same order, same counts, same *Clear filters*) move into the
toolbar. `GroupBySubjectToggle` becomes a three-way *Group by*: **Plain**
(today's list), **Subject**, **Horizon**, kept in the URL as `?group=`.
*Horizon* renders what the Roadmap page renders today: the goal's first
sentence under the title, each horizon's section with its item rows and their
ideas, standing concerns, and unfiled ideas. In that mode the toolbar adds the
horizon chips from `RoadmapSidebar`, and the header gains *+ Add item*. The
item page stays at `/roadmap/$item`. It is rendered under the Ideas tab, and its
breadcrumb reads *Ideas › <horizon> › <item>*. `/roadmap` redirects to
`/?group=horizon`. `RoadmapSidebar` and the standalone list in `RoadmapPage`
are deleted. With no filter column the Ideas list has no sidebar, and the idea
page keeps its actions column exactly as it is.

**Activity = Log + Chat, at `/activity`.** One time-ordered stream of runs
and chat messages. The chat composer from `ChatPage` sits above the stream as
a card, with *Send* and the *Clear chat* title action. Scout and user messages
are stream entries, and a Scout question is answered inline the way
`FeedbackThread` answers it today. The toolbar holds everything `LogSidebar`
held — search, outcome, type, agent, range, sort, unread, all still URL search
params — plus a kind chip row: *All · Runs · Chat*. `LogStatsSidebar`'s
numbers (runs, failed, success rate, total cost, median duration) become one
muted summary line under the toolbar for the filtered range. A run entry opens
at `/activity/$entryId`. Redirects: `/log` → `/activity` with its search
params, `/log/$entryId` → `/activity/$entryId`, `/chat` →
`/activity?kind=chat`, and `/inbox`, `/tasks` and `/issues` retarget to
`/activity`.

**Project = Docs + Stats + Settings, at `/project`.** One sidebar with three
labelled groups: *Docs* (the docs search, repo docs, release notes), *Stats*,
and *Settings* (Project info, Setup, Merge policy, Toolbar, Desk, Review
passes, Notifications — today's sections, unchanged inside). `/project` opens
Stats. Routes: `/project/docs`, `/project/docs/$section`, `/project/stats`,
`/project/settings`, `/project/settings/$section`. `/docs`, `/stats` and
`/settings`, with their sub-paths, redirect to these.

**The shell follows.** `navItems` holds three entries. `useAppShell`'s
area flags and `sidebarAreaKey` collapse to the three areas, and
`ROW_SKELETON_PREFIXES` and `SPINNER_ROUTE_LABELS` name the new paths. The
unlisted `/git` page and the hub at `/projects` are untouched. Code that only
the old pages used is deleted, not kept behind the redirects, and knip stays
clean.

Done when the header shows three tabs, every old address lands on its new
home, and no filter lives in a sidebar.

### Out of scope

Showing several projects at once ([[IDEA-291]]). The embedded dev toolbar.
The hub page. Any change to what a settings section or a stats card contains.

### Phases
- [x] Add the page toolbar and move the Plans filters into it
      `PageToolbar` in `src/app/components/`, any missing chip or segmented
      control added to paper-ui first. `PlanFilterColumn` deleted; search, status
      chips and Clear filters live in the toolbar on `/`.
      run: 7m14s · 96 in · 19.4k out · sonnet-5 · sess:926e42c1-f8fe-456e-93bc-1254057c9c01
- [ ] Fold the Roadmap into Ideas as Group by Horizon
      Three-way Group by (Plain, Subject, Horizon) in `?group=`; Horizon renders
      the roadmap's sections with horizon chips and + Add item; `/roadmap`
      redirects; the item page sits under the Ideas tab; `RoadmapSidebar` deleted.
- [ ] Merge Log and Chat into Activity
      `/activity` and `/activity/$entryId` with the composer card, chat entries
      in the stream, log filters and kind chips in the toolbar, the stats summary
      line, and the `/log`, `/chat`, `/inbox`, `/tasks`, `/issues` redirects.
- [ ] Build the Project page from Docs, Stats and Settings
      One sidebar with Docs, Stats and Settings groups under `/project/…`, Stats
      as the landing, and redirects from `/docs`, `/stats`, `/settings` and their
      sub-paths.
- [ ] Cut the header to three tabs and clear the dead code
      `navItems`, the shell's area flags, skeleton prefixes and spinner labels;
      remove what only the old pages used; knip, depcruise and tests green.
