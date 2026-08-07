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
   fills left-to-right proportional to progress. The percent is honest,
   not cosmetic: `elapsed / median duration of past phase runs` from
   [[IDEA-135]]'s per-phase records, clamped at 95% until the phase truly
   completes; with no history yet the fill renders as an indeterminate
   shimmer instead of a fake number. Depends on [[IDEA-135]] for the
   duration data.

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
- [x] 2026-08-07 [decision] Per-phase percent derives from elapsed-vs-median-duration (IDEA-135 data), clamped at 95% and indeterminate before history exists — never a cosmetic animation pretending to be measurement.
