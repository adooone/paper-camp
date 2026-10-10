---
id: IDEA-291
title: Several projects in one view
type: feat
status: done
created: 2026-10-09
updated: 2026-10-10
tags:
  - app
  - ui
  - multi-project
  - hub
subject: Multi-project
order: 1
---

Each project opens on its own. Seeing paper-camp's ideas next to paper-ui's
means going back to the hub, opening the second project and holding the first
in your head. The work often spans repos — a paper-camp idea waits on a
paper-ui release — and nothing records that link. This idea builds on
[[IDEA-290]]'s three pages: the sidebar they leave free becomes a **project
scope**, a set of ticked projects whose ideas and activity show together. An
idea can also **need** another idea, in its own repo or in another project on
the same machine.

**The scope.** The scope always contains the *current project* (the one whose
mount serves the page), plus any other ticked projects. A project is keyed
`<slug>@<machine>`, using the machine registry's slug and the hub's machine
name. The scope lives in the URL as `?p=paper-camp@deimos,paper-ui@deimos`,
so a view can be bookmarked. The last scope is remembered per device, the
same way `last-route-store` remembers the route. With no `?p=` the scope is the
current project alone, and every page behaves exactly as it does after
[[IDEA-290]]. Each project in the scope gets a color from a fixed sequence of
paper-ui accent tokens (blue, green, amber, rose, purple, slate), assigned in
hub order. No hex values are added.

**The sidebar is the scope list.** On the Ideas list, Activity and Project
pages the sidebar shows *Projects in view*: the hub's machines as groups, and
each machine's projects as rows with a checkbox, the color dot, the name and a
count — open ideas on Ideas, unread entries on Activity. The checkbox adds a
project to the scope or removes it. Clicking the name makes that project the
current one by navigating to its mount, with the scope carried along.
The current project's checkbox is fixed on. Rows on an asleep or unreachable
machine are disabled, marked *asleep*, and drop out of the data without
breaking the rest. *All* and *Clear* sit beside the label. A footer link
*All machines* opens the hub at `/projects`, which stays the landing page and
the place to add a machine. *Back to projects* leaves the header. The idea
page's sidebar keeps its actions column and shows no scope list.

**Ideas across projects.** The list holds rows from every project in the
scope. When more than one project is in scope, each row carries a project chip
in that project's color. *Group by* gains **Project**. Under *Horizon*, each
project's roadmap is its own section, and its horizons sit inside it. Search
and status chips filter across all projects. Run order stays per project: each
row keeps its own project's stamp, and *Prioritise queue* and *New idea* act
on the current project. Opening another project's row navigates to that
project's mount at `/ideas/IDEA-N`, scope kept.

**Activity across projects.** The stream merges every project in scope by
time, with each entry carrying its project chip. The composer gains an *in*
picker that defaults to the current project. A message goes to the picked
project's chat, and an answer to a Scout question goes to the project that
asked it. Unread counts come from each project's own state.

**Project and the Stack.** The Project page always shows the current
project; there the scope list works as a switcher (names only, checkboxes
hidden). The Stack's agent section lists running and waiting work from every
project in scope, each line prefixed with its project. Desk, CI and services
stay the current project's, and so does the status bar.

**Data.** The browser fans out to each project's runtime, the way the hub
already reads stats with `fetchStatsAt`: `fetchPlansAt`, `fetchRoadmapAt`,
`fetchRunsAt` and `fetchChatAt` join it. `activity-stream.ts` keeps one
`EventSource` per runtime in scope instead of a single global one. No server
merges anything.

**Needs.** An entity's frontmatter takes an optional `needs:` list. An entry is
`IDEA-N` for the same project, or `<slug>/IDEA-N` for another project
registered on the same machine. The parser, the serializer, `src/types` and the
MCP `add_idea`/`edit_idea` tools carry it. The server resolves another
project's idea through the machine registry's project path. While any needed
idea is not `done`, *Run all phases* and a single phase run refuse with
*waits for paper-ui IDEA-14*. Anything that picks the next idea from a run
order skips it, and the list row and the idea page show the same *waits for*
line, linked. A reference that resolves to nothing shows as *can't find
<ref>* in the rose tone and does not block. This half works with one project
in scope and ships first.

Done when paper-camp and paper-ui can be ticked together on deimos, their
ideas and activity read as one list each, and a paper-camp idea that needs an
open paper-ui idea refuses to run until that one is done.

### Out of scope

Saved scope presets. A shared run order across projects. Needs that point to
another machine. Stats compared side by side. The status bar across
projects. The embedded dev toolbar, which is always one project.

### Phases
- [x] Add `needs` to the entity grammar
      Parse, serialize, type and expose it through `add_idea`/`edit_idea`;
      resolve same-project refs and `<slug>/IDEA-N` through the machine
      registry, unknown refs reported, not thrown.
      run: 6m55s · 178 in · 34.5k out · sonnet-5 · sess:883f5254-b86a-4615-8a63-0610751d0578
- [x] Enforce needs and show what an idea waits for
      Run all phases, single phase runs and run-order pickers refuse or skip a
      waiting idea; the list row and the idea page show the linked *waits for*
      line, and *can't find* for a dead ref.
      run: 20m1s · 344 in · 83.9k out · sonnet-5 · sess:752419b5-deac-4e8c-843d-c919d7009439
- [x] Add the scope model and per-runtime data
      `?p=` keys, per-device memory, token colors, `fetchPlansAt`,
      `fetchRoadmapAt`, `fetchRunsAt`, `fetchChatAt`, one `EventSource` per
      runtime in scope.
      run: 9m33s · 132 in · 39.1k out · sonnet-5 · sess:84741412-9bca-49fb-8576-0bf53176fb03
- [x] Turn the sidebar into the scope list
      Machines and projects with checkboxes, counts, asleep rows, All/Clear and
      the All machines link on Ideas, Activity and Project; the header loses
      Back to projects.
      run: 19m50s · 210 in · 88.2k out · sonnet-5 · sess:84741412-9bca-49fb-8576-0bf53176fb03
- [x] Show Ideas across the scope
      Project chips, Group by Project, Horizon per project, cross-mount
      navigation with the scope kept, per-project run order stamps.
      run: 15m17s · 284 in · 86.4k out · sonnet-5 · sess:7fe8fb92-4c51-4f33-8aed-805bdd5a0851
- [x] Show Activity and the Stack's agents across the scope
      Merged stream with chips and per-project unread, the composer's *in*
      picker, and the Stack agent section listing every project in scope.
      run: 12m50s · 212 in · 71.8k out · sonnet-5 · sess:810b58d2-87a2-49dd-b9d9-934e5c88ffb5
