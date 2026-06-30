---
id: FEAT-18
title: Polish Ideas and Stack UX
kind: feat
status: done
created: 2026-06-27
idea: IDEA-16
updated: 2026-06-27
tags:
  - ideas
  - ux
  - app
  - agent
---

A grab-bag of UX fixes for the Ideas/Stack flow, flagged from actually using the app
rather than from a single feature gap: the sidebar's Ideas list never drops a
done idea, there's no UI path to create a new `ideas.md` entry at all (only
`plans.md` Backlog items via "Add to backlog"), the Ideas board's Done column grows
unbounded, the Stack panel's Agent section only understands FEAT-10's phase-execution
task shape, and several user-triggered actions give no visible feedback — FEAT-17's
own log entry ("No visible feedback when draft button is clicked... nothing
working") is a real instance of that last problem, not a hypothetical one.

This also adds a third agent-task shape — "Extend with AI" on an open idea, rewriting
its body in place — alongside FEAT-10's phase execution and FEAT-17's plan-drafting,
which is what makes the Stack panel's phase-only Agent section and IDEA-4's
one-task-at-a-time constraint worth revisiting now rather than later.

### Phases
- [x] Hide done-linked ideas from the sidebar's Ideas section
      `plans-sidebar.tsx`'s Ideas section lists every `ideaEntries` item regardless of
      its derived `status`; filter to `status !== 'done'` so a fully-planned idea drops
      out once its linked plan(s) are done. The Ideas board's own Planned/Done columns
      are unaffected — seeing a done idea there next to its check icon is the point.
- [x] Add a minimal idea-creation form and `POST /api/ideas`
      There's currently no UI path to create an `ideas.md` entry — `add-idea-modal.tsx`
      only creates `plans.md` Backlog entries. Add an endpoint that appends a new
      `### IDEA-N: <title>` section from `{ title, body }`, and a plain two-field modal
      (no kind/tags/etc, matching the minimal shape an idea entry actually needs)
      wired up from the Ideas section.
- [x] Add an "Extend with AI" agent task for rewriting one idea's body
      A third `AgentTask` shape alongside FEAT-10's phase-scoped execution and FEAT-17's
      plan-drafting: given one idea's id and current body, explores the codebase and
      rewrites that idea's body in place in `ideas.md` with more specific detail
      (concrete approaches, file references). Needs its own prompt builder and a
      different success check ("did this `IDEA-N`'s body text change") than either
      existing task shape, plus a button on the open-idea view.
- [x] Build a shared in-flight/result feedback pattern and apply it
      `DraftPlanButton`'s local `launching` state currently has no visible effect on
      screen — confirmed by FEAT-17's own log. Add one reusable loading/success/failure
      affordance and wire it into Draft plan, Extend with AI, and any other
      user-triggered action found during an audit to be missing it; treat this as the
      first fix in what's flagged as a recurring gap, not a one-off patch.
- [x] Broaden the Stack panel's Agent section beyond phase execution
      The Agent section's rendering (`stack-panel.tsx`) is built around
      `agentStatus.phaseIndex`, so plan-drafting and idea-extension tasks have nowhere
      sensible to show. Generalize it to display any task kind. IDEA-4's "one active
      task at a time" constraint stays as-is — see decisions.md; this phase is display
      only, not a concurrency change.
- [x] Cap the Ideas board's Done column at 4 rows with a done-ideas list view
      `ideas-board.tsx`'s `done` column renders every done idea unfiltered. Slice to the
      4 most recently done, and render a 5th row as a "[N more ideas]" link (not a card)
      that navigates to a new, separate done-ideas list view showing the full set.
