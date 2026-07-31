---
id: IDEA-97
title: Surface decisions where they bind
type: feat
status: done
created: 2026-07-26
updated: 2026-07-29
tags:
  - app
  - core
  - ui
subject: Planning surface
order: 12
---

`papercamp/decisions.md` is 738 lines of settled calls with no UI — `GET /api/decisions` exists and nothing in the app consumes it. But unlike open questions, decisions already have a working consumer that is not human: `prompts.ts` feeds them to agents, and the project's own methodology says not to re-litigate a logged decision without flagging it. Decisions are guardrails.

That is why the answer is not a page. [[IDEA-19]] built a browse UI for this material and [[IDEA-68]] removed it as unused — correctly, because nobody opens a 738-line reference list for fun. The value of a decision is being **surfaced at the moment something contradicts it**, not being browsable.

Most of that machinery already exists: `/api/consistency` cross-references decisions and open questions against plans and returns `ConsistencyIssue[]`, and the Stack panel already carries a doc-consistency stamp. What is missing is the click-through and the action — an issue should lead to the decision behind it, and let you either honour it or supersede it deliberately. Beyond that: decisions relevant to an entity shown on that entity (matched by tags or subject), and search for when you genuinely need to look one up.

The other half is capture. Decisions get made in conversation and on entities, so logging one should be possible from where it happens — an entity's comment or clarification promoted into a decision — rather than requiring a hand-edit of a 738-line file.

Pairs with [[IDEA-96]]: that idea ends with an answered question becoming a decision, and this one is what makes the resulting decision do any work. Build it second — this is the larger design of the two.

Open questions for the plan: whether superseding a decision edits it in place or appends a superseding entry with a pointer (the corpus favours append-only history); and whether decisions should become per-file entities like [[IDEA-20]] did for plans and ideas, making them linkable and taggable, against the cost of migrating 738 lines into many small files.

### Phases
- [x] Settle the modelling questions
      Decide supersede-in-place vs append-a-superseding-entry (favour append-only history) and per-file decision entities vs the single `decisions.md`. Land the schema/parsing consequence of that choice in `src/core`.
- [x] Click through a consistency issue to the decision behind it
      Make each `ConsistencyIssue` from `/api/consistency` resolve to the decision it references and render a navigable link from the Stack panel's doc-consistency stamp.
- [x] Honour-or-supersede action on a decision
      From a surfaced decision, let the user either honour it or deliberately supersede it, writing the change through the append/in-place shape settled in phase 1.
- [x] Show decisions relevant to an entity on that entity
      Match decisions to an entity by tags or subject and render them in `entity-detail.tsx` so guardrails appear where work happens.
- [x] Add decision search for deliberate lookup
      A search over the decision corpus for when you genuinely need to find one, rather than a browse page.
- [x] Capture a decision from where it is made
      Promote an entity comment or clarification into a decision from the entity, reusing the existing promote shape instead of hand-editing `decisions.md`.
- [x] Type-check and full pass

### Thread
- [x] [decision] Superseding a decision appends a new entry with a pointer, not an in-place edit
- [x] [decision] Decisions stay in the single `decisions.md`, not per-file entities
