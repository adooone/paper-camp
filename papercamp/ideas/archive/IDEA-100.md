---
id: IDEA-100
title: "Self-healing run-all: fix red checks, ask only when stuck"
type: feat
status: done
created: 2026-07-26
updated: 2026-07-29
tags:
  - agent
  - plans
order: 1
---

Run-all is fail-closed today. The per-phase agent is told to keep the whole project green, but the orchestrator re-runs the gate (lint/format/test) after the phase and, if anything is still red, stops the entire run — `[fail] phase N — project checks failed, stopping`. A single lingering red check (a flaky test, a check the phase agent couldn't fully resolve) throws away the run and leaves it to a human. That is the wrong default: the point of run-all is to carry a plan to done without babysitting.

Make it fail-forward and self-healing:
- **Gate red after a phase → don't stop.** Spawn a fix pass — an agent invocation whose only job is to make the failing checks green — then re-run the gate and, if green, continue to the next phase. The verification stays; only the response to failure changes from "stop" to "fix, then continue".
- **Cap the loop.** At most N fix attempts per phase (start with 2) before escalating, so a genuinely unfixable check can't spin forever.
- **Stop only to ask.** When the agent is stuck — the fix cap is hit, or it needs a decision it can't make (ambiguous requirement, a real product choice) — it stops and writes its question into the entity's `### Log` (Comments) rather than dying with a terminal error. The human answers there, and Apply-notes / rework ([[IDEA-87]], [[IDEA-89]]) picks the thread back up. The agent asking via a comment is the exact mirror of a human leaving a note — same channel, both directions.

This is the [[IDEA-94]] shape (deterministic attempt first, agent as the recovery path, never stuck) applied to the phase gate instead of the branch switch.

Open questions for the plan:
- The fix pass vs the phase agent: a distinct short prompt ("only make checks pass, change nothing else"), or reuse the phase agent with the failure appended? The former is safer against scope creep.
- Detecting "stuck": is it purely the attempt cap, or should the agent be able to declare a blocker mid-phase (structured "I need a decision" signal) and short-circuit to the comment path?
- Distinguishing a check the phase caused from pre-existing red (a flaky or unrelated failure): the run shouldn't be blamed for, or endlessly try to fix, breakage it didn't introduce — relate to how the gate already tolerates known flakes.
- What the escalation comment looks like so Apply-notes can act on it cleanly, and whether the plan's status should flip (e.g. back to in-progress / a needs-input marker) when a run parks on a question.

Provenance: 2026-07-26, after a day where every run-all stopped on a gate the phase agent's own checks had already passed — the orchestrator's stop-on-red was the failure, not the work.

### Phases
- [x] Add a fix-pass agent invocation
      A distinct, short-prompt agent kind ("only make the failing checks pass, change nothing else") that the run-all loop in `src/app/server/agent.ts` spawns when `runProjectChecks()` returns red, keeping it scoped against creep rather than reusing the phase agent.
- [x] Loop gate → fix → re-gate with an attempt cap
      Replace the stop-on-red branch (~line 770) with a bounded loop: run the fix pass, re-run the gate, repeat up to N attempts (start with 2) before escalating; carry the cap and attempt count in the task state so the log narrates each try.
- [x] Tolerate pre-existing and flaky red the phase didn't cause
      Distinguish checks the phase broke from failures already red before the phase (unrelated or known-flaky), so the fix loop only owns what the run introduced — reuse how the gate already tolerates known flakes rather than endlessly fixing unrelated breakage.
- [x] Let the agent declare a blocker mid-phase
      A structured "I need a decision" signal the fix pass or phase agent can emit to short-circuit straight to escalation, so "stuck" is not only the attempt cap but also an explicit ambiguity/product-choice blocker.
- [x] Escalate to a comment instead of a terminal error
      When the cap is hit or a blocker fires, write the agent's question into the entity's `### Log` in a format Apply-notes / rework ([[IDEA-87]], [[IDEA-89]]) can pick up, instead of ending with `[fail] … stopping`.
- [x] Flip plan status when a run parks on a question
      Set a needs-input marker (e.g. back to in-progress) on the plan when a run escalates, so a parked run is visible in the worklist rather than looking merely errored.
- [x] Type-check and full pass
      `pnpm run check-types`, `npx biome check . --write`, and `pnpm test` clean across the repo.
