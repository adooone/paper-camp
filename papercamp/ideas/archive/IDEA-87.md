---
id: IDEA-87
title: Margin notes on plans and phases
type: feat
status: done
created: 2026-07-25
updated: 2026-07-29
released: v0.12.0
tags:
  - app
  - plans
  - ui
  - core
subject: Richer review loop
---

Reading a plan and reacting to one specific phase or paragraph is the real loop, but the app has nowhere to put that reaction. The only affordance is the Comments section (`CommentsSection` in `src/app/features/plans/views/entity-detail.tsx`), which appends to a flat entity-wide `log` — a note that doesn't know what it's about, so nothing can act on it and it reads as a comment graveyard. The thinking ends up in a chat session instead of the corpus.

Introduce an anchored **margin note**: a note affordance on every phase row and every body section, storing (anchor, prose, state) on the entity, where the anchor is a phase index or a body section. A "Rework from my notes" action then collects the open notes and hands them to the existing reconcile task, which already renders a before/after preview with approve/discard (`launchPlanReconcile`, `src/app/stores/app-store.ts`). Applied notes resolve, so notes behave as a work queue rather than a log.

Most of the plumbing exists: `PATCH /api/plans` already writes `body`, `phases`, and `log`, and reconcile already solves the risky part (an agent rewriting a plan you then approve). What's missing is the anchor model, the UI affordance, and bundling notes into the reconcile prompt.

Shares one primitive with [[IDEA-89]] — anchored human prose in, agent-applied structured change out. Build this first; [[IDEA-89]] then becomes mostly a second anchor point.

### Phases
- [x] Model the anchored margin note
      Add a margin-note type — `anchor` (a phase index or a body section), `prose`, and an open/resolved `state` — to the shared types, and parse/serialize it as a `### Notes` body section that round-trips through `parseEntityFile`/`formatEntityFile` alongside the existing Phases/Log/Clarifications sections. Cover the round-trip in `parser.test.ts`.
- [x] Persist notes through `PATCH /api/plans`
      Extend the entity write path so adding, editing, and resolving a note saves via the existing PATCH route next to `body`/`phases`/`log`, and add the matching client wrapper in `plans-api.ts` / the app-store slice.
- [x] Add the margin-note affordance in `entity-detail.tsx`
      Put an add-note control on every phase row and every body section, and render each anchor's open notes inline with a resolve action, so a reaction attaches to the specific phase or paragraph it is about rather than the flat entity-wide log.
- [x] Bundle open notes into a "Rework from my notes" action
      Collect the entity's open notes, compose a rework prompt quoting each note against its anchor, and launch through the existing `launchPlanRework` / `launch-rework` reconcile-preview path (`app-store.ts`) so the agent's rewrite lands in the same before/after approve/discard gate.
- [x] Resolve applied notes on approve
      When a rework preview is approved, flip the notes it addressed to `resolved` so they drop out of the queue; discarding the preview leaves them open, keeping notes a work queue rather than a log.
- [x] Type-check and full pass
      Run `pnpm run check-types`, `npx biome check . --write`, and `pnpm test` clean across the repo.
