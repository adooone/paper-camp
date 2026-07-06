---
id: IDEA-12
title: Plan/decision consistency check
type: feat
status: done
created: 2026-06-26
updated: 2026-06-27
tags:
  - app
  - stack
  - docs
---

Read-only consistency checks over decisions/open-questions/plans: dangling cross-references and open questions still blocking active plans.

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
