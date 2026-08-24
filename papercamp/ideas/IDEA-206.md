---
id: IDEA-206
title: Mark board ideas done
type: fix
status: planned
created: 2026-08-24
updated: 2026-08-24
tags:
  - app
  - multi-project
subject: Planning surface
---

A `kind: board` entity (e.g. [[IDEA-195]]) has no phases and no PR of its own — its
tickets carry the work, per [[IDEA-201]]. Once every child ticket is `done`/`dropped`,
`deriveBoardStatus` (`src/core/status/status.ts:90-95`) already rolls the board up to
`status: 'review'`, and `readWorkEntries`/`readEntitiesWithDerivedStatus`
(`src/core/readers.ts`) write that derived status straight onto the `PlanEntry`/`EntityEntry`
the frontend receives — capped at `review` on purpose, since closing is a human promotion
(IDEA-187). But nothing in the UI ever lets that promotion happen for a board: the action
column in `plan-actions-column.tsx` gates every "this is done" affordance behind a check
that assumes a normal plan's shape, so a finished board is left with only "Mark dropped"
available, which is wrong for finished work.

### The gap, precisely

Two completion paths exist today, and a board qualifies for neither:

- `CompleteIdeaButton` renders only when `underReview && plan.pr` — a board never opens
  its own PR.
- `canMarkPlanDone` (`src/app/features/plans/helpers/helpers.ts:98-104`) is the
  no-PR/direct-to-main path, but it re-derives readiness from
  `plan.phases.length > 0 && plan.phases.every(p => p.done)` rather than trusting
  `plan.status`. A board's `phases` array is always empty, so this is always `false`
  regardless of how many tickets are done.

Even if `canMarkPlanDone` returned `true`, `handleMarkDone`
(`plan-actions-column.tsx:83-102`) calls `verifyDirectCompletion(plan.id)`
(`src/app/server/git.ts:442-451`) as its readiness gate, which checks for a clean working
tree and a commit on main whose message greps the plan's own id. A board has no branch or
commit of its own — its work lands under each ticket's id, not the board's — so this check
can never pass for a board.

The backend close-out endpoint itself has no gap: `POST /api/ideas/archive`
(`src/app/server/routes/content/ideas.ts:284-317`) is kind-agnostic — it only excludes
`kind: note` and already-archived entries, unconditionally stamps `status: 'done'`, and
moves the file to `archive/`. The fix is entirely in the two UI-side gates above.

### Fix

1. `canMarkPlanDone`: branch on `plan.entityKind === 'board'`. For a board, readiness is
   `plan.status === 'review'` — that value was just freshly derived from the ticket rollup
   in the same read, so it's as trustworthy as the phases check is for a normal plan.
   Leave the existing phases/fixes check untouched for every other entity kind.
2. `handleMarkDone`: skip the `verifyDirectCompletion` call for
   `plan.entityKind === 'board'` and go straight to `archiveIdeas([plan.id])` — a board's
   readiness was already fully verified by the ticket rollup that put it at `review`
   (step 1's gate); there is no commit or branch of the board's own left to check against
   git.

Out of scope: no MCP tool can close *any* entity to `done` today (`archive_entity` only
sets `dropped`) — that's a separate, broader gap across every entity kind, not
board-specific, and isn't part of this idea.

### Phases
- [x] Trust the board's derived status in `canMarkPlanDone`
      In `src/app/features/plans/helpers/helpers.ts:98-104`, branch on
      `plan.entityKind === 'board'`: for a board, readiness is `plan.status === 'review'`
      (already freshly derived from the ticket rollup by `readWorkEntries` on this same
      read). Every other entity kind keeps the existing
      `plan.phases.length > 0 && plan.phases.every(p => p.done)` check unchanged.
      run: 59s · 5.7k in · 3k out · sonnet-5
- [ ] Skip `verifyDirectCompletion` for boards in `handleMarkDone`
      In `plan-actions-column.tsx:83-102`, when `plan.entityKind === 'board'`, call
      `archiveIdeas([plan.id])` directly instead of gating on
      `verifyDirectCompletion(plan.id)` — that check greps main for a commit under the
      board's own id, which a board never has since its tickets carry the work under
      their own ids. The board's readiness was already fully verified by the ticket
      rollup that produced `status: 'review'` in phase one's gate.
