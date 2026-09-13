---
id: IDEA-267
title: Hand-drawn rules replace cards
type: refactor
status: idea
created: 2026-09-13
tags:
  - app
  - ui
subject: App UI
order: 2
---

Almost every group in the app is a `Card`: thirty-one on the pages, the
sidebar's own after [[IDEA-261]], the Stack's on chalkboard. Each draws a
filled rectangle a shade darker than its ground, so a Settings page is a
stack of brown slabs and a plan list is a ladder of them, and nesting a
card in a card needs a third shade to stay legible. The paper the whole
design imitates does not work that way: a sheet is one surface, and what
separates things on it is a ruled line.

**One surface, ruled.** Cards go. A page is the ground the Layout paints
and nothing else; groups are separated by a hand-drawn horizontal rule,
and a group's title carries its meaning. Every `Card` on a paper surface
is replaced by its children plus a rule above the next group; the last
group has no trailing rule. `surface.card` and `surface.nestedCard` in
`styles/tokens.ts` are deleted with the last card that used them, and
`surface.page` stays as the one ground.

**The rule is a paper-ui component.** paper-ui's `Divider` gains
`sketch`, a rough.js single stroke seeded from its own id so it does not
re-wobble on every render, honouring the existing `surface` prop for the
chalkboard's chalk line. It ships from paper-ui, not from here, for the
same reason the tokens did: the hand-drawn vocabulary lives in one place.
Until that release lands, this idea does not start.

**The sidebar goes back to rules.** [[IDEA-261]] replaced the sidebar's
dividers with a card per group; that decision is reversed here — the
reason it was made, an empty card for an empty group, is solved by a rule
that only renders between two groups that both have content.
`SidebarCard` is deleted and `SidebarShell` stacks its children again.

**The Stack keeps its cards.** A task card, the capacity card, and a
service row are objects on the chalkboard, not groups on a sheet; they
stay. So do `Modal` and `Toast`, which are floating layers, and the chat
and feedback bubbles, which mark who is speaking rather than where a
group ends.

**Rows keep their rhythm, not their boxes.** The dense row cards
(`plan-row-card` on Plans, Ideas, Roadmap, Log, Settings) lose the card
and keep the 32px grid, the hover wash, and the active state, which move
onto the row itself in `utilities.css`. A list of rows is one ruled block,
not thirty boxes.

### Out of scope

The Stack panel, modals, toasts, and speech bubbles, as above. Any change
to what a group contains or to the page grounds.

### Phases
- [ ] Adopt paper-ui's sketch Divider
      Bump the dependency once the release lands and confirm the seeded stroke honours `surface`.
- [ ] Rule the sidebar again
      Delete `SidebarCard`, stack the groups in `SidebarShell`, and render a rule only between two groups that both have content.
- [ ] Move the row affordances onto the row
      Give `plan-row-card`'s grid, hover wash, and active state to the row itself in `utilities.css`.
- [ ] Replace the page cards with ruled groups
      Every `Card` on a paper surface becomes its children plus a rule before the next group, none after the last.
- [ ] Delete `surface.card` and `surface.nestedCard`
