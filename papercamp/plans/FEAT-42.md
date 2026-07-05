---
id: FEAT-42
title: Unify the ideas and plans worklist
kind: feat
status: in-progress
created: 2026-07-04
idea: IDEA-43
updated: 2026-07-05
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

No storage migration in this first stage: ideas and plans stay separate file types
and the tree is derived client-side from `idea:` backlinks. This builds directly on [[FEAT-41]]'s
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

**Extension (2026-07-05):** phases 7+ complete [[IDEA-43]]'s single-file evolution —
the unification goes one level deeper, from the lists to the files. Ideas and plans
converge into one entity: an *idea* for its whole life, with the plan as a `### Phases`
section the drafting agent writes into the file that's already there; the UI flips
idea-shaped → plan-shaped on "are there phases yet". Every entity carries one lifetime
`IDEA-N` id (per the "Entity ids are lifetime IDEA-N" decision; `type` — today's
`kind`, renamed — drives commit types and branch prefixes like `feat/idea-99-…`). This
*is* the storage migration the first stage deferred: all legacy files merge, legacy
bodies simplify to brief summaries (git history keeps the detail), multi-plan ideas
split into one idea per plan, and the two-file readers retire. The idea→plans tree
phases 3–4 built goes flat again — thematic grouping returns later as the separate
*topics* entity (follow-up idea, out of scope here), and the group-aware
selector/renderer machinery transfers to it with the parent swapped.

### Phases
- [x] Add kind note and status asymmetry to the schema
      Extend `ideaFrontmatterSchema` with `kind: note` and a manual
      `open → done/dropped` status that zod only accepts on notes; retire
      `deriveIdeaStatuses` and the planned/done derivation, and mark `IDEA-37`
      as the first note — generalizing the planless-close decision.
- [x] Give ideas the dated Log grammar
      Reuse plans' `### Log` (`- date: text`) shape in idea bodies —
      parse/serialize support plus AI extend appending a dated entry instead
      of mutating the original prose.
- [x] Build the group-aware tree selector
      Extend FEAT-41's factored filter/sort selector to derive the two-level
      tree from `idea:` backlinks — idea parents with derived children
      summaries, orphan plans top-level, one level only — with group sort
      keyed to the most-advanced child and a note filter chip.
- [x] Render the unified two-level worklist
      Idea rows as parents in the row-card language (lightbulb icon, title,
      Extend/Draft-plan actions, children summary), linked plans indented
      beneath as ordinary `plan-rows.tsx` rows with a slight inset and thin
      connector, notes with their distinct icon and status stamp, and done
      children collapsing behind "+N done" once a group outgrows ~5 rows.
- [x] Retire the ideas route and rename creation paths
      Carry the New-idea button (modal gains the note toggle) into the unified
      list, rename Add-to-backlog to "Quick plan", remove the `/ideas` list
      route and header nav item (FEAT-40's per-item param route stays), and
      record the supersessions in `decisions.md`.
- [x] Type-check and visual pass
      `tsc --noEmit`, `biome check`, tests, and a browser pass over the tree
      layout and connectors, group collapse, the note chip and note status
      edits, both creation modals, and the slimmed header nav.
- [x] Converge the entity schema and core
      One frontmatter schema for the unified entity: today's plan schema with
      phases optional, `kind` renamed to `type` (values stay
      Conventional-Commits-shaped), `kind: note` kept as the planless marker
      with its manual status, and the per-kind `nextId` counters collapsed into
      a single `IDEA-N` counter. `parsePlanFile`/`parseIdeaFile` and
      `formatPlanFile`/`formatIdeaFile` converge on one parse/serialize pair;
      the `idea:` backlink field retires from the schema.
- [ ] Migrate every file into the unified corpus
      One-time migration into a single `papercamp/ideas/` tree (with `archive/`
      for done/dropped): merge each 1:1 idea↔plan pair with the plan file as
      base (idea prose above, logs concatenated, plan frontmatter wins, id
      becomes the idea's `IDEA-N`); mint fresh `IDEA-N` ids for orphan plans;
      split multi-plan ideas into one idea per plan with short bodies derived
      from the shared parent; simplify legacy bodies to a brief "what this was
      about" summary (AI-assisted rewrite pass, git history keeps the full
      text); regenerate one index and retire `papercamp/plans/`.
- [ ] Adapt the readers, API, MCP, and CLI
      One reader over the unified directory replaces
      `readPlansMerged`/`readIdeasMerged` (monolithic and two-file fallbacks
      retire); `/api/plans` and `/api/ideas` serve the same corpus (or collapse
      into one route); `regenerateIndexes` emits one table; MCP tools
      (`src/mcp/tools.ts`) and the CLI (`add`, `audit`, `migrate`) work on
      entities.
- [ ] Re-key the git and GitHub surfaces to IDEA-N
      Branch naming (`feat/idea-99-…` — `type` supplies the prefix), commit
      `Refs:` footers, the commit-suggest scope logic, agent hooks'
      branch-per-plan setup, the draft-PR "Plan:" line, and any prompts that
      reference plan ids. Legacy `<KIND>-<N>` references in git history stay
      as they are.
- [ ] Morph the UI to the single entity
      `IdeaDetail` and `PlanDetail` merge into one detail view that renders
      idea-shaped until phases exist and plan-shaped after ("create plan" =
      the drafting agent writing the Phases section); the worklist flattens
      (idea→plan grouping retires until topics land) with notes keeping their
      chip; "New idea" and "Quick plan" both create the same entity file
      (refine-first vs act-directly); id stamps show `IDEA-N`.
- [ ] Actualize the docs and closing pass
      Update `about.md`'s storage architecture, CLI, and API sections for the
      unified entity (plus `AGENTS.md` if it names the two-file shape), then
      `tsc --noEmit`, `biome check`, tests, and a browser pass over the
      migrated corpus: worklist, entity detail in both shapes, creation flows,
      and the re-keyed branch/commit surfaces.
