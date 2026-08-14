---
id: IDEA-174
title: Show a running PR review in the UI
type: feat
status: review
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
- [x] Detect a review running for the current entity
      Match an in-flight `pr-review` task from `/api/agent/status` to the idea `pr-badge.tsx` renders on.
      run: 1m41s · 516 in · 4.9k out · sonnet-5
- [x] Add a reviewing state to `pr-badge.tsx`
      Show it alongside the existing draft/open/merged states while a review is in flight.
      run: 4m29s · 883 in · 9k out · sonnet-5
- [x] Reflect a landed review on the badge
      After the task settles, surface it from the `[review]` thread message and the PR's review count.
      run: 3m22s · 801 in · 12.8k out · sonnet-5
- [x] [manual] Dedupe review badge and fix concurrent-task review detection

### Thread
- [x] 2026-08-14 [review] [agent] Comments · 2 findings — The diff delivers all four phases: the Stack-panel subtitle reads the PR number off a new `prReviewUrl` task field (plumbed through `agent.ts` and the `AgentTaskState` type), `pr-badge.tsx` gains a spinner reviewing state, and the trail surfaces the landed signal via `latestReviewNote` and `ReviewSignalBadge`. The core behavior matches the spec and the tests are solid. The main issue is that the landed-review badge is now rendered in two places on the same entity view, producing a visible duplicate.
- [x] 2026-08-14 [review] [agent] Comments · 2 findings — The UI wiring is clean and delivers the badge reviewing state, the landed-review signal, and the Stack subtitle case, with solid helper tests. The main gap is that the new `prReviewUrl` field is read in two places but never populated anywhere in the diff, so the PR number that phase 1 promises to carry into the Stack subtitle will never actually render — it always degrades to the numberless fallback. Detection and the badge itself work regardless since they key off `taskKind`/`planId`, so the feature is largely functional.
- [x] 2026-08-14 [review] [agent] Comments · 2 findings — The UI wiring is clean and delivers the badge reviewing state, the landed-review signal, and the Stack subtitle case, with solid helper tests. The main gap is that the new `prReviewUrl` field is read in two places but never populated anywhere in the diff, so the PR number that phase 1 promises to carry into the Stack subtitle will never actually render — it always degrades to the numberless fallback. Detection and the badge itself work regardless since they key off `taskKind`/`planId`, so the feature is largely functional.
