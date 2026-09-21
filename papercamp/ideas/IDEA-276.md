---
id: IDEA-276
title: A roadmap you can read
type: refactor
status: idea
created: 2026-09-21
tags:
  - app
  - ui
  - roadmap
subject: Planning surface
order: 2
---

The Roadmap page cannot answer what is left. A collapsed row is a name, a
grey line and sometimes a count, so Collaboration, never started, looks
like Packaging, finished months ago. The bar slides to the right edge on
rows with no stamp and sits further left on rows with one. Expanding
Packaging opens a wall of identical Done cards with the two useful
controls at the bottom. The sidebar truncates every horizon to *Horizon 1
— Ready for d…*, the goal takes a third of the first screen, and standing
concerns, which hold 90 ideas, are not on the page at all. It reads the
model [[IDEA-275]] resolves.

**A row has fixed columns.** Chevron, then the name over its one-line
description in muted text, a state `Stamp`, and a progress column: *27 of
30 · 3 open* in the handwritten face over a bar drawn with
`roughGenerator`, as the charts are. The grid is `minmax(0,1fr) 6rem 8rem`
so nothing shifts between rows; a not-started item shows *No ideas yet* in
the progress column and no bar. The state stamp is neutral for *Not
started*, warning for *In progress*, success for *Shipped*, and an
in-progress item that is `readyToShip` adds a muted *ready to ship* beside
it. The *in queue*, *shipped* and *candidates* stamps and
`progress-bar.tsx` go.

**A horizon has a header and a fold.** The title, its `intro` as one muted
line, and a rollup on the right: *50 of 53 ideas shipped · 1 item not
started*. Its shipped items fold into one closing row, *Shipped · 4
items*, listing their names, that expands to show them; the horizon itself
reads as what is left. Horizons separate with the sketch `Divider`, and
the rows sit directly on the page — no cards around items, as Settings
lost its cards in [[IDEA-267]].

**An expanded item leads with what is open.** Open ideas first as the
existing `IdeaRow`, then candidates, then one row of actions; done and
dropped ideas collapse to a single *27 shipped* line that expands. On a
phone an idea row stacks its title above its PR badge and status so the
title is never cut to three words.

**Standing concerns and the unfiled close the page.** A *Standing
concerns* section renders each concern as a row in the same grid with
*41 shipped · 0 open* and no bar or state, since a concern never finishes,
expanding to its open ideas. *Unfiled* is the last row, in the warning
tone, *73 ideas with no subject*, expanding to the open ones.

**The goal is one line.** The goal's first sentence sits under the page
title in muted text; `GoalBanner`, its label and its *Show more* go, and
the full text stays in `ROADMAP.md`.

**The sidebar filters what the page shows.** Horizon entries drop the
*Horizon N —* prefix and show the name, so nothing truncates. The status
filter becomes the three item states with their counts. A horizon whose
items are all filtered out keeps its header with *Nothing here matches*,
so a filter never makes a horizon vanish.

**One vocabulary.** *Candidate* everywhere: the field reads *Add a
candidate*, its button *Add*. *Promote* on a candidate, *Promote to idea*
on an item, both `Button`s of the same ghost variant. The hand-rolled
chevron is replaced by paper-ui's.

### Out of scope

The numbers themselves, which are [[IDEA-275]]. Edit, move, mark shipped
and remove, which are [[IDEA-277]] and land in the action row this idea
lays out. A timeline or dated view.

### Phases
- [x] Rebuild the item row on a fixed grid
      Columns, state stamp, the `roughGenerator` bar and paper-ui's chevron; `progress-bar.tsx` and the old stamps go.
      run: 3m57s · 92 in · 20.8k out · sonnet-5 · sess:58772d92-b947-4225-b5e8-02b26c99df3e
- [x] Give a horizon a header, a rollup and a shipped fold
      Drop the item cards and separate horizons with the sketch `Divider`.
      run: 3m · 62 in · 16.1k out · sonnet-5 · sess:58772d92-b947-4225-b5e8-02b26c99df3e
- [ ] Reorder the expanded item around what is open
      Open ideas, candidates, the action row, a shipped fold, the phone stacking, and the candidate/promote wording.
- [ ] Close the page with standing concerns and the unfiled
- [ ] Reduce the goal to one line and retune the sidebar
      `GoalBanner` goes; horizon entries lose the prefix, the status filter becomes the three item states, and a filtered-out horizon keeps its header.
