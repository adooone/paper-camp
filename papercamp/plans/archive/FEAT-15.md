---
id: FEAT-15
title: Plan/decision consistency check
kind: feat
status: done
created: 2026-06-26
idea: IDEA-12
updated: 2026-06-27
tags:
  - app
  - stack
  - docs
---

A read-only, derived findings pass over `decisions.md`/`open-questions.md`/`plans.md`:
dangling cross-references, and open questions that are still `open` while the plan they
block is `in-progress`/`review`. No AI involved — every check is a pure function over
already-parsed entries, same "derive, don't duplicate" approach `deriveIdeaStatuses`
already uses. See ideas.md's "Plan/decision consistency check" for full rationale.

### Phases
- [x] Add `blocks?` field to OpenQuestionEntry
      Parsed/serialized the same way `PlanEntry`'s existing optional `idea` field already
      is — a plan `id` (e.g. `FEAT-2`) that this open question blocks
- [x] Add findConsistencyIssues() derived check
      Pure function over already-parsed entries: dangling `resolvedBy`/`supersededBy`
      references that don't match any actual entry title, and open questions with
      `blocks` pointing at a plan whose `status` is `in-progress` or `review`
- [x] Add GET /api/consistency route
      Returns the findings array as-is, same shape pattern as the other read routes
- [x] Add Consistency pill to Stack panel Status section
      Fourth pill next to Lint/Format/Tests — `clean` or a count, same `Stamp` and
      click-to-expand pattern, expanding into a list of findings each linking through to
      the Docs page entry or the blocking plan
