---
id: IDEA-87
title: Margin notes on plans and phases
status: idea
created: 2026-07-25
updated: 2026-07-25
---

Reading a plan and reacting to one specific phase or paragraph is the real loop, but the app has nowhere to put that reaction. The only affordance is the Comments section (`CommentsSection` in `src/app/features/plans/views/entity-detail.tsx`), which appends to a flat entity-wide `log` — a note that doesn't know what it's about, so nothing can act on it and it reads as a comment graveyard. The thinking ends up in a chat session instead of the corpus.

Introduce an anchored **margin note**: a note affordance on every phase row and every body section, storing (anchor, prose, state) on the entity, where the anchor is a phase index or a body section. A "Rework from my notes" action then collects the open notes and hands them to the existing reconcile task, which already renders a before/after preview with approve/discard (`launchPlanReconcile`, `src/app/stores/app-store.ts`). Applied notes resolve, so notes behave as a work queue rather than a log.

Most of the plumbing exists: `PATCH /api/plans` already writes `body`, `phases`, and `log`, and reconcile already solves the risky part (an agent rewriting a plan you then approve). What's missing is the anchor model, the UI affordance, and bundling notes into the reconcile prompt.

Shares one primitive with [[IDEA-89]] — anchored human prose in, agent-applied structured change out. Build this first; [[IDEA-89]] then becomes mostly a second anchor point.
