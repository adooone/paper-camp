---
id: IDEA-106
title: Slim agent prompts for short, direct output
type: feat
status: done
created: 2026-07-29
updated: 2026-08-02
tags:
  - agent
  - plans
  - app
subject: Simplicity pass
---

Agents — plan-drafting worst — produce walls of text you skim past and then accept things you didn't mean to. Root cause: no prompt bounds what the agent *writes*.

Add one shared brevity contract to the writer prompts (`prompts.ts`: draft, extend, rework, audit): 3–7 phases, one-line imperative titles, ≤1-sentence descriptions only when non-obvious, no restating the idea, no summarising what it did. Trim `buildPlanDraftPrompt`'s input dump — it currently injects every open plan's full body + phases — down to `ID: Title (N phases)`. Factor the three near-identical extend/suggestion/roadmap-promote prompts into one. Compress the over-instruction paragraphs in `buildAgentPrompt` (`agent.ts`) and `buildFixReviewPrompt` to a line or two each.

### Phases
- [x] Add a shared brevity contract snippet
      One reusable constant in `prompts.ts`: 3–7 phases, one-line imperative titles, ≤1-sentence descriptions only when non-obvious, no restating the idea, no summarising the work.
- [x] Apply the contract to the writer prompts
      Wire it into draft, extend, rework, and audit builders.
- [x] Trim `buildPlanDraftPrompt`'s scope dump to `ID: Title (N phases)`
      Drop the per-plan body + phase-checkbox injection.
- [x] Fold the extend/suggestion/roadmap-promote prompts into one
      One shared builder behind `buildIdeaExtendPrompt`/`buildSuggestionPromotePrompt`/`buildRoadmapPromotePrompt`.
- [x] Compress `buildAgentPrompt` and `buildFixReviewPrompt` over-instruction
      Cut each over-instruction paragraph down to a line or two.
- [x] Update prompt tests and full pass
      Adjust `prompts.test.ts`/`agent.test.ts` expectations, then type-check and run the suite.
