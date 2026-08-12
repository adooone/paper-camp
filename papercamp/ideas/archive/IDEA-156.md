---
id: IDEA-156
title: Fix button replaces Commit when checks fail
type: feat
status: done
created: 2026-08-11
updated: 2026-08-12
tags:
  - app
  - plans
  - agents
subject: App UI
---

The Deliver footer's checks row already has a manual, copy-paste fix
path: a failing check's `fixPrompt` (command + last output) sits behind
a `CopyButton` in the Stack panel's Desk section — you copy it and paste
it into a session yourself. Give the Deliver footer a real one-click
version instead, using plumbing that already exists.

1. **A failing check appends a fix, not a phase.** `PlanEntry.fixes`
   already exists — the phases table already renders it as kraft-tinted
   rows alongside phases, and `PhasesSection`'s "Run fixes" button
   already launches an agent against open fixes. A Quality/Tests/
   Consistency failure appends one fix entry per failing check (not one
   combined entry) — text names the check and carries its command +
   last output, the same content `fixPrompt` already builds today.
   Docs findings are a different kind of issue (a findings list, not a
   pass/fail run) and stay out of this — they keep their existing
   inline expand/browse behavior in the checks row. The check's name is
   the fix's stable key — a repeat failure for the same check replaces
   that entry's command and output in place rather than appending a
   duplicate.

2. **The Commit button becomes a Fix button while any of Quality/Tests/
   Consistency is failing.** Same slot, same size, in
   `DeliverCommitButton` — committing on top of a known-broken state
   isn't offered; fixing it is the only action available there until
   checks are clean.

3. **Fix launches immediately**, the same pattern as [[IDEA-149]]: the
   fix entries are written to the file first — `launchRunAll(plan.id)`
   reloads the plan from disk, so the write must land before it fires —
   then the launch happens in the same action, no separate confirmation
   step.

4. **Reverts on its own.** Once the run lands and checks re-report
   clean, the button reads Commit again automatically — driven by the
   same live check state the row already renders reactively, no new
   state to track.

### Phases
- [x] Build fix entries from failing checks
      Map each failing Quality/Tests/Consistency check to one `PlanEntry.fixes` entry using its `fixPrompt` content, keyed by check name; Docs excluded.
      run: 6m43s · 23.3k in · 33.3k out · sonnet-5
- [x] Upsert repeat failures by check name
      A repeat failure for the same check replaces that entry's command and output in place instead of appending a duplicate.
      run: 3m21s · 687 in · 6.7k out · sonnet-5
- [x] Swap Commit for Fix while checks fail
      In `DeliverCommitButton`, render Fix in the same slot whenever any of the three checks is failing.
      run: 2m45s · 373 in · 5.3k out · sonnet-5
- [x] Wire the Fix action to write-then-launch
      Write the fix entries to the plan file first, then `launchRunAll(plan.id)` once the write lands (IDEA-149 pattern).
      run: 5m12s · 4.3k in · 15.4k out · sonnet-5
- [x] Confirm the auto-revert to Commit
      Verify the button reads Commit again from live check state with no new state added.
      run: 3m15s · 657 in · 6.1k out · sonnet-5

### Thread
- [x] 2026-08-11 [decision] Reuses the existing `fixes`/"Run fixes" mechanism rather than inventing a new phase kind or launch path — one fix entry per failing check, Docs findings excluded (different shape, already has its own browse flow).
