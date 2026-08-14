---
id: IDEA-169
title: Draft all ideas at once
type: feat
status: done
created: 2026-08-13
updated: 2026-08-14
tags:
  - app
  - plans
  - agent
subject: Planning surface
---

The worklist actions menu (`worklist-actions-menu.tsx`) gains a **Draft all**
item beside Suggest ideas, Reconcile all and Prioritise queue: one action that
turns every undrafted idea into a plan.

### It mirrors batch-reconcile, not a fan-out

`draft` is an entity-scoped write — `writeSetFor` returns
`{scope: 'entities', ids: [entityId]}` — so N drafts against N different ideas
do **not** collide. The gate would admit every one of them and spawn N agent
processes simultaneously. Eleven concurrent agents is not what this action
means.

Instead it mirrors `startBatchReconcile` exactly: a single task with
`taskKind: 'batch-draft'` holding `{scope: 'entities', ids: 'all'}`, a stub proc
replaced per entity, and a sequential loop calling `runPhaseProcess` with
`buildPlanDraftPrompt(idea, otherPlans)` per candidate — pushing per-entity
progress lines and drafted/skipped/failed counters the way batch-reconcile
already does. `agent-slice.ts` already special-cases a `batch-reconcile` task in
the status poll and `batch-draft` joins it; `taskSubtitle` in the Stack panel's
`agent-section.tsx` gains its label.

### You pick which

Candidates are entities with `kind !== 'note'`, no `### Phases`, and a status
that is neither `done` nor `dropped`. But "every undrafted idea" is not always
what you want: [[IDEA-117]] is deliberately undrafted pending product decisions,
and drafting it would produce a plan that guesses.

So the menu item opens a confirm `Modal` listing the candidates as checkboxes,
all checked by default, with the count. Unchecking is how an idea opts out — no
new frontmatter marker to invent, and the cost (N agent runs) is visible before
you commit to it. The selected ids are what the route receives.

### Prerequisite: [[IDEA-137]] lands first

Do not build this before [[IDEA-137]]. Draft output exists only as uncommitted
working-tree state, and this action multiplies exactly that: one click leaves N
freshly-drafted plans uncommitted at once. The next thing anyone does is run-all
on one of them — the precise path where a phase agent's `git stash` swept a
drafted plan away and the pop then conflicted on the live-written
`run-order.md`. Draft-all turns a one-plan blast radius into an N-plan one.

[[IDEA-137]]'s fix does not fully cover this on its own either: committing
pending `papercamp/` changes at branch setup protects the plan being run, and
the other N−1 drafts survive only because that commit stages broadly. That is
acceptable, but it means IDEA-137 must land before this, not alongside it.

### Out of scope

Drafting notes — they never grow phases. Any auto-run after drafting: this
produces plans, it does not execute them. Re-drafting an entity that already has
phases; that is what Reconcile all is for.

### Phases
- [x] Register the `batch-draft` task kind
      Add it to `TaskKind` in `src/types/index.ts` and to `writeSetFor`'s
      `ENTITY_WRITER_KINDS` returning `{scope: 'entities', ids: 'all'}`, exactly
      as `batch-reconcile` does.
      run: 1m50s · 5.9k in · 3.3k out · sonnet-5
- [x] Build `startBatchDraft` in the agent manager
      Mirror `startBatchReconcile` in `src/app/server/agent.ts`: one admitted
      task, a stub proc replaced per entity, a sequential loop over the selected
      ids calling `runPhaseProcess` with `buildPlanDraftPrompt(idea, otherPlans)`,
      pushing per-entity progress lines and drafted/skipped/failed counters.
      run: 2m40s · 667 in · 10.2k out · sonnet-5
- [x] Wire the launch route
      Add `POST /api/agent/launch-draft-all` in `routes/agent.ts` taking the
      selected ids, plus the `launchBatchDraft` store action feeding the Plans
      slice, alongside the existing launch actions.
- [x] Fold the task into the status poll
      Have `agent-slice.ts` join `batch-draft` to the `batch-reconcile` case it
      already special-cases, and add its `taskSubtitle` label in
      `agent-section.tsx` (and `humanizeTaskKind`).
      run: 1m33s · 2.5k in · 5.4k out · sonnet-5
- [x] Menu item and candidate confirm modal
      Add **Draft all** to `worklist-actions-menu.tsx`; it opens a `Modal`
      listing candidates (`kind !== 'note'`, no `### Phases`, status not
      `done`/`dropped`) as checkboxes all checked by default with the count, and
      passes the checked ids to the route.
      run: 4m47s · 1.5k in · 18.7k out · sonnet-5
- [x] [manual] Draft all ideas at once
- [x] [manual] Add phase checklists to IDEA-117 through IDEA-168
