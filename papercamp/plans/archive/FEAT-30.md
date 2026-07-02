---
id: FEAT-30
title: Run all phases with per-phase commits
kind: feat
status: done
created: 2026-07-01
idea: IDEA-29
updated: 2026-07-02
tags:
  - agent
  - phases
  - git
  - autonomy
---

Today a plan runs one phase at a time: each single-phase execution spawns a fresh agent session, and the human commits by hand between phases. This feature adds a "Run all phases" button that executes every unchecked phase sequentially — each in its own fresh agent session, exactly like the single-phase run — and commits after each phase **without pushing**. The human reviews the whole phase-by-phase branch and pushes when satisfied. It is a natural composition of pieces that already exist: single-phase execution (`start(plan, phaseIndex)` + `buildAgentPrompt`), the sequential-loop-in-one-task pattern from batch audit (`startBatchAudit`), the commit path (`git.commit`), and the area-scope + `Refs:` commit convention.

This is the app's biggest autonomy jump — many unattended AI commits in one run — so the safety rails are not optional: the run refuses to start off a clean current branch, gates each phase on real verification before committing, stops on the first failure so a broken phase never cascades into dependent ones, never pushes, and ends in `review` (never auto-`done`). Completed phases stay committed and the run is resumable from the next unchecked phase.

### Phases
- [x] Add startRunAllPhases loop to agent.ts
      Mirror `startBatchAudit`: run `ensureBranch(plan)` and the `checkBranchConflictForPlan` guard up front (this is write-capable, many-file work — never on `main`), then iterate the unchecked phases in order, spawning a **fresh** agent subprocess per phase with `buildAgentPrompt(plan, phase, i)`. Stream a live per-phase log (`[phase 2/5] …`, `[commit] …`) and honor a stop signal between phases.
- [x] Add per-phase verification gate
      After each phase, only proceed if the agent reported success **and** the phase checkbox actually flipped (`didTaskProgress`). Run the existing `status` manager's project checks (lint/format/test) and treat a red gate as a phase failure. Treat an unattended stall / clarifying-question timeout as a failure too.
- [x] Wire commitPhase callback from api.ts
      Inject a `commitPhase` callback into `startRunAllPhases` the same way `stampAuditDate` is injected into the audit loop. On a verified success it runs `git add -A` (capturing the phase's code + the checked-off plan file + the `progress.md` append) and calls `git.commit` with a `<plan.kind>(<area>): <phase title>` message plus a `Refs: <PLAN-ID>` footer, reusing the suggested-scope logic (plan's primary tag). Never push.
- [x] Enforce stop-on-failure and end-of-run status
      On the first failed phase, stop the loop — leave completed phases committed, report the phase where it stopped, and make the run resumable from the next unchecked phase. After the last phase succeeds, set status to `review` (never auto-`done`, per AGENTS.md).
- [x] Add launch-run-all route
      Add a branch-conflict-guarded `POST /api/agent/launch-run-all` route that resolves the plan, wires the `commitPhase` callback, and starts the run, streaming progress back to the activity feed.
- [x] Add run-all TaskKind and UI
      Add a `'run-all'` value to the `TaskKind` union with a live per-phase log and a stop button. Add a "Run all phases" button to `plan-detail.tsx`, gated to plans that have unchecked phases (`planned` / `in-progress`).
