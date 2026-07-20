---
id: IDEA-74
title: Goal and roadmap in the app
type: feat
status: review
created: 2026-07-19
tags:
  - app
  - docs
  - plans
  - ui
subject: Workflow
---

The project now has a stated goal and a horizon-structured roadmap (`ROADMAP.md`), but it renders as just another doc. The roadmap deserves to be a surface, not a page of prose: the north star always visible, horizons as groups, and — the part that makes it *part of the workflow* rather than decoration — each item one click away from becoming a real idea. The map feeds the queue.

The promotion machinery already exists: [[IDEA-62]]'s suggestion flow takes a one-liner, launches a refining agent, mints an id, writes the entity file, and removes the promoted line from its source. A roadmap item is the same shape with a better-written source. Parsing is the only new core work: a light grammar over `ROADMAP.md` (h2 `## Horizon N — …` sections, `- **Item name** — description` bullets, the `## The goal` block as the north star) — same load-bearing-heading discipline as the `### Phases` grammar, documented the same way.

- **A Roadmap view.** Route + nav item (or a section of Docs, judged during implementation): goal statement styled as the page's masthead, horizons as groups (the worklist's subject-group pattern fits), each item a row card with its description.
- **Promote to idea.** Per-item action reusing the suggestion-promotion agent: refine the bullet into a full idea file, assign subject (default from a horizon → subject mapping, or picked in a modal), then *remove the bullet from `ROADMAP.md`* — the file stays the honest map of what hasn't started, exactly as its "How this file works" section promises.
- **Provenance both ways.** The promoted idea's body links back to its horizon; the roadmap shows a subtle count of what's already graduated ("Horizon 1 — 3 shipped").

### Phases
- [x] Parse the roadmap grammar
      `core/`: parse `ROADMAP.md` into `{ goal, horizons: [{ title, items: [{ name, description }] }] }` — tolerant of prose between sections, with round-trip removal of a single item bullet (for promotion). Tests for parse + item removal.
- [x] Render the Roadmap surface
      Goal as masthead, horizons as groups of item row cards, served by a new read route; decide route-vs-Docs-section during layout and record the call in the idea log.
- [x] Promote an item to an idea
      Per-item action through the existing suggestion-promotion path (refining agent, id mint, index regen) plus bullet removal from `ROADMAP.md` in the same operation; subject picked at promotion.
- [x] Gate the pass
      `tsc --noEmit`, `biome check`, tests green (parser round-trip covered); promote one real item end-to-end in the app and confirm the file, the queue, and the view all agree.

### Log
- 2026-07-20: Phase 2 — Chose a dedicated top-level route (`/roadmap`, own nav item) over a Docs section. Docs' section mechanism (`DOC_SECTIONS`, `docs-page.tsx` branching) is built for flat markdown rendering of `RepoDocDetail`, and phase 3 will hang an interactive per-item "Promote to idea" action (with a subject-picking modal) off this surface — a route gives it room to be a real UI rather than mixed in with static doc prose. Server: `/api/roadmap` in `reads.ts` returns `parseRoadmap(ROADMAP.md)`; dropped `ROADMAP.md` from the flat `/api/docs` list since the new surface supersedes its raw rendering there. Client: `RoadmapPage` (`features/roadmap/`) — goal styled as a masthead, horizons as titled groups of item row cards, mirroring the worklist's subject-group pattern (`Card size="small" texture="canvas" className="plan-row-card"` rows under a handwritten-font group header).
