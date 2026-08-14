---
id: IDEA-170
title: Review pull requests with a local agent
type: feat
status: idea
created: 2026-08-14
updated: 2026-08-14
tags:
  - app
  - agent
  - github
subject: Richer review loop
---

Paper-camp reviews its own pull requests with a local agent, replacing
CodeRabbit as the producer at the front of a pipeline it already owns.

The consuming half is already built. [[IDEA-57]] wired
`fetchUnresolvedThreads` → `buildFixReviewPrompt` → `startFixReview` →
`FixReviewResult` → `replyToReviewThread`/`resolveReviewThread`: paper-camp
reads a reviewer's threads, launches an agent to address them, replies and
resolves each one. CodeRabbit is only the "someone" at the front of that.
Swapping it out is a producer change, not a new system.

Also already in place: `gh` probed as a capability; `PrInfo` carrying
`state`/`reviewDecision`/`unresolvedThreadCount`; per-entity PR resolution
polled every `PR_POLL_INTERVAL_MS` (60s); CI status per branch via `/api/ci`;
`ThreadMessageKind` already including `'review'`; and per-task agent defaults
in `config.json` (`phase`, `planDraft`, `ideaExtend`, `commitSuggest`,
`feedback`), each `{agent, model, effort}`.

**Genuinely new:** a trigger, a review prompt, one GitHub write op, a
`codeReview` entry in `defaultAgents`, and `taskKind: 'pr-review'` — named so
it can't be confused with the `review` *status*.

### Why this beats an external reviewer

Not "Claude instead of CodeRabbit". Paper-camp can review a diff **against the
idea that motivated it** — did this deliver what the body and phases specified,
are the phases it claims complete actually complete, does it contradict a
settled decision in the thread. No external tool can do that, because the spec
lives in the corpus, not the diff.

The review checks both: spec conformance *and* ordinary code quality
(correctness, security, edge cases). The spec half is the part only paper-camp
can do; the quality half is what dropping CodeRabbit would otherwise lose.

### Trigger

The dev server's existing PR poll fires it. Gate: the PR is **ready for review
(`state === 'open'`, not `draft`)**, its CI is green, and its current head SHA
has not been reviewed yet.

Requiring non-draft is load-bearing: `.github/workflows/draft-pr.yml` opens a
draft PR on the *first push* to any branch, so a "PR exists + CI green" gate
would review a one-commit WIP every time.

One review per head SHA — new commits mean a new review, and the 60s poll must
never re-review the same SHA. The reviewed SHA is recorded so this survives a
restart.

On boot, sweep for PRs that are ready, green, and unreviewed at their current
SHA. Reviews only fire while paper-camp is running; that is the accepted cost
of using local Claude Code auth instead of an API key in CI. A CI-side trigger
is a possible follow-up, not part of this.

### The reviewing agent

A separate `codeReview` entry in `defaultAgents`, so the reviewer's model is
configured independently in Settings alongside the existing four. **A different
model from the one that wrote the code is required, not advisory** — an agent
reviewing its own work rubber-stamps it.

The reviewer is given the diff, the idea's body, phases and thread. It is **not**
given the authoring run's transcript or log, so it cannot inherit the author's
reasoning and re-derive the same blind spots.

### Output

A real PR review with per-line comments (`POST
/repos/{owner}/{repo}/pulls/{n}/reviews` — the one GitHub write op paper-camp
lacks; it has read, reply and resolve but cannot create a review). Each finding
becomes a resolvable thread, which is exactly what `fetchUnresolvedThreads`
already consumes, so the existing Fix-review button picks them up with no
changes.

The summary lands as a `[review]` thread message on the idea, so the verdict is
in the corpus and travels with the entity.

### Fix-review stays manual

`FixReviewButton` is a button today and remains one. Once paper-camp both
produces and consumes reviews, auto-triggering the fixer gives a reviewer and a
fixer ping-ponging with no fixed point — the same shape as the manual-phase-row
loop fixed under [[IDEA-151]]. A human gate between producing and consuming is
the guard.

### Out of scope

A CI-side trigger and any API-key path. Reviewing anything but a PR (no
review-on-commit, no review-on-branch). Auto-approving or merging on a clean
review — this posts findings, a human decides. Removing CodeRabbit from the
repo; run both until this earns the slot.

### Phases
- [ ] Add `codeReview` to `defaultAgents` and Settings
      Configure it independently of the four existing tasks and enforce a model different from the code's author.
- [ ] Add the create-review GitHub write op
      Wrap `POST /repos/{owner}/{repo}/pulls/{n}/reviews` alongside the existing read/reply/resolve ops.
- [ ] Build the `pr-review` task kind and review prompt
      Assemble the diff, idea body, phases and thread; withhold the authoring run's transcript and log.
- [ ] Wire the PR-poll trigger
      Fire only when the PR is open (non-draft), CI is green, and the head SHA is unreviewed; durably record the reviewed SHA and sweep on boot.
- [ ] Post the review and corpus summary
      Emit per-line comments as resolvable threads and land the verdict as a `[review]` thread message on the idea.
