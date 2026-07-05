---
id: IDEA-6
title: Plan and phase IDs
type: feat
status: done
created: 2026-06-21
updated: 2026-06-21
tags:
  - app
  - plans
  - core
---

Gave plans permanent <KIND>-<N> ids, headline-length titles, the phase title/description split, and the idea backlink field.

### Phases
- [x] Add Kind field and ID counters
      Add a `Kind` field (`feat | fix | chore | docs | refactor` — spelled exactly like Conventional Commits' own type strings) to `PlanEntry`, plus a persistent per-kind ID counter (`nextId: { feat: number, ... }`) in `.paper-camp/config.json`; assign `<KIND>-<N>` (uppercased `Kind`) at plan-creation time only, never derived from existing file contents
- [x] Add Idea backlink field
      Add an optional `**Idea:** IDEA-N` field to plan entries (parser + serializer), and prefix `ideas.md` headings with `IDEA-N:`, numbered in file order
- [x] Rewrite plan titles to headlines
      Rewrite existing `plans.md` titles to short headlines (2–6 words), moving any lost context into each entry's existing `body` paragraph
- [x] Render plan IDs and short titles
      Render `<Stamp>{id}</Stamp> {shortTitle}` everywhere a plan is listed — `plan-card.tsx`, `plan-nav-item.tsx`, `kanban-card.tsx`, `plans-sidebar.tsx`, and the `plan-detail.tsx` header
- [x] Add phase description support
      Split `PhaseItem` into its existing short `text` plus an optional `description`; update `extractPhases` in `src/core/parser.ts` to read an indented continuation paragraph as the description, fully backward-compatible with phases that have none
- [x] Build paper-ui Accordion
      Build a paper-ui `Accordion` component (none exists yet — checked `~/dev/paper-ui/src/components`) and wire it into `plan-detail.tsx`'s phase list, showing the expand control only when a phase has a `description`
      The component is added to `paper-ui` itself rather than inline in paper-camp, because
      disclosure patterns will be useful beyond this one phase list; it exposes `expanded`
      and `onToggle` so callers stay in control of state.
- [x] Add commitlint conventions
      Add `@commitlint/cli` + `@commitlint/config-conventional`, using the same type vocabulary as `Kind` so a plan's ID prefix and its closing commit's type are the same word
- [x] Replace Accordion with expandable Table in plan-detail
      Replace the Accordion-based phase list in plan-detail.tsx with paper-ui's Table component using the expandable prop, showing phase descriptions in chalkboard-textured sub-rows
