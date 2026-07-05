---
id: IDEA-26
title: Reconcile pass and audit gating
type: feat
status: done
created: 2026-07-01
updated: 2026-07-02
tags:
  - plans
  - audit
  - reconcile
  - ai
---

The reconcile pass — an AI reference/superseded-approach fixer with a diff preview the user approves — plus gating the audit button to review/done plans.

### Phases
- [x] Gate AuditPhasesButton to review/done status
      In `plan-detail.tsx:298`, wrap `AuditPhasesButton` in a `status === 'review' || status === 'done'` guard. No changes to the audit logic itself.
- [x] Add reconcile TaskKind and prompt
      Add `'reconcile'` to the `TaskKind` union in `src/types/index.ts`; the `TASK_KIND_TO_DEFAULT_KEY` map in `src/app/server/agents/index.ts` is typed `Record<TaskKind, …>`, so it also needs a `reconcile` entry for agent resolution. Write `buildReconcilePrompt` in `src/app/features/plans/prompts.ts` (alongside `buildConvergenceAuditPrompt`) with the narrow rewrite instruction and guardrails (never touch id/frontmatter, never un-check or delete `[x]` phases, never add/remove phases — only reword prose and fix references).
- [x] Add launch route for reconcile tasks
      Add a `POST /api/agent/launch-reconcile` route in `src/app/server/routes/agent.ts` (api.ts has since been split into per-domain route modules; `/api/agent/launch-audit` in that file is the template): resolve the plan via `findPlanById`, run `checkBranchConflictForPlan`, launch the agent, and stream the result back over the existing SSE channel.
- [x] Build diff/preview approval UI
      After the agent returns the proposed rewrite, render a before/after diff panel in the plan detail view. The user can approve (write the file) or discard. Mirror the "human reviews and promotes" flow used for agent-drafted plans.
- [x] Add Reconcile button to plan-detail.tsx
      Render a "Reconcile" button gated to non-`done` plans (complement to the audit button). Wire it to the reconcile launch route and open the diff/preview panel on completion.
- [x] Optional deterministic pre-pass
      Before the model call, run a cheap find/replace for known path renames (e.g. `plans.md` → `papercamp/plans/`) so the AI pass only handles deeper semantic drift. Include this as part of the reconcile route, not a separate UI action.
