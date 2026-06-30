---
id: FEAT-8
title: Ideas board
kind: feat
status: done
created: 2026-06-21
idea: IDEA-8
updated: 2026-06-21
tags:
  - app
  - plans
  - ideas
---

Replaces the flat "Ideas" grid in the Plans page with a two-column board (Planned /
Done), gives ideas the same short-title treatment as plans, and surfaces every plan
that implements a given idea. Depends on the previous plan's `Idea` backlink field and
`IDEA-N` numbering — an idea's Planned/Done state and its linked-plans list are both
derived from that field, not stored separately. See ideas.md's "Ideas board —
Planned/Done columns, priority order, short titles, and idea↔plan links" for the full
rationale.

### Phases
- [x] Move idea parsing into core
      Move idea parsing into `src/core/parser.ts`/`src/types/index.ts` as a real `IdeaEntry` type (`id`, `title`, `body`), replacing the ad-hoc client-side `parseIdeas` in `app-store.ts`
- [x] Rewrite ideas.md headings
      Rewrite existing `ideas.md` headings to short titles with their `IDEA-N:` prefix
- [x] Derive idea Planned/Done state
      Derive each idea's Planned/Done state: "Done" only when every plan whose `Idea` field references it is `done`/`dropped`; everything else (including ideas with zero linked plans) is "Planned"
- [x] Build two-column ideas board
      Build the two-column board, reusing `kanban-column.tsx`'s existing column shell, replacing the flat grid in `list-view.tsx`
- [x] Add idea rows with linked plans
      Each idea row shows an icon (lightbulb for Planned, checkmark for Done) and its short title; expanding it lists every linked plan as a clickable `Stamp` per plan ID
- [x] Order ideas by file position
      Order ideas within each column by their position in `ideas.md` (priority = file order); read-only for v1, no reorder controls yet
