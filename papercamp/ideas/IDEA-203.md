---
id: IDEA-203
title: Direct-to-main delivery path
type: feat
status: idea
created: 2026-08-21
updated: 2026-08-21
tags:
  - app
  - git
  - delivery
subject: Review-queue hygiene
---

Not every idea earns a branch. Small ones land straight on main, and the app has no way to finish them: every phase checked puts the idea in `review`, and `review` offers only Complete Idea, whose gate demands an open PR and green CI. An idea that never opened a PR can never satisfy that, so it sits in the review queue forever. [[IDEA-202]] hit this the day it was written.

`deriveStatus` already treats this as a legitimate state — it trusts a stored `review` when no branch and no PR exist, and its test names the case direct-to-main. What was missing is a control that matches. A stopgap already shipped: `canMarkPlanDone` no longer excludes `review`, since its existing `!plan.pr` guard already scopes it to work that never opened a PR, and the merge-and-reset button now hides instead of sitting permanently disabled beside it.

That unblocks the queue but leaves the path second-class. The same outcome is called **Complete Idea** on one route and **Mark done** on the other, and only one of them checks anything. The PR route verifies a merge and green CI before it promotes; the direct route promotes on trust, so an idea can be archived while its work sits uncommitted in the working tree. A direct completion should confirm the work actually landed — a clean tree, and commits carrying the idea's id present on main — and say what is missing when it has not.

### The branch surface

Branch creation is delivery, so it belongs with the other delivery controls in the actions sidebar rather than as a card in the middle of the idea body. Moving it also settles what happens after: once you are on the idea's branch, the detail view shows a second card that says nothing the top bar does not already say. That card goes. The idea view keeps the case that carries information — being on the *wrong* branch — and even that reads better as a sidebar control than as a banner.

### Phases
- [ ] Verify a direct completion before promoting
      Require a clean working tree and commits for the idea's id on main; report exactly what is missing when the check fails.
- [ ] Give both routes one name
      The PR route and the direct route reach the same end state and should say so; keep the distinction in what each verifies, not in the label.
- [ ] Move branch creation into the actions sidebar
      The create-and-switch control joins the other delivery actions in `PlanActionsColumn`.
- [ ] Drop the on-branch card from the idea view
      `BranchRow`'s on-own-branch card duplicates the top bar; remove it and keep only the wrong-branch case.
