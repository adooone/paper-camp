---
id: IDEA-89
title: Review a finished plan in prose
type: feat
status: done
created: 2026-07-25
updated: 2026-07-29
released: v0.12.0
tags:
  - plans
  - app
subject: Richer review loop
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
      Render a before/after preview (`ReviewSplitPreviewPanel`) so the appended phases and any minted idea are approved or discarded, never applied blind.
- [x] Apply the approved split — append rework phases and mint follow-up ideas
      On approve, write phases through `PATCH /api/plans` and create the follow-up idea file(s), converging on the same application path as `fix-review`.
- [x] Keep the JSON paste as a power path
      Preserve `AddReviewPhasesButton` and `parseReviewFindings` for genuine `/code-review` output.
- [x] Type-check and full pass
- [x] Give Review its own chat surface
      Replace the Comments-clone `PlanReviewSection` (`entity-detail.tsx`) with a distinct thread: your points render as right-aligned author messages, not the shared `DatedEntryList`, visually separated from Comments, with a bottom composer and a visible send confirmation.
- [x] Post the split proposal as an in-thread reply
      Render the agent's proposed split as an agent message inside the same thread, with a pending state while `splitReview` runs, replacing the detached `ReviewSplitPreviewPanel` that seems to pop up after a refresh.
- [x] Apply from the thread with a visible result
      Move approve/discard into the agent's reply and post a confirmation summarising what landed (phases appended here, ideas minted) so approving is never silent; keep the same `createIdea` + `PATCH /api/plans` application path.
- [x] Type-check and full pass
- [x] Add a Views switcher to the plan sidebar
      In `plan-actions-column.tsx`, add a "Views" section listing Details (default) and Feedback (only for `review`/`done`); selection drives a shared `detailView` store slice so the sidebar and content agree.
- [x] Swap detail content by active view
      In `entity-detail.tsx`, keep the title header, render the overview (branch/progress/body/phases/comments) under Details, and move `PlanReviewSection` into Feedback; reset to Details when the open plan changes.
- [x] Type-check and full pass

### Thread
- [x] 2026-07-27 [log] I dont see any of my review messages. And it is not clear what is the flow after sending the review message. I sent the review and nothing changed visually in the idea view.  It just goes nowhere. Also I was trying to click refresh, and after refresh completed I saw the modal which ask me about approve of some changes - I approved it and nothing happend. No new phases or at least some messages in comments or in the review. How it is supposed to work?
- [x] 2026-07-27 [review] I dont like this section is looking the same as comments section. I would rather do it as a separate view, and make it look like a chat where I can put my thoughts, and it will run agent with my review in this chat.
