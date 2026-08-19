---
id: IDEA-179
title: Prioritise lies about what it did
type: fix
status: idea
created: 2026-08-14
updated: 2026-08-14
tags:
  - app
  - server
  - plans
subject: Planning surface
---

"Prioritise queue" reports failure for work it already did, and when it fails
for real it names the wrong cause. Three defects in one flow.

### A partial apply keeps the reorder and reports failure

`applyPrioritiseVerdict` writes in two phases and only the second can fail:

```js
const moved = await withRunOrderLock(async () => {
  if (moved.length > 0) await writeRunOrderFile(root, reconciled);   // phase 1 — the job
  return moved;
});
if (moved.length === 0) return [];

for (const id of moved) {                                            // phase 2 — annotations
  try { await writeEntityFile(…) }
  catch (err) {
    await regenerateIndexes(root);
    throw new Error(`Prioritise partially applied (${applied.length}/${moved.length} …)`);
  }
}
```

`run-order.md` is written first and never rolled back, so a failure appending
the `why` thread message to any one idea returns 400 with the queue already
reordered on disk. The route's catch turns that into
`{ error }`, `prioritiseQueue` throws on `!response.ok`, and
`handlePrioritise` shows **"Failed to prioritise"**. Reported as a no-op;
actually applied.

The thrown message does say "partially applied", and the toast passes it as the
description — but the red title dominates and reads as total failure.

Phase 2 is bookkeeping on top of a completed reorder. A failure there is not a
failed prioritise. Either roll the run-order write back so the operation is
atomic, or return `200` with a partial result the UI reports honestly — *"Queue
reordered; 2 of 5 ideas could not be annotated"*. Do not report the reorder as
not having happened.

### One message for four different failures

`validatePrioritiseVerdict` returns `undefined` for four causes, and
`getPrioritiseVerdict` collapses all of them into
`"Agent verdict did not include every active id exactly once"`:

1. malformed JSON, or `order` not an array / `why` not a string
2. `order.length !== activeIds.length`
3. duplicate ids, or ids outside the active set
4. `whyLines.length !== order.length`

Only 2 and 3 are about ids. Cause 4 requires exactly one non-blank line in `why`
per ordered id — with 14 entries in the queue the model must emit precisely 14
non-empty lines, which is the most fragile part of the contract and the likeliest
to break. When it does, the error sends the reader hunting for a missing id that
was never missing.

Reproduced live on 2026-08-14: `POST /api/ideas/prioritise` → 400 with that
message, `run-order.md` byte-identical before and after (verified by checksum),
and the active set healthy — 14 entities, all `planned`, exactly matching the
queue. The ids were fine; the shape was not.

Give each cause its own message, and name the offending id or line count.

### No retry, so a formatting slip costs the whole run

A malformed verdict throws immediately. One stray blank line in `why` wastes an
entire agent call. Retry once with the validation failure fed back to the agent
before giving up — the same shape the fix-review and pr-review paths already
need for their own verdict parsing.

Relaxing the contract is the cheaper half: accept a `why` whose line count does
not match by falling back to a generic reason per id, rather than rejecting an
otherwise-valid ordering over its prose.

### Also

`handlePrioritise`'s catch does not refresh, so in the partial-apply case the UI
keeps showing the old order after the file changed — the reorder appears to have
been rejected until something else triggers a reload.

### Out of scope

What the prioritise agent weighs, and the run-order classification itself.

### Phases
- [x] Report a partial apply honestly
      Return 200 with a partial result (reorder done, N ideas un-annotated) instead of 400, or make the run-order write roll back on annotation failure.
      run: 4m17s · 6.3k in · 13.5k out · sonnet-5
- [x] Give each validation cause its own message
      Split the four `validatePrioritiseVerdict` failures into distinct messages that name the offending id or line count.
      run: 2m49s · 235 in · 7.4k out · sonnet-5
- [ ] Relax the `why` line-count contract
      Accept an otherwise-valid ordering whose `why` line count mismatches by falling back to a generic per-id reason.
- [ ] Retry the agent once on a malformed verdict
      Feed the validation failure back to the agent for one retry before giving up, matching the fix-review and pr-review paths.
- [ ] Refresh the UI after a partial apply
      Have `handlePrioritise`'s catch reload so the new order shows instead of the stale one.
