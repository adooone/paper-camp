---
id: IDEA-19
title: Resolve open questions from Docs
type: feat
status: done
created: 2026-06-28
updated: 2026-06-30
tags:
  - app
  - docs
---

Resolve open questions from the Docs page: a form that writes the answering decision to decisions.md and flips the question to resolved.

### Phases
- [x] Add `formatOpenQuestions` serializer
      The plural formatter needed by the resolve endpoint to rewrite the full `open-questions.md` file after flipping an entry's status — mirrors `formatPlanEntry`'s per-entry join in the existing `formatPlans`.
- [x] Add resolve API endpoint
      `POST /api/open-questions/resolve?title=<question title>` with `{ decision, rationale? }`. Validates the target question exists, is `open`, and has no parse warnings before touching any file — then writes the decision entry to `decisions.md` (via `formatDecisionEntry`/`appendBlock`) and flips the matched question to `status: 'resolved'` with `Resolved-by` set. Returns 409 if already resolved or if parse warnings are present.
- [x] Add resolve action UI to OpenQuestionDetail
      A "Resolve" `Button` on `open-question-detail.tsx` (gated on `question.status === 'open'`) opens a `Modal` with a short **Decision** `Input` and optional **Rationale** `Textarea`, following `add-idea-modal.tsx`'s controlled `open`/`onClose`/`onAdd` pattern with local `loading` state.
- [x] Wire frontend API and store refresh
      Add `resolveOpenQuestion(title, decision, rationale?)` to `src/app/services/docs-api.ts`. On success, re-call the store's `loadDecisions`/`loadOpenQuestions` — the same refetch-after-mutation pattern the Stack panel already uses.
- [x] Verify reverse linking end-to-end
      Confirm that newly resolved questions appear in the existing `DecisionDetail`'s `resolvedQuestions` filter (already built at `decision-detail.tsx:16`) without changes.
