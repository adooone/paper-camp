---
id: FEAT-42
title: Unify the ideas and plans worklist
kind: feat
status: idea
created: 2026-07-04
idea: IDEA-43
tags:
  - app
  - ideas
  - plans
  - core
---

Ideas and plans live as two lists (`/` and `/ideas` since FEAT-37 phase 4), but the
workflow is one: capture an intention, refine it, draft plan(s), then track only the
plans. This plan merges the two into one worklist where ideas are grouping context,
not tracked items: idea rows render as parents in the same row-card language
(lightbulb icon, title, Extend/Draft-plan actions, and a derived children summary —
"2/3 plans done" — instead of a status stamp), with their linked plans indented
beneath as ordinary `plan-rows.tsx` rows via the existing `idea:` backlink; plans
without an idea stay top-level, and nesting stops hard at one level. Ideas stop
carrying tracked status entirely — `deriveIdeaStatuses` and the planned/done board
columns retire — except for a new `kind: note` declared at creation for ideas that
never need a plan, which gets a manually-set `open → done/dropped` status, a
distinct icon, and its own filter chip, with `ideaFrontmatterSchema` enforcing the
asymmetry (`status` is only valid on notes) so plan-bearing ideas can never carry a
stale hand-set one; `IDEA-37` retroactively becomes the first note. Ideas also gain
plans' dated `### Log` grammar so refinements append as history instead of mutating
the original intent, and the creation paths untangle into "New idea" (refine-first)
vs "Quick plan" (today's Add-to-backlog).

No storage migration: ideas and plans stay separate file types and the tree is
derived client-side from `idea:` backlinks. This builds directly on [[FEAT-41]]'s
factored filter/sort selector — filters and sorts become group-aware (a group sorts
by its most-advanced child; done children collapse behind "+N done" once a group
outgrows ~5 rows), which is exactly why that selector was kept out of
`list-view.tsx`. Coordination: [[FEAT-40]]'s per-item `/ideas/IDEA-16` param route
stays as the idea detail's address — only the `/ideas` list route and its header
nav item go away, with the row-card ideas list and New-idea button carrying into
the unified view; landing this supersedes the Ideas-vs-Backlog visual separation
decision and generalizes the "Planless ideas close via explicit frontmatter status"
decision, both to record in `decisions.md`. [[IDEA-44]]'s capture-time overlap
check is out of scope — this list just makes it natural later.

### Phases
- [ ] Add kind note and status asymmetry to the schema
      Extend `ideaFrontmatterSchema` with `kind: note` and a manual
      `open → done/dropped` status that zod only accepts on notes; retire
      `deriveIdeaStatuses` and the planned/done derivation, and mark `IDEA-37`
      as the first note — generalizing the planless-close decision.
- [ ] Give ideas the dated Log grammar
      Reuse plans' `### Log` (`- date: text`) shape in idea bodies —
      parse/serialize support plus AI extend appending a dated entry instead
      of mutating the original prose.
- [ ] Build the group-aware tree selector
      Extend FEAT-41's factored filter/sort selector to derive the two-level
      tree from `idea:` backlinks — idea parents with derived children
      summaries, orphan plans top-level, one level only — with group sort
      keyed to the most-advanced child and a note filter chip.
- [ ] Render the unified two-level worklist
      Idea rows as parents in the row-card language (lightbulb icon, title,
      Extend/Draft-plan actions, children summary), linked plans indented
      beneath as ordinary `plan-rows.tsx` rows with a slight inset and thin
      connector, notes with their distinct icon and status stamp, and done
      children collapsing behind "+N done" once a group outgrows ~5 rows.
- [ ] Retire the ideas route and rename creation paths
      Carry the New-idea button (modal gains the note toggle) into the unified
      list, rename Add-to-backlog to "Quick plan", remove the `/ideas` list
      route and header nav item (FEAT-40's per-item param route stays), and
      record the supersessions in `decisions.md`.
- [ ] Type-check and visual pass
      `tsc --noEmit`, `biome check`, tests, and a browser pass over the tree
      layout and connectors, group collapse, the note chip and note status
      edits, both creation modals, and the slimmed header nav.
