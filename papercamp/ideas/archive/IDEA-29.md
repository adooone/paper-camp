---
id: IDEA-29
title: Run all phases with per-phase commits
type: feat
status: done
created: 2026-07-01
updated: 2026-07-02
tags:
  - agent
  - phases
  - git
  - autonomy
---

"Run all phases": sequential per-phase agent runs with an automatic commit after each completed phase and stop-on-failure.

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
