---
id: IDEA-29
title: Run all phases with per-phase commits
---

## IDEA-29: Run all phases with per-phase commits

A "Run all phases" button on a plan that executes every unchecked phase **sequentially**, each in its own **fresh agent session** (like today's single-phase run), and **commits after each phase without pushing**. The human reviews the whole phase-by-phase branch and pushes when satisfied.

This is a natural composition of pieces that already exist: single-phase execution (`start(plan, phaseIndex)` + `buildAgentPrompt` in `agent.ts`), the sequential-loop-in-one-task pattern from batch audit (`startBatchAudit`), the commit path (`git.commit`), and the area-scope + `Refs:` commit convention.

**Flow (`startRunAllPhases(plan)`), mirroring `startBatchAudit`:**
1. `ensureBranch(plan)` and run the `checkBranchConflictForPlan` guard first — this is write-capable, many-file work; never on `main`.
2. For each unchecked phase, in order: spawn a **fresh** agent subprocess with `buildAgentPrompt(plan, phase, i)`. Fresh context per phase keeps it focused and lets each session re-read the plan + the code committed by earlier phases.
3. After the phase: **verify before committing** — only proceed if the agent reported success *and* the phase checkbox actually flipped (`didTaskProgress`). Strongly consider running the project checks (the existing `status` manager runs lint/format/test) and treating a red gate as a phase failure.
4. On success: `git add -A` (captures the phase's code + the checked-off plan file + the `progress.md` append) and commit with a convention message — `<plan.kind>(<area>): <phase title>` + a `Refs: <PLAN-ID>` footer, reusing the suggested-scope logic (plan's primary tag). **Never push.**
5. **Stop on first failure** — don't cascade a broken phase into dependent ones. Leave completed phases committed, report where it stopped; the run is resumable from the next unchecked phase.
6. After the last phase, set status to `review` (never auto-`done`, per AGENTS.md) — the single-phase prompt already does this for the final phase.

**Touchpoints:** new `startRunAllPhases(plan)` in `agent.ts` (loop like `startBatchAudit`, but with a `commitPhase` callback injected from `api.ts` the same way `stampAuditDate` is — the callback calls `git.commit`); a `POST /api/agent/launch-run-all` route (branch-conflict guarded); a "Run all phases" button on `plan-detail.tsx`, gated to plans with unchecked phases (`planned`/`in-progress`); a new `'run-all'` `TaskKind` with a live per-phase log (`[phase 2/5] …`, `[commit] …`) and a stop button.

**Open questions / risks:**
- **Verification depth:** just "checkbox flipped", or run lint/test between phases? The latter is safer (catches broken phases before they're committed) but slower and needs the check runner wired into the loop. Recommended.
- **Blocked phases:** if a phase agent asks a clarifying question it can't get answered unattended — treat a stall as a failure (timeout) and stop. Under-specified plans should run the clarify pass first.
- **Autonomy:** this is the app's biggest autonomy jump (many unattended AI commits). The no-push default + per-phase gate + stop-on-failure + human-review-before-push are what keep it safe — don't ship it without them.
- **Cost/time:** N phases = N agent sessions; keep it stoppable and stream progress.

Relates to FEAT-10 (single-phase execution), [[IDEA-21]] (FEAT-25 batch pattern), and [[IDEA-26]] (audit/reconcile passes).
