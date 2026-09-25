---
id: IDEA-280
title: Adopt paper-ui's text, links and icons
type: refactor
status: review
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
- [x] Bump paper-ui to the release carrying its IDEA-4
      run: 2m15s · 24 in · 2.8k out · sonnet-5 · sess:eee9e66e-0bb9-436a-a5eb-f260afcc2182
- [x] Swap typography strings for the library's text components
      Delete the local heading, inline-code, command-line, page-title and
      empty-state helpers, and pass the doodle as `EmptyState`'s `illustration`.
      run: 8m54s · 224 in · 44.9k out · sonnet-5 · sess:eee9e66e-0bb9-436a-a5eb-f260afcc2182
- [x] Fold both facts grids into one `FactsGrid`
      run: 1m41s · 66 in · 7.4k out · sonnet-5 · sess:1201b78d-2e94-4790-ba6f-524caf0fcb0b
- [x] Replace raw buttons with `Stamp`, `Button variant="link"` and `Card onClick`
      run: 7m34s · 194 in · 43.4k out · sonnet-5 · sess:1201b78d-2e94-4790-ba6f-524caf0fcb0b
- [x] Delete `icons.tsx` and import every glyph from the library
      run: 3m41s · 130 in · 21.8k out · sonnet-5 · sess:f7cbabde-a49d-42b5-817a-6a19bb2d07ef

### Fixes
- [x] Every page title keeps its 24px gap
      `docs-page`, `stats-page`, `plans-page` and the three `roadmap-page` titles pass `mb-6` until `PageTitle` defaults to it again.
      run: 2m22s · 72 in · 11.3k out · sonnet-5 · sess:0857bfab-d348-4fe8-94a7-a01412940e3d
- [x] `run-entry-page` keeps its action under the empty state
      The `Button` goes back into `EmptyState`'s `action` slot once paper-ui restores it; until then the wrapper gap is 12px with no extra padding.
      run: 1m26s · 28 in · 6.6k out · sonnet-5 · sess:0857bfab-d348-4fe8-94a7-a01412940e3d
- [x] Lightbulb and Note keep their .55 opacity and the stop button its 20px
      Every `LightbulbIcon`/`NoteIcon` call site passes `opacity={0.55}` (or `className="opacity-[0.55]"` until the prop exists); `agent-section.tsx`'s stop `IconButton` is back to the 20px override.
      run: 1m12s · 44 in · 5.2k out · sonnet-5 · sess:0857bfab-d348-4fe8-94a7-a01412940e3d

### Thread
- [x] 2026-09-24 [note] The unrun fixes here moved to [[IDEA-285]], one run for everything still adrift from the baseline.
