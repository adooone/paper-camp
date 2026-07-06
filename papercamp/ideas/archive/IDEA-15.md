---
id: IDEA-15
title: Agent-drafted plans
type: feat
status: done
created: 2026-06-26
updated: 2026-06-27
tags:
  - app
  - plans
  - agent
---

The "Draft plan" agent: reads an idea and writes a real phased plan entry with title, phases, descriptions, and the idea backlink.

### Phases
- [x] Generalize agent task scope for plan-drafting tasks
      Shares the non-phase-scoped launch mode added by FEAT-14 (or builds it here if that
      lands first) — this task has neither `planId` nor `phaseIndex`, since the plan
      doesn't exist until the agent writes it; success-check is "did a new `## Heading`
      with `idea: IDEA-N` appear in plans.md"
- [x] Decide write-directly-vs-propose-first
      Resolve whether the agent commits the new plan straight to `plans.md` (like
      FEAT-10's phase-execution agent) or produces a draft requiring approval first —
      stated open question in ideas.md, needs an actual answer before the rest of this
      ships
- [x] Add plan-drafting prompt builder
      Includes the idea's full body, relevant `about.md`/`decisions.md` context, every
      other non-`done` plan (for the priority/ordering decision), and instructions to
      insert the new plan at the right file position — moving existing plan headings if
      warranted, never editing their title/phases/body
- [x] Add "Draft plan" button to IdeasBoard row
      Available only while the idea has no linked plan yet; once one exists, the
      per-phase buttons take over
- [x] Add visible file-order ranking to the Backlog section
      A small ordinal marker per `PlanCard` reflecting file position, read-only — without
      this, the agent's priority/ordering decisions are invisible in the UI
- [x] Show a skeleton plan card while drafting is in progress
      While `agentStatus.ideaId` is set and the task is `starting`/`running`, render a
      placeholder `PlanCard` in the Backlog list (wherever the new plan will land) showing
      only the real `idea.id` and a "Creating a plan…" title — every other field (status
      stamp, tags, rank, phase count) renders as a loading-skeleton block instead of real
      content. Disappears once the real plan entry appears (or the task finishes/errors).

### Log
- 2026-06-27: No visible feedback when draft button is clicked. No agent logs in stack and nothing working. After clicking draft button I dont see plan was created. Or where should I find it?
