---
id: IDEA-202
title: Stop writes leaking the run-order rank
type: fix
status: review
created: 2026-08-21
updated: 2026-08-21
tags:
  - corpus
  - code-health
subject: The format as the product
---

`papercamp/run-order.md` is untracked on purpose. The `.gitignore` entry says why: the queue order is local, and a clone rebuilds membership but not the ordering. Every write to an idea currently contradicts that, persisting the local rank into tracked frontmatter.

`readEntities` overlays the run-order position onto each entry — `order: ranks.get(e.id) ?? e.order` — and `entityFileInput` then passes `entry.order` straight to the serializer. So any write path that reads an entity and writes it back stamps the reader's overlay into the file. Over twenty call sites do exactly that: every thread append, audit stamp, status change, fix promotion and prioritise annotation.

Two consequences, both observed. The rank reaches git even though the file it came from never does, so a clone inherits one machine's queue order as frontmatter. And because only the ideas a write touches get restamped, the values drift out of agreement with `run-order.md` immediately — a prioritise run that reorders three ideas leaves each carrying whatever rank it held at the moment it was annotated.

The overlay itself is right and should stay: `readRunOrderRanks` is explicit that the rank beats the frontmatter value, which its own comment calls stale and pre-migration. What is wrong is that a value derived for display survives into a write. The fix belongs at that boundary, not at the call sites, so no future write path has to remember.

### Phases
- [x] Keep the pre-overlay `order` on the entity
      Preserve the frontmatter value `readEntities` currently overwrites, so a writer can tell the stored field from the display rank.
      run: 1m11s · 5.9k in · 3.5k out · sonnet-5
- [x] Persist only the stored value
      `entityFileInput` writes the frontmatter `order`, never the overlaid rank; cover it with a test that reads an entity with a run-order rank and writes it back unchanged.
      run: 2m56s · 375 in · 4.8k out · sonnet-5
- [x] Strip ranks already written to the corpus
      Remove `order:` frontmatter that a previous write stamped in, leaving genuine stored values alone.
      run: 4m55s · 1.1k in · 9.9k out · sonnet-5

### Thread
- [x] 2026-08-21 [log] [agent] Tiny corpus-integrity fix touching write paths every other idea's phases will exercise, so it should land before more writes accumulate the same leak.
