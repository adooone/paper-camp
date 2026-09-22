---
id: IDEA-280
title: Adopt paper-ui's text, links and icons
type: refactor
status: idea
created: 2026-09-22
tags:
  - app
  - ui
  - paper-ui
subject: One design system
order: 2
---

paper-ui's IDEA-4 ships the primitives this app hand-rolled. Blocked
until that release; the first phase bumps the dependency. Runs after
[[IDEA-279]].

**Typography strings become components.** The sixty
`font-handwritten`/size/opacity combinations become `Text`, `Label`,
`SectionHeading` and `MetaLine`; the six copies of `sectionHeadingClass`,
`detail-heading-style.ts`, `inline-code-style.ts`, `command-line.tsx`,
`page-title.tsx` and `empty-state.tsx` are deleted in favour of the
library's, with `EmptyState` given the doodle as its `illustration`. The
two facts grids in `run-row-detail.tsx` and `chunk-detail.tsx` become one
`FactsGrid`. The four `!text-*` overrides go with them.

**Raw buttons become components.** Every chromeless button around a
`Stamp` — `StampButton`, `stampTriggerClass`, `FilterChip` and the rest —
becomes `Stamp` with `onClick` and `pressed`. Every bare text link,
`LinkButton` and the three *Clear filters* become `Button
variant="link"`. Every whole-row button around a `Card` becomes the
`Card`'s own `onClick`, and the `role="button"` div in
`agent-section.tsx` with its `biome-ignore` goes. Sizing hacks on
`IconButton` become `size="tiny"`.

**`icons.tsx` goes.** All seventeen glyphs, `SidebarToggleIcon` and
`UndoIcon` import from the library; the local `LightbulbIcon` is
replaced by the exported one with `size`.

### Out of scope

Rows and sidebars, [[IDEA-281]].

### Phases
- [ ] Bump paper-ui to the release carrying its IDEA-4
- [ ] Swap typography strings for the library's text components
      Delete the local heading, inline-code, command-line, page-title and
      empty-state helpers, and pass the doodle as `EmptyState`'s `illustration`.
- [ ] Fold both facts grids into one `FactsGrid`
- [ ] Replace raw buttons with `Stamp`, `Button variant="link"` and `Card onClick`
- [ ] Delete `icons.tsx` and import every glyph from the library
