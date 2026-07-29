---
id: IDEA-106
title: Slim agent prompts for short, direct output
type: feat
status: idea
created: 2026-07-29
updated: 2026-07-29
tags:
  - agent
  - plans
  - app
subject: Simplicity pass
---

Agents — plan-drafting worst — produce walls of text you skim past and then accept things you didn't mean to. Root cause: no prompt bounds what the agent *writes*.

Add one shared brevity contract to the writer prompts (`prompts.ts`: draft, extend, rework, audit): 3–7 phases, one-line imperative titles, ≤1-sentence descriptions only when non-obvious, no restating the idea, no summarising what it did. Trim `buildPlanDraftPrompt`'s input dump — it currently injects every open plan's full body + phases — down to `ID: Title (N phases)`. Factor the three near-identical extend/suggestion/roadmap-promote prompts into one. Compress the over-instruction paragraphs in `buildAgentPrompt` (`agent.ts`) and `buildFixReviewPrompt` to a line or two each.
