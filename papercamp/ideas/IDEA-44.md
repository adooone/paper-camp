---
id: IDEA-44
title: Check idea overlap at capture
type: feat
created: 2026-07-04
tags:
  - app
  - ideas
  - agent
---

Multiple plans per idea already work mechanically (`idea:` is many-to-one), but nothing helps a new intention find its existing home — so similar ideas proliferate instead of accumulating under one theme. Make "attach to an existing idea" easier than "create a near-duplicate", at both capture points.

- **Tier 1 — instant, no AI.** As a title is typed in the New-idea modal, live-match it against existing idea titles/bodies/tags (`ideaEntries` is already in the store; keyword scoring is plenty for ~45 ideas). A "Similar ideas" strip appears with per-match actions: **Open it**, **Extend it instead** (the typed text becomes a dated `### Log` refinement on the existing idea — needs [[IDEA-43]]'s log grammar), or **Draft a plan under it** (the intention was actionable all along; skip the new idea entirely).
- **Same strip on the Quick-plan path.** When creating a plan directly, suggest candidate parent ideas so plans that belong to a theme get their `idea:` link at birth instead of staying orphans.
- **Tier 2 — AI triage, on demand.** A "Check overlap" action handing the new text plus the ideas index to an agent: does this belong inside an existing idea, extend one, or is it genuinely new? Reuses the existing launch plumbing and prompt-builder pattern (`prompts.ts`, `launch-extend`/`launch-draft`); optionally the same check becomes a step inside the plan-drafting prompt.
- **No relations system.** "This new thought supersedes part of an old idea" is covered by the extend-instead flow (a dated refinement saying so) — no cross-idea link fields, no graph to keep consistent.

Depends on [[IDEA-43]]'s unified worklist (shared capture points and the idea log grammar). Keeps the idea corpus small and thematic, which is also what makes [[IDEA-43]]'s grouping readable.

Multiple plans per idea already work mechanically (`idea:` is many-to-one), but
nothing helps a new intention find its existing home — similar ideas proliferate
instead of accumulating under one theme. This plan makes "attach to an existing
idea" easier than "create a near-duplicate" at both capture points. Tier 1 is
instant and AI-free: as a title is typed in the New-idea modal, a factored
matcher live-scores the text against existing idea titles, bodies, and tags
(`ideaEntries` is already in the store; keyword scoring is plenty at ~45 ideas)
and a "Similar ideas" strip appears with per-match actions — **Open it**,
**Extend it instead** (the typed text becomes a dated `### Log` refinement on
the existing idea, using [[IDEA-43]]'s log grammar), or **Draft a plan under
it** (the intention was actionable all along; skip the new idea entirely). The
same strip appears on the Quick-plan path, suggesting candidate parent ideas so
plans that belong to a theme get their `idea:` link at birth instead of staying
orphans. Tier 2 is on-demand AI triage: a "Check overlap" action hands the new
text plus the ideas index to an agent — does this belong inside an existing
idea, extend one, or is it genuinely new? — reusing the existing launch plumbing
and prompt-builder pattern (`prompts.ts`, `launch-extend`/`launch-draft`).

Deliberately no relations system: "this new thought supersedes part of an old
idea" is covered by the extend-instead flow (a dated refinement saying so) — no
cross-idea link fields, no graph to keep consistent. This depends on
[[IDEA-43]] landing first: it establishes the two capture points this plan
augments (the New-idea modal and the renamed Quick-plan path) and the idea
`### Log` grammar the extend-instead action writes into. [[IDEA-43]] explicitly
left this check out of its own scope. Keeping the idea corpus small and
thematic is also what keeps that plan's grouped worklist readable.

### Phases
- [x] Build the keyword similarity matcher
      A factored module/hook scoring typed text against `ideaEntries` titles,
      bodies, and tags — keyword overlap is enough at this corpus size. Returns
      ranked matches above a threshold, debounced for live use as the user
      types, and kept out of the modal components so both capture points share
      it.
- [x] Render the Similar-ideas strip in the New-idea modal
      As the title is typed, show matched ideas below the input — id, title,
      and per-match actions, starting with **Open it** (navigate to the idea
      detail). The strip is absent when nothing scores above threshold, so the
      common no-overlap case stays visually unchanged.
- [x] Wire the Extend-instead and Draft-plan actions
      **Extend it instead** appends the typed text as a dated `### Log`
      refinement on the matched idea ([[IDEA-43]]'s grammar) and closes the
      modal without creating a new idea file. **Draft a plan under it** hands
      off to the existing plan-drafting flow with `idea:` preset to the match.
- [x] Add the strip to the Quick-plan path
      The same matcher in the Quick-plan modal suggests candidate parent
      ideas; picking one sets the new plan's `idea:` field at creation, so
      theme-belonging plans stop being born as orphans.
- [x] Add the AI Check-overlap action
      An on-demand "Check overlap" button handing the new text plus the ideas
      index to an agent via the `prompts.ts` prompt-builder and launch plumbing
      (`launch-extend`/`launch-draft` siblings), returning a triage verdict:
      belongs inside an existing idea, extends one, or genuinely new.
      Optionally fold the same check into the plan-drafting prompt as a step.
- [x] Type-check and visual pass
      `tsc --noEmit`, `biome check`, tests, and a browser pass over both
      capture modals — strip appearance/absence, each action end to end, and
      the Quick-plan `idea:` preset.
