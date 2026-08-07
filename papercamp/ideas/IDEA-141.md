---
id: IDEA-141
title: Phases as living progress rows
type: feat
status: idea
created: 2026-08-07
tags:
  - app
  - ui
  - plans
subject: Planning surface
---

The phases table is static — a checkbox list that looks the same whether a
run is idle, mid-phase, or done. Make each row carry its state visually:

1. **Done rows dim.** A completed phase's row background drops to a
   muted tint (and the existing strikethrough stays) so pending work is
   the bright part of the table.

2. **The running phase fills like a loading line.** The row's background
   fills left-to-right proportional to progress, measured as a hybrid:
   milestone anchors detected from the run's own stream — the phase
   prompt fixes the shape, so `Edit`/`Write` tool calls mean implementing
   (0–60%), a Bash call running `check-types` means verifying
   (60–90%), the edit flipping the plan file's checkbox lands at 95% —
   with elapsed-vs-median-segment-duration from [[IDEA-135]]'s records
   interpolating inside a segment once history exists (the bar holds at
   the anchor before that). Two honesty rules: the fill clamps at 95%
   until the phase truly completes, and ~30s without a stream event
   freezes the bar — a stalled run visibly stalls. Works from the very
   first run; [[IDEA-135]] only sharpens it.

3. **Spinner replaces the checkbox.** While a phase runs, its leading
   slot shows the spinner where the checkbox sits — one glance says
   which row is alive. Checkbox returns (checked) when it lands.

4. **One action per row, at the right.** Pending rows get ▶ run; done
   rows get copy; a running row gets none — stopping stays in the Stack
   panel task card.

5. **Percent after the title.** The running phase shows its live percent
   after the title; done phases show their recorded run time (the
   [[IDEA-135]] `run:` line's duration); pending rows show nothing.

6. **The plan rolls the same number up.** Plan progress = (done phases +
   running phase's fraction) / total, shown as a percent beside the
   existing plan progress bar — the bar itself gains the partial fill
   instead of stepping whole phases only.

### Thread
- [x] 2026-08-07 [decision] Per-phase percent is milestones-plus-time: stream-detected stage anchors (implement / verify / checkbox) carry the bar from run one, elapsed-vs-median segment time from [[IDEA-135]] interpolates between them, the fill clamps at 95%, and ~30s of stream silence freezes the bar. Pure elapsed-vs-median was rejected (a stuck agent would keep "progressing"); agent self-reported progress was rejected (prompt pollution, unreliable emission).
- [x] 2026-08-07 [decision] The verify anchor keys on a `check-types` Bash call only — [[IDEA-142]] moved biome out of the phase prompt into the server's per-commit autofix, so the agent no longer runs biome and the detector must not wait on it.
