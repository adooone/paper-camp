---
id: IDEA-232
title: Illustrated empty states
type: feat
status: idea
created: 2026-09-04
updated: 2026-09-04
tags:
  - app
  - ui
subject: App UI
order: 1
---

An empty list in Paper Camp is a grey sentence. There are around twenty of
them, each written by hand at whatever opacity its author reached for:

```
docs-sidebar        italic, opacity-[0.35]     "No releases yet"
settings/desk       opacity-[0.45]             "No services yet."
tasks-page          opacity-50                 "No tasks have run yet."
git-page            opacity-50                 "No changed files."
file-diff-section   opacity-60                 "No changes to preview."
hub/projects        opacity-70                 "Nothing here yet — …"
```

`docs-sidebar.tsx` even defines a local `EmptyState`, four lines long, used
four times in that one file and nowhere else. Nothing else shares it, so the
same idea has been rewritten nineteen more times.

These are the moments a new project spends most of its time in — every list is
empty on day one — and they are the moments the product's voice goes missing.
The app is handwritten labels on parchment and chalk on a board; its empty
states are default sans-serif at 50% alpha.

**One `EmptyState` component**, in `src/app/components/`, owns the message,
the spacing and the optional illustration. Copy is handwritten, sized and
spaced once, so twenty surfaces stop each picking an opacity.

**Illustrations are drawn in this repo, not taken from the asset box.** They
are single-colour ink line drawings, authored as inline SVG that fills from
`currentColor`. That is what lets one asset serve both surfaces: the same
drawing reads as ink on a parchment page and as chalk in the Stack panel,
inheriting whichever `--pui-*` colour its container already sets. A
multicolour illustration would need two variants and would still fight the
palette.

The purchased doodle pack in `~/dev/box` is deliberately not the source. Its
licence permits use in an End Product but prohibits redistributing the assets
or their source files "regardless of any modifications" — and this project
redistributes twice over. `adooone/paper-camp` is a public repo, so a
committed SVG is downloadable by anyone; and `public/img/` ships inside the npm
tarball, which was confirmed by finding `dist/app/img/paper-logo.svg` in an
installed copy of 0.26.0. Drawing our own also removes the constraint for
good: once the set is stable it can move into paper-ui, which a purchased
asset never could.

**An illustration appears only where the empty region is a page or panel
body** — plans, tasks, git, inbox, issues, roadmap, docs. Card and row empties
(the six stats cards, the settings sub-lists, the Stack panel groups) use the
same component with no illustration, because a hundred-pixel drawing inside a
thirty-two-pixel row is the fixed-container mistake `docs/UX_PRINCIPLES.md`
already warns about.

**Four drawings cover every surface, chosen by meaning rather than by page**:
an empty tray for a list nothing has been added to (plans, roadmap, issues,
inbox), a resting pen for work that has not run yet (tasks), a clean sheet for
no pending changes (git), and a magnifier for a search that matched nothing
(docs). A fifth is added only when a surface means something none of these say.

The same component carries the other message surfaces that are not lists —
`runtime-unavailable.tsx` and the docs "no results" view — so a message with
nothing to show looks the same everywhere it appears.

### Out of scope

Loading and skeleton states, which are a different problem with a different
answer; the box's Lottie loaders are unusable here for the same licence reason
as the doodles. Error toasts, which are transient rather than a resting state.
Moving the component into paper-ui — worth doing once the drawings settle, not
while they are still being drawn.

### Phases
- [ ] One component for every empty message
      Add `EmptyState` to `src/app/components/` taking a message, an optional illustration and an optional action; handwritten copy, one spacing scale, one muted token instead of six opacities.
- [ ] Draw the four illustrations
      Single-colour inline SVG on a shared viewBox, filled from `currentColor` so one asset works on parchment and chalkboard; sized to the panel body, never to a fixed pixel height.
- [ ] Adopt it on the page and panel bodies
      Plans, tasks, git, inbox, issues, roadmap and docs render `EmptyState` with the illustration its meaning calls for, replacing the hand-rolled paragraphs.
- [ ] Adopt it on the card and row empties
      The six stats cards, the settings sub-lists and the Stack panel groups use the same component without an illustration; delete the local `EmptyState` in `docs-sidebar.tsx`.
- [ ] Cover it in tests and run the quality checks
      Assert the illustration is omitted when absent and that copy renders in both surfaces; check-types, lint, vitest, consistency green with no orphaned strings left behind.

### Thread
- [x] 2026-09-04 [decision] [user] Draw our own paper-native illustrations rather than using the purchased doodle pack, after the licence review below.
- [x] 2026-09-04 [log] [agent] Reviewed `~/dev/box` for the asset archive: ~500 multicolour doodles in 8 categories, 25 Lottie loaders, 33 3D models. Two blockers, both confirmed rather than assumed — `adooone/paper-camp` reports `"visibility":"PUBLIC"`, and `public/img/` demonstrably ships in the npm tarball. Its own README also notes the doodles are 99x99 multicolour that "cannot be recoloured with `currentColor`", which would have fought the parchment and chalkboard palettes even without the licence.
