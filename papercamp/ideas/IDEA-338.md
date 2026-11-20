---
id: IDEA-338
title: The phone's screens on the desk
type: feat
status: planned
created: 2026-11-16
updated: 2026-11-20
tags:
  - app
  - ui
needs:
  - IDEA-337
subject: App UI
---

With the second client standing (IDEA-337), the phone's screens come to
the desk one by one, composed as the phone composes them, so the two can
be compared honestly before anything desk-only is added. The phone's
`App.tsx` and `app/screens/` are the reference: `ProjectsScreen`,
`IdeasScreen`, `IdeaScreen`, `ChatScreen`, `LogScreen`, `GitScreen`,
`SettingsScreen`, with `TitleRow`, `ProjectSwitcher`, `RepoStatusCard`,
`UpdateDaemonCard`, `VersionStamp` and `AppearanceSection` from
`app/shell/`, and the screenshots in `docs/design/phone-projects.png`,
`phone-ideas.png` and `phone-settings.png` are what each screen is held
against.

**The shell is the phone's shell.** `Paper` as the page, a `TitleRow`
(title in the display face at `2xl`, the project switcher under it in
`sm` soft ink with a caret, a stamp or action on the right), the
`NavIsland` with Projects, Ideas, Chat and Settings, plus Log and Git
where the phone reaches them from Ideas and Settings. Up to 1024px the
island floats 20px above the bottom edge and content is one column with
a 720px maximum, centred, exactly the phone widened; from 1024px the
island sits inline at the right of the title row and a second column
opens for the selected idea or run, 400px for the list, the rest for the
detail.

**Screen by screen, the phone's composition.** Projects: under the
project's uppercase label, attention rows ("1 question waiting", "23 runs
failed", "Night shift found 26 things") each with a count pill in its
meaning's wash, then Log and Git rows with a one-line detail and a
chevron, then the kraft repo card (Release and CI with status dots,
versions, branch with changed and ahead counts, the last commit faded),
then the version line with "check for updates" centred in small soft
ink. Ideas: rows with the id as a small faint eyebrow, the bold title,
"n / m phases" as the detail, under uppercase group labels with the
count at the right; the `SubIsland` segments "To Do · n", "Review · n",
"Done · n"; the skeleton and empty states. Idea: the phone's cards for the
body, phases with stamps, the thread as a read-only record, the "Discuss
in chat" action. Chat: the project chat with bubbles, question cards,
tool lines, streamed reply and the allow card, the single composer.
Log: the run list with stamps and the output on the dark grey
chalkboard (`data-chalk="grey"`, paper-ui/IDEA-18). Git: the
phone's repo status card and actions. Settings: Appearance as on the phone (a
four-stop text-size slider between a small and a large "Aa", body-font
cards with "Aa" previews, title-font cards previewing "Ideas", the
active card on a kraft wash with a kraft border), notifications per
project with the "ASKING" stamp and switches, project config, devices,
version, the link back to the classic desk. Data comes from the shared services and stores; where the
phone has a store the desk lacks (`planWalk`, `attention`), the logic is
ported into `src/app/stores`.

**Acceptance.** At 390px each screen of `/next/` and the phone's screen
of the same name show the same elements in the same order with the same
stamps and labels; at 1280px the Ideas screen shows the list and the
selected idea side by side with the island in the title row; nothing
desk-only appears yet.

### Phases
- [x] Shell, Projects and the island
      `Paper`, `TitleRow`, `ProjectSwitcher`, `NavIsland` with the width rule, the Projects screen; shell tests.
      run: 6m26s · 88 in · 48.2k out · sonnet-5-5 · sess:636d1e6d-f2ab-4232-a5c5-284815583962
- [x] Ideas
      Grouped rows, labels with counts, `SubIsland` segments, skeleton and empty states; the two-column layout from 1024px with the Idea column.
      run: 2m13s · 36 in · 17.2k out · sonnet-5-5 · sess:ae48fccc-af72-4047-ac1e-9b6603b8e5c5
- [x] Idea
      Body cards, phases with stamps and run actions, read-only thread, "Discuss in chat".
      run: 3m25s · 84 in · 45k out · sonnet-5-5 · sess:ae48fccc-af72-4047-ac1e-9b6603b8e5c5
- [x] Chat
      Bubbles, question cards, tool lines, streamed reply, allow card, the composer; the shared chat hooks.
      run: 3m44s · 42 in · 30.7k out · sonnet-5-5 · sess:dfed8c17-930e-48ce-9da2-ce6f326299af
- [x] Log and Git
      Run list with stamps and output on the grey chalkboard; repo status card and git actions.
      run: 5m47s · 68 in · 48.2k out · sonnet-5-5 · sess:755b9b3e-5c5c-4500-9a86-d1d5a9029c4e
- [ ] Settings
      Appearance section, project config, devices, version stamp, the classic-desk link.
