---
id: IDEA-44
title: Idea overlap check at capture
---

## IDEA-44: Idea overlap check at capture

Multiple plans per idea already work mechanically (`idea:` is many-to-one), but nothing helps a new intention find its existing home — so similar ideas proliferate instead of accumulating under one theme. Make "attach to an existing idea" easier than "create a near-duplicate", at both capture points.

- **Tier 1 — instant, no AI.** As a title is typed in the New-idea modal, live-match it against existing idea titles/bodies/tags (`ideaEntries` is already in the store; keyword scoring is plenty for ~45 ideas). A "Similar ideas" strip appears with per-match actions: **Open it**, **Extend it instead** (the typed text becomes a dated `### Log` refinement on the existing idea — needs [[IDEA-43]]'s log grammar), or **Draft a plan under it** (the intention was actionable all along; skip the new idea entirely).
- **Same strip on the Quick-plan path.** When creating a plan directly, suggest candidate parent ideas so plans that belong to a theme get their `idea:` link at birth instead of staying orphans.
- **Tier 2 — AI triage, on demand.** A "Check overlap" action handing the new text plus the ideas index to an agent: does this belong inside an existing idea, extend one, or is it genuinely new? Reuses the existing launch plumbing and prompt-builder pattern (`prompts.ts`, `launch-extend`/`launch-draft`); optionally the same check becomes a step inside the plan-drafting prompt.
- **No relations system.** "This new thought supersedes part of an old idea" is covered by the extend-instead flow (a dated refinement saying so) — no cross-idea link fields, no graph to keep consistent.

Depends on [[IDEA-43]]'s unified worklist (shared capture points and the idea log grammar). Keeps the idea corpus small and thematic, which is also what makes [[IDEA-43]]'s grouping readable.
