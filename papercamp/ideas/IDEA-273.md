---
id: IDEA-273
title: No pass while findings are open
type: fix
kind: fix
status: idea
idea: IDEA-270
created: 2026-09-16
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

**Every surface says why.** `GATE_REASON_LABEL` in `night-command.ts` and
the Settings section's gate line both label it *findings from the last
review are still open*, beside the existing seven reasons.

### Out of scope

The report's own layout, which [[IDEA-272]]'s fixes cover. What counts as
a finding.

### Phases
- [x] Add `open-findings` to the gate reason type
      run: 1m38s · 24 in · 5.5k out · sonnet-5 · sess:018d457e-c325-426c-b1d5-0bd141e29398
- [ ] Block the gate on a non-zero `openFindings`
      `NightGateInput` gains the count; `evaluateNightGate` pushes the reason above zero.
- [ ] Count the project's open findings where the daemon evaluates the gate
      `daemon-server.ts` parses `suggestions.md` with `parseNightFindings` before each evaluation.
- [ ] Label the reason in the CLI and the Settings night section
- [ ] Cover the new reason in `night-gate.test.ts`
