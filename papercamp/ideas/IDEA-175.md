---
id: IDEA-175
title: Scout posts a formatted review
type: feat
status: review
created: 2026-08-14
updated: 2026-08-14
tags:
  - app
  - github
  - ui
subject: Richer review loop
order: 15
---

Reviews currently post from the repo owner's own account with a one-string
summary. They should read as **Paper Scout**, and the summary should have shape
without becoming a report.

### Scout posts, via a dispatch to Actions

Scout's identity exists only inside GitHub: `draft-pr.yml` mints its token with
`actions/create-github-app-token@v1` from the `SCOUT_APP_ID` /
`SCOUT_PRIVATE_KEY` repo secrets. There is no `.env` in this repo and no
JWT/installation-token machinery in `src/` — the local poller authenticates as
the user through `gh`.

The private key stays in GitHub. The local agent computes the review; a workflow
posts it:

1. `postPrReview` calls `POST /repos/{owner}/{repo}/dispatches` with
   `event_type: paper-camp-review` and the verdict nested under a single
   `client_payload.review` key.
2. A new `.github/workflows/scout-review.yml` triggers on `repository_dispatch`,
   mints the Scout token exactly as `draft-pr.yml` does
   (`permission-pull-requests: write`), and posts via
   `gh api repos/.../pulls/{n}/reviews`.
3. If the dispatch fails — no Actions, a fork, offline — fall back to today's
   direct post as the user, and say which path was taken in the task line.

Two mechanics that will bite if missed:

- **`repository_dispatch` only triggers workflows on the default branch.** The
  workflow must be merged to `main` before any review posts this way; a copy on
  the feature branch never fires.
- **`client_payload` is capped** (ten top-level properties, plus a request size
  ceiling). Nest everything under one `review` key, and cap the findings sent.
  When findings are dropped, say so in the rendered summary — never truncate
  silently.

### It changes how the ledger works

Dispatch returns `204` immediately; the post happens later, in CI. **The local
task can no longer know whether the review landed**, which is exactly what
[[IDEA-173]] wanted to gate the reviewed-SHA ledger on.

Resolve it in the poller rather than at task completion: record the SHA when a
later poll *observes* a Scout review present for that head SHA on the PR. The
60-second poll already fetches PR state, so this is one more field. Until that
observation the SHA stays unreviewed and remains retryable, with IDEA-173's
retry cap preventing a loop. IDEA-173 should land first or together — building
this on the current record-on-completion behaviour reintroduces the lost-review
bug in a form that is harder to see, because the failure now happens in CI.

### The summary gets structure, the code renders it

`PrReviewResult.summary` (one free string) is replaced by fields the model fills
and the code formats. The model still returns JSON only and never writes
markdown — asking a model for "nice sections" drifts run to run.

```
verdict:    'approve' | 'comment' | 'request-changes'
assessment: string      // two or three sentences
concerns:   string[]    // short bullets, may be empty
findings:   PrReviewFinding[]   // unchanged
```

Rendered for GitHub:

```
**Requests changes** · 3 findings

Spec conformance is solid and the phases are backed by real code
and tests. The trigger adds a current-branch gate the spec never
listed.

**Concerns**
- A computed review is lost permanently if the post fails
- The verdict parser only handles single-line JSON
- The different-model guard is bypassable via Default

<sub>Paper Scout · IDEA-170 · 8e63279</sub>
```

A clean diff renders as the verdict line, the assessment, and the footer — no
empty **Concerns** heading.

**`verdict` is display-only.** The GitHub review `event` stays `COMMENT`.
`REQUEST_CHANGES` blocks the merge until dismissed, and [[IDEA-170]] settled
that this posts findings and a human decides.

**Rendered per destination.** The idea's `[review]` thread message stays one
line — verdict, count, assessment — with no bullets and no footer. A thread
message is a log line, not a document; the sectioned version belongs only on the
PR.

### Out of scope

What the reviewer checks, and the trigger gates ([[IDEA-170]]). Scout posting
anything other than reviews.

### Phases
- [x] Restructure the review result into verdict/assessment/concerns/findings
      Replace `PrReviewResult.summary` with the four fields and update the model
      schema and prompt so it returns JSON only, never markdown.
      run: 6m7s · 6.2k in · 9.1k out · sonnet-5
- [x] Render the review per destination
      Format the sectioned GitHub body (verdict line, assessment, optional
      Concerns, footer) and the one-line `[review]` thread message; note dropped
      findings in the rendered summary.
      run: 4m50s · 4.3k in · 10.8k out · sonnet-5
- [x] Post through a repository dispatch with a fallback
      Make `postPrReview` dispatch `paper-camp-review` with everything nested
      under `client_payload.review` and capped, falling back to the direct
      user post and reporting the path taken in the task line.
      run: 8m29s · 954 in · 21.7k out · sonnet-5
- [x] Add the scout-review workflow
      New `.github/workflows/scout-review.yml` on `repository_dispatch` that
      mints the Scout token as `draft-pr.yml` does and posts the review; must
      merge to `main` before it can fire.
      run: 1m6s · 361 in · 3.7k out · sonnet-5
- [x] Record the reviewed SHA from the poller
      Land on [[IDEA-173]], then mark a head SHA reviewed only when a later poll
      observes a Scout review present for it, keeping unobserved SHAs retryable.
      run: 8m44s · 10.5k in · 26.4k out · sonnet-5
- [x] [manual] Scout posts a formatted review

### Thread
- [x] 2026-08-14 [question] [agent] Run-all parked on phase 5 ("Record the reviewed SHA from the poller") — the agent needs a decision: IDEA-173 (the gate this phase depends on for retry-capping / not-recording transient failures) hasn't landed — its phases are all unchecked. Should I implement phase 5 anyway on the current record-on-completion behavior, implement the minimal pieces of IDEA-173 needed as a prerequisite within this run, or hold this phase until IDEA-173 lands separately?
- [x] 2026-08-14 [clarification] implement 5 phase
- [x] 2026-08-14 [chat] [agent] Got it — implementing phase 5 now on the current record-on-completion behavior, without pulling in IDEA-173's prerequisite changes. Phase 5 is already queued and unchecked, so run-all will pick it up as-is.
- [x] 2026-08-14 [review] [agent] Comments · 2 findings — The restructure into verdict/assessment/concerns/findings, the per-destination rendering, the dispatch-with-fallback, the workflow, and the poller-observes-the-footer recording all match the spec and are well covered by tests. The one substantive risk is that a dispatch returning 204 is treated as a delivered review even though the workflow may never fire (not yet on main, missing Scout secrets, CI failure), and with IDEA-173's retry cap not landed this can re-review the same SHA every poll forever — a spec-acknowledged consequence of shipping phase 5 ahead of IDEA-173.
- [x] 2026-08-14 [review] [agent] The restructure into verdict/assessment/concerns, the per-destination rendering, the dispatch-with-fallback, the Scout workflow, and the poller-observed SHA recording are all present and well-tested. Two things are worth a human's attention before merge: dispatch success detection may misread the dispatches endpoint's empty 204 as a failure, and because IDEA-173's retry cap was deliberately not landed (per the settled clarification), an undelivered/unobserved review re-dispatches and re-appends a [review] thread message on every 60s poll.
