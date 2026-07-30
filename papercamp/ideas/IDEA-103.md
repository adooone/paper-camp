---
id: IDEA-103
title: One feedback thread on every idea, any status
type: feat
status: review
created: 2026-07-28
updated: 2026-07-28
tags:
  - app
  - plans
  - ui
subject: Simplicity pass
---

Feedback on an idea is split across two surfaces that don't cohere, and the flow is buggy. `CommentsSection` (`entity-detail.tsx`) is a plain log; the `Feedback` view (`PlanReviewSection`, the chat from IDEA-89) only appears for `review`/`done` plans (`isReviewable`/`showFeedback` gate the `detailView` switcher). So while you're actually building an idea — the moment you most want to jot "this needs rework" — there's no conversation surface, only Comments.

Worse, the current behaviour is broken in practice: posting a couple of messages and hitting refresh doesn't show them; the split/preview flow throws up several modals carrying the same information; and what it does show is a wall of text that's hard to read and act on.

Fold it into one thing. Make the **Feedback view the single conversation** about an idea's adjustments and fixes — comments, review points, and the agent's split proposals all live in one chat thread — and expose it for **every status**, not just `review`/`done` (drop the `isReviewable` restriction on the view switcher). Retire the separate `CommentsSection`, or make it the same thread under a clearer name. Fix the mechanics along the way: a posted message must appear after refresh (the thread reads from the same source it writes to), no duplicate modals (one proposal in-thread, not a stack of panels), and short, scannable messages instead of a huge block.

Builds directly on the Feedback view and `detailView` slice from [[IDEA-89]]'s rework. Note the earlier IDEA-89 bug report (messages not appearing after refresh, an approval modal that did nothing) is the same class of problem — this idea is where that gets resolved properly, as one simple thread.

### Phases
- [x] Expose the Feedback view for every status
      Drop the `isReviewable`/`showFeedback` gate on the `detailView` switcher so the thread is reachable while an idea is `idea`/`planned`/`in-progress`, not just `review`/`done`.
- [x] Read and write the thread from one source
      Point the Feedback view at the same store slice and route it posts to, so a posted message survives refresh — resolving the IDEA-89 persistence bug at its root.
- [x] Fold `CommentsSection` into the single thread
      Merge the plain comment log into the Feedback thread (comments, review points, and split proposals as one conversation) and retire the separate `CommentsSection` from `entity-detail.tsx`, or rename it as that thread.
- [x] Collapse the split/preview modals into one in-thread proposal
      Replace the stack of duplicate panels/modals with a single proposal message rendered in the thread, approved or declined inline — no modal carrying the same information twice.
- [x] Make thread messages short and scannable
      Render each entry compact instead of a wall of text, so review points and proposals are easy to read and act on.
- [x] Type-check and full pass
