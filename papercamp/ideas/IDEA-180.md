---
id: IDEA-180
title: Say what each idea is for
type: feat
status: review
created: 2026-08-14
updated: 2026-08-20
tags:
  - app
  - plans
  - format
subject: Planning surface
order: 3
---

`papercamp/plans/plan-list-selector.ts` builds the worklist row from each idea's title, id stamp, status, dates, tags and a progress bar — everything except what the idea is for. With a dozen-plus open ideas, that is the difference between a plan and a pile.

A 40-character title cannot carry the weight on its own. "One source of truth
for checks" — which checks, and what breaks today? "Git status vocabulary and
chrome" — vocabulary for what? The titles are correct and still opaque, and the
title-style rule ([[IDEA-143]]) rightly forbids fixing this by making them
longer.

### A derived purpose line, shown in the worklist row

Every entity gets a one-line "what you get", rendered under its title in the
worklist row.

**Derived, not authored.** The source is the idea's own opening sentence — the
first sentence of the body, trimmed to a line. Every idea already opens by
stating the problem, so the data exists and costs nothing to maintain. A new
frontmatter field would be one more thing to keep honest, and the first thing to
go stale.

An entity whose opening sentence makes a poor summary is an entity whose body
buries its point. Surfacing it is the pressure that fixes the body — the same
argument [[IDEA-143]] made for titles.

The line renders dimmed, single-line with ellipsis, under the title — that is
where the scanning actually happens.

### Out of scope

Any new frontmatter field. Summarising with an agent — the opening sentence is
already the author's own summary, and an agent pass would cost a run per idea to
restate what is written. Changing the title rules ([[IDEA-143]] stands). Any
index.md rendering — that file no longer exists in the app.

### Phases
- [x] Derive the purpose line from the body
      Extract the trimmed opening sentence from each entity's body as its purpose line.
      run: 1m59s · 6.5k in · 6.2k out · sonnet-5
- [x] Show the line in the worklist row
      Render the derived purpose line dimmed, single-line with ellipsis, under the title in plan-list-selector.ts / worklist-rows.tsx.
      run: 2m16s · 1.1k in · 10.2k out · sonnet-5
- [x] Handle bodies with no usable opening sentence
      Define fallback behavior when an entity's body has no sentence that works as a summary.
      run: 2m14s · 962 in · 8.5k out · sonnet-5
- [x] Handle bodies with no usable opening sentence
      Fall back cleanly when the first sentence is empty or degenerate.
      run: 28s · 94 in · 1.1k out · sonnet-5

### Thread
- [ ] 2026-08-20 [question] [agent] Run-all parked on phase 1 ("Derive the purpose line from the body") — the agent needs a decision: `papercamp/ideas/index.md` and `regenerateIndexes` were removed from the codebase (commit dbb663f, 2026-08-18, "Drop ideas/index.md, generate no longer, doc updated") after IDEA-180 was authored. The idea still describes rendering the purpose line "in `index.md` beside the existing columns" via `regenerateIndexes`. Should I: (a) drop the index.md-related scope entirely and rewrite IDEA-180 to cover only the worklist-row purpose line, or (b) keep the idea as-is and you'll handle reconciling it separately? I don't want to guess at rewriting the idea's scope myself.
- [x] 2026-08-20 [chat] go with a
- [x] 2026-08-20 [chat] [agent] Got it — dropped the index.md scope, IDEA-180 now covers only the worklist-row purpose line.
