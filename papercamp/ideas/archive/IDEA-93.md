---
id: IDEA-93
title: Trace an idea from roadmap to release
type: feat
status: done
created: 2026-07-25
updated: 2026-07-29
released: v0.12.0
tags:
  - roadmap
  - core
  - app
subject: Insight from the task log
---

The chain from intent to shipped already exists in pieces but is not navigable: roadmap item → idea → phases → tasks → commits → PR → release line. [[IDEA-83]] built the last hop, so a release line now carries its idea id; `pr-lookup` resolves PRs by entity; `tasks.log` records every run against its plan id. Nothing joins them up, so "what was actually done, and where did it come from" is a question you answer by hand.

Make the trail first class in both directions: from a roadmap item, see the work it produced and how far it got; from a release line or a commit, get back to the idea that motivated it. This is the concrete answer to tracking progress — it turns provenance from a reconstruction exercise into a click path, and it makes the corpus legible to someone who wasn't in the room.

Depends on [[IDEA-91]] for the roadmap end of the chain.

### Phases
- [x] Model the provenance trail
      A `src/core` resolver that assembles the full chain for an entity — idea → phases → `tasks.log` runs → commits → PR → release line — reusing `pr-lookup` and the release-line idea id [[IDEA-83]] added.
- [x] Resolve the trail backward from a release line or commit
      Parse the idea id already stamped on each CHANGELOG release line, and map a commit back to the entity that produced it, so a shipped change points home to its idea.
- [x] Resolve the trail forward from an entity
      Gather an entity's `tasks.log` runs, its branch commits, its PR, and its release line into the trail model, with each hop carrying its reached / not-reached state.
- [x] Expose the trail through a server route
      A route returning the assembled trail for an entity plus the reverse lookup for a release line or commit, degrading cleanly when GitHub or a release line is absent.
- [x] Surface the trail on the entity detail view
      A provenance panel in `entity-detail.tsx` rendering the chain as a click path — tasks, commits, PR, release line — so "what was done and where it went" is visible on the idea.
- [x] Extend the roadmap end with the deeper trail
      Building on [[IDEA-91]]'s item → idea rollup, let a roadmap item resolve through to the work it produced and how far it got (tasks, PR, release), not just its child ideas' statuses.
- [x] Type-check and full pass
