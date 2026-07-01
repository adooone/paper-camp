---
id: FEAT-28
title: Reconcile pass and audit gating
kind: feat
status: idea
created: 2026-07-01
idea: IDEA-26
tags:
  - plans
  - audit
  - reconcile
  - ai
---

FEAT-25's batch audit revealed two gaps: the convergence audit button is visible on every plan status even though it only makes sense after a plan is complete, and there is no mechanism to fix stale prose in an in-progress plan. This feature closes both gaps. First, `AuditPhasesButton` is gated to `review` and `done` so drift-detection only fires when the plan is finished. Second, a new "Reconcile" pass is introduced — an AI rewrite that corrects stale file paths, renamed/removed code symbols, and superseded approaches in phase descriptions and body prose, producing a diff preview the user approves before anything lands. The reconcile prompt is kept deliberately narrow ("fix references and superseded approaches; leave everything else byte-identical") and enforces hard guardrails: frontmatter identity and checked phases are never touched.

### Phases
- [ ] Gate AuditPhasesButton to review/done status
      In `plan-detail.tsx:293`, wrap `AuditPhasesButton` in a `status === 'review' || status === 'done'` guard. No changes to the audit logic itself.
- [ ] Add reconcile TaskKind and prompt
      Add `'reconcile'` to the `TaskKind` union in `types.ts`. Write `buildReconcilePrompt` in `prompts.ts` with the narrow rewrite instruction and guardrails (never touch id/frontmatter, never un-check or delete `[x]` phases, never add/remove phases — only reword prose and fix references).
- [ ] Add launch route for reconcile tasks
      Extend the task-launch API (alongside the existing audit route) to accept `kind: 'reconcile'`, resolve the agent, and stream the result back.
- [ ] Build diff/preview approval UI
      After the agent returns the proposed rewrite, render a before/after diff panel in the plan detail view. The user can approve (write the file) or discard. Mirror the "human reviews and promotes" flow used for agent-drafted plans.
- [ ] Add Reconcile button to plan-detail.tsx
      Render a "Reconcile" button gated to non-`done` plans (complement to the audit button). Wire it to the reconcile launch route and open the diff/preview panel on completion.
- [ ] Optional deterministic pre-pass
      Before the model call, run a cheap find/replace for known path renames (e.g. `plans.md` → `papercamp/plans/`) so the AI pass only handles deeper semantic drift. Include this as part of the reconcile route, not a separate UI action.
