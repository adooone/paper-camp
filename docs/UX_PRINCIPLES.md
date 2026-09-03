# paper-camp UX/UI principles

This document is the source of truth for how the UI should *feel* to use —
layout behavior, visual hierarchy, motion, and similar judgment calls. It is
separate from [`CODE_STYLE.md`](CODE_STYLE.md), which covers how the code
implementing the UI is written (components, tokens, file layout). When the two
overlap, `CODE_STYLE.md` has the "how" (which token, which prop) and this file
has the "why"/"when".

## 1. Layout stability

Dense, state-driven panels (the Stack panel and anything like it) are where
layout-jump complaints come from. Rules, in priority order:

- **Never wrap a control row to a second line. Degrade instead.** This is the
  strict one. A toolbar, header, or action row must occupy exactly the number of
  lines it occupies at every viewport width — a button that sits top-right at
  1400px must still be top-right at 1100px, not pushed onto a new line where
  nobody looks for it. When the space runs out, in this order: shorten the label,
  drop the label for an icon, or move the least-important controls behind an
  overflow menu. Never `flex-wrap` a row of controls, and never let a grid column
  collapse until its contents overlap. If the only way to fit everything is to
  wrap, something in that row does not belong at that width — hide it.

  Two failures this prevents, both observed at a 1200px viewport: a 26px-wide
  commit input beside a 272px commit button, and a phase title whose text ran
  63px past the run-metadata beside it, rendering one on top of the other. Both
  came from a flexible column being allowed to shrink without a floor.

  Give every flexible cell a `min-width` floor, and decide explicitly what
  disappears first when the floor is hit. **Priority goes to what the user reads
  or types, not to what they click** — a commit title the user is composing
  outranks the Commit button beside it, because the button still works at icon
  size and the input does not work at 26px.
- **Reserve space for content that changes, don't conditionally mount it.** A
  status indicator that sometimes shows a suffix (e.g. a `…` running marker) or
  a message that sometimes appears (e.g. a fail message + suggested fix) should
  always render that slot and vary its *content*, not its presence —
  `visibility: hidden` to reserve width, one always-rendered message slot with
  branching content inside instead of several independently-conditional blocks.
  Conditionally mounting/unmounting an element is what causes surrounding
  elements to visibly shift or jump.
- **Center content as a group within a fixed-height container; don't anchor it
  to one edge by default.** A short message in a taller, fixed-height section
  should center vertically (`justifyContent: 'center'` on the section's flex
  column), not stick to the top and leave dead space below. Only anchor to an
  edge when there's a deliberate reason (e.g. a log that should grow downward
  from a fixed top).
- **An empty state is the populated state with the values missing — not a
  different layout.** Do not branch a component into two shapes. Render one
  structure and vary what fills it: the same rows, the same stamps, the same
  controls, with placeholder values (`no report`, `no data yet`, a bar at zero)
  where the numbers would be. Matching only the *height* of two different
  layouts is the weaker version of this rule and drifts the moment either side
  changes.

  This is also what keeps a fixed-height card from overflowing. A capacity card
  pinned to `4.625rem` held a two-row reading, but its empty branch was a
  free-flowing sentence plus a link — which wrapped to two lines and clipped
  under the card's edge. Two fixed rows fit by construction; prose in a
  fixed-height box does not. **Anything inside a fixed-height container must be
  a fixed number of rows.**
- **A container may fix its size; nothing inside it may.** When a box has a
  height, its contents flex to fit — rows share the space, controls shrink, and
  no child carries a height, width, or padding of its own that can push past the
  edge. **When content overflows a fixed container, shrink the content; do not
  grow the container.** Growing it is the tempting fix and the wrong one: it
  silently resizes every sibling that shares the size, and the real offender (a
  control with a fixed height) is still there to break the next layout.

  Concretely, a capacity card clipped by 8px inside a shared 4.625rem card. The
  cause was an `IconButton` at its natural 40px inflating the header row; the
  first fix grew both cards to 5.5rem, which hid the symptom and enlarged the
  agent card for no reason. The right fix let the icon size to its content
  (`h-auto w-auto p-0`) and gave the rows a wrapper that owns the layout.

  Related trap: a component library's outer element is not always the one that
  lays out your children. Passing `flex flex-col justify-center gap-1` to
  paper-ui's `Card` puts those classes on its *border* layer, while an inner
  texture layer arranges the children with its own spacing — 13px of gap that no
  class of yours controls. **Wrap your rows in a `div` you own and put the
  layout there**, letting the library element carry only the size.
- **Reserve exactly what the common case occupies — over-reserving is the same
  bug as under-reserving.** Space held for content that rarely appears reads as
  a mysterious gap. The Stack panel's task area reserved `6.625rem` for one card
  *plus* an "N more…" row that almost never renders (only one task is ever
  visible), leaving ~2rem of dead space above the next card. Reserving one card
  (`min-h-[4.625rem]`) removed the gap and still held the section steady as
  tasks start and clear. Size the reservation to what is normally there, not to
  the worst case.
- **Verify across states, not in isolation.** Layout balance only shows up when
  you trigger every state of a component (loading, pass, fail, empty,
  populated) live in the browser — reasoning about one state's styles in
  isolation misses how it compares to the others.

## 2. Visual hierarchy

- **Reserve Luminari (the serif/title font) for headings and special titles
  only.** Page H1s, markdown headings, and a deliberate one-off "special title"
  moment — not body text, not table rows, not buttons, not sidebar nav items.
  Everything else should read in the simpler body font so the ornate display
  font keeps its weight as a signal of "this is a heading," not background
  noise. (Implementation: `--paper-font-default` in `src/app/styles/utilities.css`
  — see `CODE_STYLE.md`'s Fonts section.)
- Within a list item or card, the title should be the most visually dominant
  element (larger and/or bolder than metadata, tags, or body text) — but match
  styling for the *same kind of title* across views (e.g. a plan's title reads
  the same way in the list and in its detail view) rather than inventing a
  different weight per screen.
- **One font per line of text.** A line that mixes fonts to highlight its
  numbers (a mono `16%` inside a sans sentence) reads as a rendering bug, not as
  emphasis. Pick the font for the whole line — including its digits, durations
  and percentages — and let size, weight, or colour carry any emphasis within
  it.
- Prefer paper-ui's existing `Stamp`/color conventions for conveying state
  (pass/fail/running, plan status) over inventing new color meanings. Once a
  color means something in one place (e.g. rose = fail), keep that meaning
  everywhere else it appears.

## 3. Motion

Motion should be restrained and purposeful — it should clarify a state change
(a panel sliding in, a list item arriving), not decorate. Avoid motion for
motion's sake, and respect the user's reduced-motion system preference. See
"Motion" in `CODE_STYLE.md` for which library/pattern to reach for.

## 4. Verifying changes

UI/UX changes should be confirmed live in the browser (Claude in Chrome or
equivalent), not just by reading the JSX — this is how the layout-stability and
visual-hierarchy issues above actually get caught. `tsc`/lint/tests verify
correctness, not how something looks or feels.
