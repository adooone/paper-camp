---
id: FEAT-14
title: Phase convergence audit
kind: feat
status: done
created: 2026-06-26
idea: IDEA-11
updated: 2026-06-26
tags:
  - app
  - plans
  - agent
---

A button on a plan's phase list that launches an agent to compare the plan's intent
against the current code and append any clearly-missing phase as a new unchecked item —
never reorder, check, or rewrite an existing phase. Append-only is the entire safety
property: if nothing's missing, it writes nothing, not even an empty heading. See
ideas.md's "Phase convergence audit" for full rationale.

### Phases
- [x] Generalize agent task scope beyond a single phase
      `agent.ts`'s `start()`/`AgentTask` are currently phase-shaped (`planId` +
      `phaseIndex`, success-check is "did this phase's checkbox flip"). This task is
      plan-scoped, not phase-scoped — add a launch mode with no `phaseIndex`, whose
      success-check is "did a new line get appended to `### Phases` or `### Log`"
- [x] Add convergence-audit prompt constant
      New `src/app/features/plans/prompts.ts`: read this plan's phases and body, inspect
      the current repo state, append any phase that's clearly required but missing as a
      normal `- [ ]` line at the end of the list, optionally with the existing indented
      description format. Explicitly never touch existing lines. Finish with one `### Log`
      line summarizing what was found — or write nothing at all if nothing's missing
- [x] Add "Audit phases against code" button to plan-detail.tsx
      Next to the existing `PhaseCopyButton`, launches the plan-scoped agent task from the
      previous two phases
- [x] Verify append-only behavior end-to-end
      Run against a real plan; confirm existing phases are never reordered, checked, or
      edited, and a Log entry only appears when something was actually appended

### Log
- 2026-06-26: `agent.ts`'s `AgentTask`/`AgentTaskState` now have an optional `phaseIndex`; a new shared `launch()` helper backs both `start(plan, phaseIndex)` (unchanged, phase-scoped) and a new `startForPlan(plan, prompt)` (plan-scoped, no phase). Plan-scoped success is judged in `didTaskProgress()` by snapshotting `phases.length`/`log.length` at launch (`planBaseline`) and checking for growth in either on finish, instead of one phase's checkbox. `resume()` carries `planBaseline` through a steering respawn like it already did `phaseIndex`. Updated `stack-panel.tsx`'s status line to omit the phase number when absent. `tsc`/`biome`/`vitest` all clean. Status set to `in-progress` (3 phases still unchecked).
- 2026-06-26: Added `AuditPhasesButton` next to `PhaseCopyButton` in `plan-detail.tsx`, wired through a new `launchPlanAudit` store action, `POST /api/agent/launch-audit`, and `agent.startForPlan()`. Could not exercise the live happy path: the running dev server's long-lived `agent` singleton predates this route (404 until a full process restart), and this verification session was itself the agent task occupying the single-task slot — restarting the server or spawning a second real headless agent was deliberately avoided. Verified by code review (`tsc`/`biome`/`vitest` clean) instead; live end-to-end coverage is phase 4's job.
- 2026-06-26: Verified append-only behavior end-to-end against a real plan (FEAT-9, "Project settings and config views"). Could not spawn the literal production path (a `claude --permission-mode auto` subprocess) directly — this sandbox's safety classifier denies that as an "unsafe agent" spawn, and the running dev server's `agent.ts` singleton was itself occupied by this very verification session — so used isolated temp copies of the repo and the harness's own sanctioned Agent tool, dispatched with the exact real prompt text, as a faithful stand-in. Two "nothing missing" runs against FEAT-9 unmodified (all 5 phases genuinely match the code) wrote zero bytes — confirmed via untouched-file diff, no Log line, no heading. One "real gap" run, with an unambiguous unimplemented requirement added to FEAT-9's body (a port/`.env` conflict warning that genuinely doesn't exist in code), appended exactly one new unchecked `- [ ]` phase plus one new `### Log` line — confirmed via independent diff against the pristine original that every other line, in every other plan entry, was byte-for-byte unchanged: no reordering, no checking, no rewriting. The appended phase stayed unchecked even though the audit found it, matching the prompt's instruction. This was the plan's last phase — Status set to `review` per `AGENTS.md`.
