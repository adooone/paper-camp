---
id: IDEA-180
title: Say what each idea is for
type: feat
status: idea
created: 2026-08-14
updated: 2026-08-14
tags:
  - app
  - plans
  - format
subject: Planning surface
---

`papercamp/ideas/index.md` carries id, title, type, status and tags. Scanning it
tells you what things are *called*, never what you *get*. With a dozen-plus open
ideas that is the difference between a plan and a pile.

A 40-character title cannot carry the weight on its own. "One source of truth
for checks" — which checks, and what breaks today? "Git status vocabulary and
chrome" — vocabulary for what? The titles are correct and still opaque, and the
title-style rule ([[IDEA-143]]) rightly forbids fixing this by making them
longer.

### A generated purpose line

Every entity gets a one-line "what you get", rendered in `index.md` beside the
existing columns and in the worklist row under the title.

**Derived, not authored.** The source is the idea's own opening sentence — the
first sentence of the body, trimmed to a line. Every idea already opens by
stating the problem, so the data exists and costs nothing to maintain. A new
frontmatter field would be one more thing to keep honest, and the first thing to
go stale.

An entity whose opening sentence makes a poor summary is an entity whose body
buries its point. Surfacing it is the pressure that fixes the body — the same
argument [[IDEA-143]] made for titles.

**Regenerated with the index.** `regenerateIndexes` already rewrites `index.md`
on every corpus write, so the line refreshes whenever the body changes. Nothing
new to invalidate.

### The worklist too

The Plans list shows title, id stamp, status, dates, tags and a progress bar —
everything except what the idea is for. The same derived line goes under the
title, dimmed, single-line with ellipsis. That is where the scanning actually
happens; `index.md` is the file-level mirror of it.

### Out of scope

Any new frontmatter field. Summarising with an agent — the opening sentence is
already the author's own summary, and an agent pass would cost a run per idea to
restate what is written. Changing the title rules ([[IDEA-143]] stands).
