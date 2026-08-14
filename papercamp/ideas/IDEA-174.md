---
id: IDEA-174
title: Show a running PR review in the UI
type: feat
status: idea
created: 2026-08-14
updated: 2026-08-14
tags:
  - app
  - ui
  - agent
subject: Richer review loop
---

A `pr-review` task is invisible *as a review* while it runs. It takes two to
three minutes, and the only surface that says what it is is `/tasks`.

**Already true.** `pr-review` tasks are ordinary agent tasks, so they appear in
`/api/agent/status`, in the Stack panel's Agent section, and on the Tasks page —
which is the one place that labels them, via `'pr-review': 'PR review'` in
`tasks-page.tsx`.

**The gap.** `taskSubtitle` in `agent-section.tsx` covers thirteen task kinds
and has no `pr-review` case, so it falls through to `default: return ''`. In the
Stack panel a running review renders as *"Review pull requests with a local
agent · Claude Code"* — the plan title and the agent, with nothing saying a
review is underway. It reads exactly like a phase run on the same idea.

Add the case, carrying the PR number the task already holds: ` — reviewing PR
#153`.

**Where it actually belongs.** The Stack panel is ambient agent activity and
that fix is one line. But "is my PR being reviewed?" is a question asked while
looking at the idea, so the state belongs on `pr-badge.tsx`, which already shows
the PR number and its draft/open/merged state. It gains a reviewing state while
a `pr-review` task is running for that entity, and afterwards reflects that a
review landed — both signals already exist (the `[review]` thread message on the
idea, and the PR's own review count).

This matters more than for other task kinds because a review fires from a
60-second poll rather than a button. Nobody presses anything, so the badge is
the only place a user would learn it started; without it the first signal is a
finished review appearing on GitHub minutes later.

**Out of scope.** A manual "review now" button — the trigger stays automatic
([[IDEA-170]]). Streaming the reviewer's partial output anywhere but the Tasks
page.

### Phases
- [x] Subtitle a running review in the Stack panel
      Add the `pr-review` case to `taskSubtitle` in `agent-section.tsx`, reading the PR number off the task.
      run: 2m24s · 6k in · 5.5k out · sonnet-5
- [ ] Detect a review running for the current entity
      Match an in-flight `pr-review` task from `/api/agent/status` to the idea `pr-badge.tsx` renders on.
- [ ] Add a reviewing state to `pr-badge.tsx`
      Show it alongside the existing draft/open/merged states while a review is in flight.
- [ ] Reflect a landed review on the badge
      After the task settles, surface it from the `[review]` thread message and the PR's review count.
