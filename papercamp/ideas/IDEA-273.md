---
id: IDEA-273
title: No pass while findings are open
type: fix
kind: fix
status: in-progress
idea: IDEA-270
created: 2026-09-16
updated: 2026-09-18
tags:
  - cli
  - server
  - core
subject: Run & monitor
order: 2
---

[[IDEA-270]] made a pass skip chunks no commit has touched, but not chunks
whose last findings nobody has acted on. On 2026-09-16 a second pass filed
14 findings on top of the 26 still open from 2026-09-15 — the same chunks,
some of the same files — and the Ideas page grew a second review header.
A review that is not read is not worth repeating.

**Open findings close the gate.** `NightGateInput` gains `openFindings`,
the count `parseNightFindings` returns for the project's `suggestions.md`,
which the server already reads to build the report; `evaluateNightGate`
pushes a new reason, `open-findings`, when it is above zero. The gate is
evaluated before every pass, so the first pass after the last finding is
fixed, promoted or dismissed runs as usual.

**Every surface says why.** `GATE_REASON_LABEL` in `night-command.ts`
labels it *findings from the last review are still open*, beside the
existing seven reasons. Settings had no gate display at all, so it gains
one: a single muted line under the section's switch reading *Gate open*
or *Blocked: <reasons>*, the reasons joined with commas from the same
labels, moved to `src/core/night-gate.ts` so the CLI and the app share
one map. The line reads `MACHINE_NIGHT_PATH` from the machine root that
`parseMachineProjectRuntimeUrl` derives from the runtime URL, once when
the section mounts; a runtime with no machine behind it, such as
`paper-camp dev`, renders no line.

### Out of scope

The report's own layout, which [[IDEA-272]]'s fixes cover. What counts as
a finding.

### Phases
- [x] Add `open-findings` to the gate reason type
      run: 1m38s · 24 in · 5.5k out · sonnet-5 · sess:018d457e-c325-426c-b1d5-0bd141e29398
- [x] Block the gate on a non-zero `openFindings`
      `NightGateInput` gains the count; `evaluateNightGate` pushes the reason above zero.
      run: 36s · 16 in · 1.4k out · sonnet-5 · sess:018d457e-c325-426c-b1d5-0bd141e29398
- [x] Count the project's open findings where the daemon evaluates the gate
      `daemon-server.ts` parses `suggestions.md` with `parseNightFindings` before each evaluation.
      run: 52s · 24 in · 2.9k out · sonnet-5 · sess:018d457e-c325-426c-b1d5-0bd141e29398
- [ ] Label the reason in the CLI and add a gate line to Settings
      Move `GATE_REASON_LABEL` to `night-gate.ts`; the Settings section fetches
      `MACHINE_NIGHT_PATH` on mount and renders *Gate open* or *Blocked: <reasons>*.
- [ ] Cover the new reason in `night-gate.test.ts`

### Thread
- [x] 2026-09-16 [question] [agent] Run-all parked on phase 4 ("Label the reason in the CLI and the Settings night section") — the agent needs a decision: Phase 4 says to add the `open-findings` label to "the Settings section's gate line," but I can't find any gate-reason display in the Settings UI — `NightSection`/`useNightSection` only shows enabled/paused/run-now/threshold, and nothing in `src/app` consumes `MachineNightGateResponse`/`gate.reasons` at all (only the CLI's `GATE_REASON_LABEL`, which I've already updated). Should I add a new gate-reasons line to the Settings night section (a small UI addition), or was this bullet describing a surface that doesn't actually exist yet and should be dropped from this phase?
- [x] 2026-09-17 [question] [agent] Run-all parked on phase 4 ("Label the reason in the CLI and the Settings night section") — the agent needs a decision: Phase 4 says to label `open-findings` in "the Settings section's gate line," but no gate-reason display exists anywhere in the Settings UI (`NightSection`/`useNightSection` only show enabled/paused/run-now/threshold; nothing in `src/app` consumes `gate.reasons`). The CLI's `GATE_REASON_LABEL` is already updated. Should I add a new gate-reasons line to the Settings night section, or was this bullet describing a surface that doesn't exist yet and should be dropped from this phase?
- [x] 2026-09-18 [clarification] Decision: add the gate line to Settings. The idea body and phase 4 are updated with the spec. Move GATE_REASON_LABEL from night-command.ts into src/core/night-gate.ts so the CLI and the app share one map. In the Settings night section, fetch MACHINE_NIGHT_PATH once on mount from the machine root that parseMachineProjectRuntimeUrl derives from the runtime URL, and render one muted line under the switch: Gate open, or Blocked: followed by the comma-joined labels. A runtime with no machine behind it renders no line. Then continue to phase 5.
- [x] 2026-09-18 [chat] [agent] Got it — that's phase 4's decision, already logged. Moving on to phase 5.
