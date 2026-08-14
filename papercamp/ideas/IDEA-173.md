---
id: IDEA-173
title: Never lose a computed PR review
type: fix
status: review
created: 2026-08-14
updated: 2026-08-14
tags:
  - app
  - agent
  - github
subject: Richer review loop
---

A computed review can be lost permanently, and when it is, nothing says so.
Both halves happened on the first real run against PR #153.

**What happened.** The `pr-review` task ran (08:00:24–08:03:18,
`claude-opus-4-8`, $0.67, 12.2k output tokens) and produced a well-formed
verdict with four findings. Nothing reached GitHub, nothing reached the idea,
and `papercamp/pr-reviews.json` recorded the head SHA anyway — so every
subsequent poll skipped it. The review was unrecoverable without hand-editing
that file. Clearing the entry and letting the poll re-run posted cleanly on the
second attempt: review `COMMENTED` on #153 with three inline comments, and a
`[review]` thread message on IDEA-170.

Two independent defects. Fixing either alone leaves the failure half-open.

### Record the SHA only when the review is delivered

`recordReviewedSha` runs on task completion regardless of outcome. Its stated
intent — "a garbled response still consumed the SHA's one review attempt, and
must not spin the same broken prompt every poll" — is right for an *unparseable
verdict*. It is wrong for a **parseable verdict that failed to post**: nothing
was delivered, so nothing was consumed.

Split the cases. Record the SHA when the GitHub post or the idea thread message
succeeded, and when the verdict was unparseable (the prompt is what's broken;
retrying buys the same result at the same price). Do not record when a good
verdict reached neither destination — that is a transient delivery failure and
the next poll should retry it.

Cap the retries so a permanently failing post doesn't re-review every 60 seconds
forever: after a small number of consecutive delivery failures on one SHA,
record it and surface the give-up.

### Make the failure observable

`postPrReview` is a fire-and-forget `void (async () => {…})()` whose two halves
are each `.catch(() => false)`, reporting only through a single `onLine` at the
end. On the failed run that line never appeared, so the task finished `done`
with three lines and no indication anything had gone wrong — indistinguishable
from a review that was never launched. That is why the cause of the first
failure is still unproven: the evidence was swallowed.

A delivery failure must end the task in a state that names it — an `error`
status with the reason attached, not a `done` task with a missing line. The
GitHub response body is the useful part (a 422 names the offending comment) and
is exactly what `.catch(() => false)` discards.

### Degrade a rejected post instead of dropping it

Flagged by the reviewer in its own review of this feature: `createPrReview`
posts all-or-nothing, and GitHub rejects the entire request with 422 if any
single comment's `line` is not part of the diff — so one bad line number drops
every finding, and none become the resolvable threads the Fix-review pipeline
consumes. Retry without the offending comments, or fall back to a summary-only
review, so a line-number slip costs one finding rather than the whole review.

### Out of scope

The review prompt and what the reviewer checks. The trigger gates
([[IDEA-170]]).

### Phases
- [x] Capture the delivery outcome and response body
      Replace the two `.catch(() => false)` halves of `postPrReview` so each returns whether it delivered and, on failure, the GitHub response body.
      run: 4m36s · 9.6k in · 14.8k out · sonnet-5
- [x] End a failed delivery in an error status
      A good verdict that reached neither destination finishes the task as `error` with the reason attached, not `done` with a missing line.
      run: 6m12s · 811 in · 18.9k out · sonnet-5
- [x] Gate `recordReviewedSha` on the outcome
      Record on a successful post or thread message and on an unparseable verdict; skip recording for a transient delivery failure so the next poll retries.
      run: 4m10s · 377 in · 10.5k out · sonnet-5
- [x] Cap consecutive delivery failures per SHA
      Track failures on one SHA and, after a small number, record it and surface the give-up so a permanently failing post stops re-reviewing every poll.
      run: 4m38s · 520 in · 9.6k out · sonnet-5
- [x] Degrade a 422-rejected review
      Retry `createPrReview` without the offending comments, or fall back to a summary-only review, so one bad line number costs one finding, not the whole review.
      run: 6m13s · 4.3k in · 17.5k out · sonnet-5
- [x] [manual] Await ledger writes before finishing a pr-review task

### Thread
- [x] 2026-08-14 [review] [agent] Comments · 2 findings — The diff delivers all five phases: it threads a structured PrReviewDelivery (with the response body) through createPrReview/dispatchPrReview, makes postPrReview awaitable and outcome-returning, gates recordReviewedSha on real delivery, caps consecutive delivery failures per SHA, and degrades a 422 to a summary-only post. The re-entrancy guard (task.finishing) is added consistently across the line/close/error handlers, and the tests are thorough and match the implemented behavior. Two soft points are worth noting but neither contradicts the spec.
