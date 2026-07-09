---
id: IDEA-55
title: Actualise all ideas at once
type: feat
created: 2026-07-08
updated: 2026-07-08
tags:
  - app
  - plans
  - agent
---

The "Audit all" button on the worklist does a narrow, append-only job: a convergence audit over `review`/`done` plans that only *adds missing phases* and is forbidden from touching prose (`buildConvergenceAuditPrompt` in `prompts.ts`). There is no one-click way to do the thing that actually rots over time — keep every idea's *description* honest as the codebase moves under it. Actualising the backlog today means opening each entity and running per-plan **Reconcile** by hand.

- **New list-level "Actualise all".** One button on the plans header that sweeps the whole worklist and, per entity, runs the existing Reconcile agent — which reads the entity against the current code and proposes an updated body + phases. This is Reconcile (`buildReconcilePrompt`, the `reconcilePreview` before/after flow) batched, not a new agent behaviour.
- **Per-entity review queue.** The sweep never writes silently: each entity's proposed rewrite lands in a queue of before/after diffs the user approves or discards one at a time (same guarantee as today's single Reconcile, just many of them). Nothing changes on disk without an explicit approve.
- **Replaces "Audit all".** The append-missing-phases behaviour is subsumed — Reconcile already rewrites body *and* phases, so a broad actualise pass catches the "forgot to record a phase" case too. Drop the Audit-all button, `startBatchAudit`, and the convergence-audit prompt path once the reconcile sweep covers their ground.
- **Reuse, don't rebuild.** The batch-iteration loop already exists in `startBatchAudit` (it walks entities and runs an agent on each); swap the audit prompt for the reconcile prompt, widen the selection, and route each result into the review queue instead of writing in place.

Operates on [[IDEA-43]]'s unified worklist. Open questions for the planning pass: **scope** — sweep only plan-bearing entities, or include backlog ideas (`status: idea`) and planless notes whose prose also drifts?; **queue surface** — reuse the reconcile diff panel one-entity-at-a-time, a dedicated review lane, or the Stack panel?; and **long-run UX** — how the button reports progress and stays cancellable while an N-entity agent sweep runs (the current single-agent `agentStatus`/busy model only tracks one task at a time).

The mechanics all exist; this plan re-plumbs them. The sweep is a new `startBatchReconcile` in `agent.ts` cloned from `startBatchAudit`'s loop (stub proc swapped per spawn, sequential runs, the `current`/`stopping` cancel check) with two changes: the selection widens from review/done plans to every open non-note entity — backlog ideas included, since their prose is exactly what rots — and each run uses the reconcile prompt after the server snapshots the entity's body + phases as the `before` baseline (in single Reconcile the client captures that snapshot at launch; in a sweep the server is the only party in the loop). `buildReconcilePrompt` needs a small generalization for phase-less ideas, keeping the same drift-only rules and Log/frontmatter guardrails. `done`/archived entities stay out of scope: their prose is a historical record, not a live description.

The three open calls resolve as: **scope** — open ideas and plans (`idea`/`planned`/`in-progress`/`review`), notes excluded in v1; **queue surface** — reuse `ReconcileDiffPanel` one entity at a time with an N-of-M counter, driven by the store's `pendingReconcile`/`reconcilePreview` slots generalized into a queue and rendered from the Plans page root so review never requires opening each entity (Approve keeps and advances, Discard reverts via `updatePlan` and advances — the same written-then-revertible guarantee as today's single Reconcile); **long-run UX** — no multi-task model needed, because `startBatchAudit` already proves the pattern: one `batch-reconcile` `AgentTask` whose `pushLine` output reports per-entity progress (`[reconcile] IDEA-12 (3/14)`) and whose existing Stop button cancels between spawns. On removal, only the app-side Audit-all path goes (`audit-all-button.tsx`, `startBatchAudit`, its route); `buildConvergenceAuditPrompt` stays, because the CLI's `runPlanAudit` and the audited-hash freshness signal ([[IDEA-27]]) still consume it.

### Phases
- [x] Build the batch reconcile sweep
      Add `startBatchReconcile` to `agent.ts`, cloning `startBatchAudit`'s sequential loop and cancel handling; select open non-note entities and snapshot each body + phases as the `before` baseline ahead of its run.
- [x] Generalize the reconcile prompt for ideas
      Teach `buildReconcilePrompt` to handle phase-less backlog ideas with the same drift-only rules and Log/frontmatter guardrails.
- [x] Turn the reconcile slots into a queue
      Generalize `pendingReconcile`/`reconcilePreview` in `app-store.ts` to an ordered queue, fed by the sweep's server-held before/after snapshots via a new agent route.
- [x] Build the queue review UI
      Reuse `ReconcileDiffPanel` one entity at a time with an N-of-M counter, rendered from the Plans page root; Approve keeps and advances, Discard reverts via `updatePlan` and advances.
- [x] Add the Actualise-all button
      Plans-header button that launches the sweep and reports per-entity progress through the existing `agentStatus` lines and Stop control.
- [x] Retire the app's Audit-all path
      Remove `audit-all-button.tsx`, `startBatchAudit`, and its route; keep `buildConvergenceAuditPrompt` for the CLI's `runPlanAudit`.
- [x] Type-check and visual pass
