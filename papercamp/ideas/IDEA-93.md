---
id: IDEA-93
title: Trace an idea from roadmap to release
status: idea
created: 2026-07-25
updated: 2026-07-26
subject: Insight from the task log
---

The chain from intent to shipped already exists in pieces but is not navigable: roadmap item → idea → phases → tasks → commits → PR → release line. [[IDEA-83]] built the last hop, so a release line now carries its idea id; `pr-lookup` resolves PRs by entity; `tasks.log` records every run against its plan id. Nothing joins them up, so "what was actually done, and where did it come from" is a question you answer by hand.

Make the trail first class in both directions: from a roadmap item, see the work it produced and how far it got; from a release line or a commit, get back to the idea that motivated it. This is the concrete answer to tracking progress — it turns provenance from a reconstruction exercise into a click path, and it makes the corpus legible to someone who wasn't in the room.

Depends on [[IDEA-91]] for the roadmap end of the chain.
