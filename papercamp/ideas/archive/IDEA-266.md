---
id: IDEA-266
title: The completion gate knows a dirty tree
type: fix
kind: fix
status: done
idea: IDEA-194
created: 2026-09-13
updated: 2026-09-13
tags:
  - app
  - plans
subject: App UI
order: 1
---

*Complete idea* looked ready on 2026-09-13 for IDEA-253 — phases done,
PR #223 open and green — and refused on click, because the working tree
held six uncommitted files. `completionGate` in `plans/helpers/helpers.ts`
checks phases, fixes, the PR, and CI; the daemon's
`/api/git/complete-idea` additionally asserts a clean tree before it
merges, since returning to main cannot happen over unstaged work. The
tooltip named none of that, and the refusal arrived as a toast after the
click, easy to miss next to a green CI stamp.

**The gate carries the tree.** `completionGate` takes the changed-file
count the status bar already reads from `gitStatus`, and a non-zero
count adds *changes to commit* to `missing`, so the command is disabled
with the reason in its tooltip before anyone clicks. The idea sidebar
passes the count through `usePlanActionsColumn`; the Git page's deliver
card, which shows the same command, passes the same. The route keeps its
own assertion as the last line of defence.

**The tooltip says what to do.** The missing list reads as actions —
*commit or stash the changes*, *open a PR*, *wait for CI* — instead of
nouns, matching the rest of the sidebar's commands.

### Out of scope

Committing on the user's behalf from the gate. Any change to what the
route does after the tree is clean.

### Phases
- [x] Take the changed-file count in `completionGate` and phrase `missing` as actions
      In `plans/helpers/helpers.ts`; a non-zero count pushes *commit or stash the changes*, and the existing entries become *finish the phases*, *open a PR*, *wait for CI*.
      run: 1m28s · 20 in · 4.9k out · sonnet-5 · sess:944f78ac-7b9b-46f0-be92-04d74c29bb13
- [x] Update the completion-gate tests for the new argument and wording
      run: 52s · 16 in · 2.4k out · sonnet-5 · sess:944f78ac-7b9b-46f0-be92-04d74c29bb13
- [x] Pass the count from the idea sidebar
      `usePlanActionsColumn` reads the `gitStatus` length the status bar already uses and hands it to `CompleteIdeaButton`, which forwards it to the gate.
      run: 1m34s · 40 in · 4k out · sonnet-5 · sess:944f78ac-7b9b-46f0-be92-04d74c29bb13
- [x] Pass the same count from the Git page's deliver card

### Thread
- [ ] 2026-09-13 [question] [agent] Run-all parked on phase 4 ("Pass the same count from the Git page's deliver card") — the agent needs a decision: Phase 4 says "the Git page's deliver card, which shows the same command, passes the same [count]" — but `CompleteIdeaButton` is not currently rendered anywhere in `deliver-section.tsx` (the idea view's deliver panel) or on the `/git` route; it only exists in `plan-actions-column.tsx` (the idea sidebar). I checked git history and it's never been wired into the deliver card. Should I add `CompleteIdeaButton` to `DeliverSection` (e.g., in the empty-state branch, gated the same way as the sidebar: `underReview && plan.pr`) as part of this phase, or is this phase premised on a component that hasn't been built yet and needs to be re-scoped?
- [x] 2026-09-13 [chat] do not add anything, just adapt all changes to other views if needed
- [x] 2026-09-13 [chat] [agent] Got it — leaving phase 4 as is since there's nothing to wire it into. No other views currently render CompleteIdeaButton, so there's nothing left to adapt.
