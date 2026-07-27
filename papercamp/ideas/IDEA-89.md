---
id: IDEA-89
title: Review a finished plan in prose
type: feat
status: idea
created: 2026-07-25
updated: 2026-07-26
tags:
  - plans
  - app
subject: Richer review loop
order: 4
---

There is no way to give feedback on a completed plan from inside the app. The one affordance is "Add /code-review findings" (`src/app/features/plans/actions/add-review-phases-button.tsx`), which requires pasting JSON for `parseReviewFindings` to consume — a machine format demanded at a human moment. In practice the review gets written in a chat session and never reaches the corpus at all.

Replace the front door with prose: a review box on a plan in `review` or `done` where you write what's wrong in your own words. An agent then turns each point into either rework phases appended to this plan, or a follow-up idea — proposing that split for approval instead of guessing which one you meant. The JSON paste stays available as a power path for genuine `/code-review` output.

Same primitive as [[IDEA-87]] (anchored prose in, structured change out), anchored at the whole plan rather than one phase, so build it after that one. Note the existing `fix-review` task kind already converts PR review threads into fixes — this is its human-authored sibling, and the two should converge on the same application path.

### Phases
- [x] Add a prose review box on plans in `review` or `done`
      A human-authored review input on `entity-detail.tsx`, shown for entities in `review`/`done`, sitting alongside (not replacing) the existing JSON-paste action.
- [x] Launch a review agent that splits each point into rework or a follow-up idea
      A task kind (sibling of `fix-review`) that reads the written prose and, per point, proposes either rework phases appended to this plan or a new follow-up idea — proposing the split rather than guessing.
- [x] Render the proposed split for approval
      Reuse the reconcile before/after preview (`launchPlanRework`/`launchPlanReconcile` in `app-store.ts`) so the appended phases and any minted idea are approved or discarded, never applied blind.
- [x] Apply the approved split — append rework phases and mint follow-up ideas
      On approve, write phases through `PATCH /api/plans` and create the follow-up idea file(s), converging on the same application path as `fix-review`.
- [ ] Keep the JSON paste as a power path
      Preserve `AddReviewPhasesButton` and `parseReviewFindings` for genuine `/code-review` output.
- [ ] Type-check and full pass
