---
id: IDEA-296
title: Project switcher in the header
type: feat
status: review
created: 2026-10-14
tags:
  - app
  - ui
  - hub
  - multi-project
subject: App UI
order: 5
---

The header's left end shows only the current project's icon and name, so
nothing says this is Paper Camp, and changing project means going back to the
welcome screen. That screen does too much. It lists every machine's projects
with their state, offers rename and forget per project, shows a column of
numbers (capacity, runs per week, this week's cost, ideas in flight, last
night), and also holds the pairing form. After [[IDEA-291]] and
[[IDEA-292]], switching belongs in the header and pairing is the only thing the
welcome screen is still needed for. The numbers column isn't useful in its
current form and goes, with no replacement for now.

**The header names the app, then the project.** The header's left end reads:
the Paper Camp logo, *Paper Camp* in the display face, a thin separator, then
the current project as a dropdown trigger — its icon, its name, and a small
down chevron — built on paper-ui's `Menu`. The dropdown lists every project
this browser knows, grouped under each machine's host name (the group heading
appears only when there is more than one machine), machines and projects in
alphabetical order so the list never reshuffles when the project changes. Each row shows the project
name, with a check on the current one and a muted *running* when an agent is
working there. A project on an asleep or unreachable machine is listed disabled
with *asleep*. Choosing a project opens it the way the welcome screen's rows do
today, through `useHubMachines().openRow`, landing where it was last left. The
list ends with a separator and *Add a machine*, which opens the welcome screen.
Under a mount prefix, where the host app decides the project, the name shows
with no dropdown, as `ProjectSwitcher` does today.

**The status bar stays about git.** An earlier pass put the project's icon and
name before the branch; it was dropped again. The header switcher already names
the project, and the status bar starts with the branch.

**The welcome screen is for pairing only.** `/projects` shows the logo, *Paper
Camp*, and the *Add a machine* card from IDEA-292 — machine and code fields, the
`paper-camp start --tailnet` line — centred on the page, nothing else. A browser
with no known project still lands there, as `main.tsx` arranges now. A browser
that knows projects goes straight into one, and only reaches the welcome screen
through *Add a machine*, which then also offers *Back to <project>*.
`HubNumbersColumn`, `useHubNumbers`, the `hub-numbers` helpers and their tests,
`MachineSection` and `ProjectRow` are deleted, along with anything else only
they used.

**Rename moves to Project › Settings.** The *Project Info* section gains a
**Name on this device** row: an input pre-filled with the label the switcher
shows, saved through `useHubMachines().renameRow` on blur. Empty restores the
repo's own name. The label is device-local, as it is today. There is no
*forget*: the switcher lists what each machine serves, so forgetting on one
device would only drop the custom name and the remembered last page, and a
project is removed for real from the machine's registry instead.

**The Project sidebar drops its project list.** The *Projects* section that
[[IDEA-291]] put at the top of the Project page's sidebar goes; the header
switcher is the one place to change project. The sidebar starts with
*Roadmap*. `ProjectsInView`'s `switcher` mode is deleted if nothing else uses
it.

Done when the header reads *Paper Camp | project ▾* on every page, switching
project needs no detour, the status bar shows the project, and the welcome
screen holds only the pairing form.

### Out of scope

A replacement for the numbers column. Renaming a project for every device.
Managing machines (forgetting a machine, its version, its update).

### Phases
- [x] Put Paper Camp and the project switcher in the header
      Logo, Paper Camp, separator and the project dropdown on `Menu`, grouped
      by machine with current, running and asleep states and Add a machine at
      the end; no dropdown under a mount prefix.
      run: 7m13s · 156 in · 31.9k out · sonnet-5 · sess:f7de84da-bd8c-433b-911b-3269eccfe54f
- [x] Name the project in the status bar
      Icon and name as the first item of the left group, before the branch,
      not clickable.
      run: 1m54s · 38 in · 6.6k out · sonnet-5 · sess:f7de84da-bd8c-433b-911b-3269eccfe54f
- [x] Cut the welcome screen to pairing
      Logo, title and the Add a machine card only, with Back to <project> when
      one is known; numbers column, machine sections and project rows deleted
      with their hooks, helpers and tests.
      run: 5m16s · 92 in · 20.5k out · sonnet-5 · sess:b3bebcaf-156a-46cc-b35a-33585d1a1569
- [x] Move rename to Project › Settings
      Name on this device in Project Info, using renameRow; forget was dropped
      as meaningless once the switcher lists every machine project.
      run: 2m56s · 40 in · 12.4k out · sonnet-5 · sess:b3bebcaf-156a-46cc-b35a-33585d1a1569
- [x] Drop the project list from the Project sidebar
      Remove the Projects section so the sidebar starts with Roadmap; delete
      ProjectsInView's switcher mode if unused.
      run: 1m37s · 40 in · 6.3k out · sonnet-5 · sess:6c9bd922-6b43-46bc-b535-04b9e8649309
