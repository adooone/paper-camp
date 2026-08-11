---
id: IDEA-156
title: Fix button replaces Commit when checks fail
type: feat
status: idea
created: 2026-08-11
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
   inline expand/browse behavior in the checks row.

2. **The Commit button becomes a Fix button while any of Quality/Tests/
   Consistency is failing.** Same slot, same size, in
   `DeliverCommitButton` — committing on top of a known-broken state
   isn't offered; fixing it is the only action available there until
   checks are clean.

3. **Fix launches immediately**, the same pattern as [[IDEA-149]]: the
   fix entries land in the file and `launchRunAll(plan.id)` fires in the
   same action, no separate confirmation step.

4. **Reverts on its own.** Once the run lands and checks re-report
   clean, the button reads Commit again automatically — driven by the
   same live check state the row already renders reactively, no new
   state to track.

### Thread
- [x] 2026-08-11 [decision] Reuses the existing `fixes`/"Run fixes" mechanism rather than inventing a new phase kind or launch path — one fix entry per failing check, Docs findings excluded (different shape, already has its own browse flow).
