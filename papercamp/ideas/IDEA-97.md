---
id: IDEA-97
title: Surface decisions where they bind
status: idea
created: 2026-07-26
updated: 2026-07-26
subject: Planning surface
---

`papercamp/decisions.md` is 738 lines of settled calls with no UI — `GET /api/decisions` exists and nothing in the app consumes it. But unlike open questions, decisions already have a working consumer that is not human: `prompts.ts` feeds them to agents, and the project's own methodology says not to re-litigate a logged decision without flagging it. Decisions are guardrails.

That is why the answer is not a page. [[IDEA-19]] built a browse UI for this material and [[IDEA-68]] removed it as unused — correctly, because nobody opens a 738-line reference list for fun. The value of a decision is being **surfaced at the moment something contradicts it**, not being browsable.

Most of that machinery already exists: `/api/consistency` cross-references decisions and open questions against plans and returns `ConsistencyIssue[]`, and the Stack panel already carries a doc-consistency stamp. What is missing is the click-through and the action — an issue should lead to the decision behind it, and let you either honour it or supersede it deliberately. Beyond that: decisions relevant to an entity shown on that entity (matched by tags or subject), and search for when you genuinely need to look one up.

The other half is capture. Decisions get made in conversation and on entities, so logging one should be possible from where it happens — an entity's comment or clarification promoted into a decision — rather than requiring a hand-edit of a 738-line file.

Pairs with [[IDEA-96]]: that idea ends with an answered question becoming a decision, and this one is what makes the resulting decision do any work. Build it second — this is the larger design of the two.

Open questions for the plan: whether superseding a decision edits it in place or appends a superseding entry with a pointer (the corpus favours append-only history); and whether decisions should become per-file entities like [[IDEA-20]] did for plans and ideas, making them linkable and taggable, against the cost of migrating 738 lines into many small files.
