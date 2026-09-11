---
id: IDEA-259
title: One grammar for every sidebar
type: refactor
status: idea
created: 2026-09-11
tags:
  - app
  - ui
subject: App UI
order: 1
---

The idea sidebar mixes four ways of saying "do this": ListItem rows with
raw glyphs (`▶`, `⎇`, `✓`, `⊘`, `▣`) tinted by hand, a *Redraft* that is a
Button in another face with no icon, a status stamp floating in a 64px
block, and two fields of different widths — Subject full-width, Order
squeezed beside its label. Each of the six sidebars — the idea's, the
Plans filters, Roadmap, Log, Docs, Settings — carries its own copy of
the section-label class and its own idea of where search, buttons, and
stats go. They sit on the same 32px grid and still read as six designs.

**Four pieces, one grid.** `src/app/components/sidebar/` holds the whole
vocabulary, and no sidebar defines a row of its own:

- `SidebarLabel` — a section title on one row, handwritten, muted, always
  above what it labels. It replaces the three private `sectionLabelClass`
  copies and `SidebarSection`'s inline span.
- `SidebarField` — a label row above a full-width control row. Every
  input and select in a sidebar is one of these; no control sits beside
  its label and none is narrower than the column.
- `SidebarCommand` — one row: an icon from `icons.tsx` on the left, the
  label in the default face at weight 600, an optional muted mono note
  beneath. It takes `disabled`, a `busy` label, and `tone: 'danger'` for
  destructive rows, which tints icon and text rose. Every action in every
  sidebar is this row; the glyph spans and the Button-as-command go.
- `SidebarDivider` — a hairline between groups that mean different
  things, never between rows.

Tabs and navigation rows stay ListItems; their labels move to the
handwritten face so a sidebar's headings all share one voice, and the
row text keeps the default face.

**The entity sidebar.** Tabs first. The status stamp on one 32px row.
Subject and Order as two `SidebarField`s. A divider, then the work
commands — *Create branch* with its branch note, *Run all phases*,
*Redraft* with the wand, *Fix review*, *Review PR*, *Complete idea* —
then a divider and the lifecycle commands — *Archive*, *Mark dropped* or
*Reopen*. A command that is not available right now is rendered
disabled, not removed, so the column keeps its shape while an agent runs;
a command that never applies to this entity — a branch on a board — is
not rendered.

**The filter sidebars.** Plans, Roadmap, and Log share one order: the
search field on the first row, chip rows with a status dot and a
right-aligned count, fields, a *Clear filters* row when any filter is
set, a divider, then the stats grid where the page has one. Roadmap's
*Add item* button leaves the sidebar for the page title row, so the top
slot is search on every filter page.

**The navigation sidebars.** Docs and Settings keep their sections and
rows, on `SidebarLabel` instead of `SidebarSection`, with the search row
in Docs unchanged.

**What is deleted.** `SidebarSection`, the three `sectionLabelClass`
constants, every `<span>` glyph used as an icon, the `h-[64px]` wrappers
around stamps and inputs, and the per-sidebar `flex-col` scaffolding the
pieces replace.

### Out of scope

The Git page's file list and the Stack panel, which are not sidebars in
this sense. Changing which commands an entity offers or when. New icons;
`icons.tsx` has one for every command listed.

### Phases
- [x] Build the four sidebar pieces
      `SidebarLabel`, `SidebarField`, `SidebarCommand`, and `SidebarDivider` in `src/app/components/sidebar/`, with unit tests for the command's disabled, busy, and danger states.
      run: 2m48s · 54 in · 10.7k out · sonnet-5 · sess:0efd8bb2-617b-4f0d-ae31-3bbd66b75537
- [x] Rebuild the entity sidebar on them
      `plan-actions-column.tsx` and every action in `plans/actions/` become `SidebarCommand`s with `icons.tsx` icons; the stamp, Subject, and Order rows take the field grammar.
      run: 7m3s · 72 in · 35.1k out · sonnet-5 · sess:0efd8bb2-617b-4f0d-ae31-3bbd66b75537
- [ ] Rebuild the filter sidebars on them
      Plans, Roadmap, and Log in the shared order; *Add item* moves to the Roadmap title row.
- [ ] Rebuild the navigation sidebars and delete the old scaffolding
      Docs and Settings on `SidebarLabel`; remove `SidebarSection`, the label-class copies, and the glyph icons.
