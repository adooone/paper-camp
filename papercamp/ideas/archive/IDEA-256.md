---
id: IDEA-256
title: Redraft the phases of an untouched plan
type: fix
kind: fix
status: done
idea: IDEA-255
created: 2026-09-10
updated: 2026-09-11
tags:
  - app
subject: Run & monitor
order: 2
---

[[IDEA-255]] moved the drafting target to 3–5 phases, and every plan
drafted before it — [[IDEA-241]], [[IDEA-250]], [[IDEA-251]] at seven and
eight phases — keeps the old split. There is no way to redraw one from
the app: `DraftPlanButton` in `phases-section.tsx` is offered only while
an idea has no phases, and `buildPlanDraftPrompt` appends a `### Phases`
list, so running it on a drafted plan would produce two lists. The only
route today is deleting the section by hand and drafting again.

**Redraft while nothing has run.** The button stays on an idea whose
phases are all unchecked, labelled *Redraft*, next to *Run all*. Its
prompt is the draft prompt with one added rule: replace the existing
`### Phases` list in place, keeping the section where it is, rather than
appending. An idea with any checked phase, or any run stamp, hides the
button, since its history is already running and the phase list is part
of it. `paper-camp doctor` keeps rejecting a second `### Phases` section,
which is the guard that makes the replacement rule checkable.

### Out of scope

Redrafting a plan that has started. Changing the draft prompt's phase
target, which [[IDEA-255]] set.

### Phases
- [x] Add an untouched-plan predicate
      True when the entity has phases, none are checked, and no phase or fix
      carries a `run` stamp.
      run: 34s · 40 in · 5.6k out · sonnet-5 · sess:30ab7bca-e26b-4a9e-98ee-f94c9224085a
- [x] Give `buildPlanDraftPrompt` a redraft mode
      Same prompt plus the rule to replace the existing `### Phases` list in
      place instead of appending.
      run: 51s · 24 in · 6.6k out · sonnet-5 · sess:30ab7bca-e26b-4a9e-98ee-f94c9224085a
- [x] Teach `DraftPlanButton` the redraft mode
      Label it *Redraft* and send the redraft prompt; the undrafted call sites
      in `phases-section.tsx` and `create-idea-modal.tsx` keep today's wording.
      run: 34s · 12 in · 2.2k out · sonnet-5 · sess:30ab7bca-e26b-4a9e-98ee-f94c9224085a
- [x] Render Redraft next to Run all
      In `plan-actions-column.tsx`, gated on the predicate.
      run: 51s · 40 in · 7.2k out · sonnet-5 · sess:30ab7bca-e26b-4a9e-98ee-f94c9224085a
- [x] Reject a second `### Phases` section in doctor
      Today only orphaned checkboxes are flagged, so nothing catches the
      duplicate list the replacement rule exists to prevent.
      run: 54s · 42 in · 6.3k out · sonnet-5 · sess:30ab7bca-e26b-4a9e-98ee-f94c9224085a
