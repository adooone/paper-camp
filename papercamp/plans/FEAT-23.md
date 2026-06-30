---
id: FEAT-23
title: Resolve open questions from Docs
kind: feat
status: idea
created: 2026-06-28
idea: IDEA-19
tags:
  - app
  - docs
---

The Docs page's open-question detail view is read-only today — it shows the question, its `open`/`resolved` `Stamp`, and a click-through to whatever `decisions.md` entry resolved it, but there's no way to actually answer one from the app. The serializer half is already written (`formatDecisionEntry`/`formatOpenQuestionEntry`/`appendBlock` in `src/core/serializer.ts`) but nothing calls it — this plan wires up the missing route and UI. The reverse link from a decision back to the questions it answers already exists in `DecisionDetail` and needs zero changes.

### Phases
- [ ] Add `formatOpenQuestions` serializer
      The plural formatter needed by the resolve endpoint to rewrite the full `open-questions.md` file after flipping an entry's status — mirrors `formatPlanEntry`'s per-entry join in the existing `formatPlans`.
- [ ] Add resolve API endpoint
      `POST /api/open-questions/resolve?title=<question title>` with `{ decision, rationale? }`. Writes the new decision entry to `decisions.md` first (via `formatDecisionEntry`/`appendBlock`), then flips the matched question entry to `status: 'resolved'` with `Resolved-by` set — order matters so `findConsistencyIssues` never sees a dangling `Resolved-by`.
- [ ] Add resolve action UI to OpenQuestionDetail
      A "Resolve" `Button` on `open-question-detail.tsx` (gated on `question.status === 'open'`) opens a `Modal` with a short **Decision** `Input` and optional **Rationale** `Textarea`, following `add-idea-modal.tsx`'s controlled `open`/`onClose`/`onAdd` pattern with local `loading` state.
- [ ] Wire frontend API and store refresh
      Add `resolveOpenQuestion(title, decision, rationale?)` to `src/app/services/docs-api.ts`. On success, re-call the store's `loadDecisions`/`loadOpenQuestions` — the same refetch-after-mutation pattern the Stack panel already uses.
- [ ] Verify reverse linking end-to-end
      Confirm that newly resolved questions appear in the existing `DecisionDetail`'s `resolvedQuestions` filter (already built at `decision-detail.tsx:16`) without changes.
