---
id: IDEA-178
title: Rate limits must not rewrite status
type: fix
status: idea
created: 2026-08-14
updated: 2026-08-14
tags:
  - core
  - github
  - plans
subject: Planning surface
---

When the GitHub GraphQL quota runs out, `resolvePrsByEntity` returns nothing,
`prLookupResolved` goes false, and every entity's status silently becomes a
guess. Merged work regresses, closed work reopens, and the UI presents both as
fact.

### What it looked like (2026-08-14)

GraphQL quota hit zero. Without any change to the corpus:

- **IDEA-175** — PR merged, 6/6 phases — regressed from `done` to `review`. Its
  stored `status: review` was the fallback, so it read as still-pending work.
- **IDEA-40, 41, 55** — closed and archived long ago, no stored `status:` after
  the [[IDEA-56]] migration — surfaced as `planned`, re-entered the open
  worklist, and were written into `run-order.md` as queued work.

The rung responsible:

```js
if (!prLookupResolved) {
  // GitHub unreachable — trust the stored override, else a phases-only guess.
  return entity.status ?? (entity.phases.length > 0 ? 'planned' : 'idea');
}
```

It returns before the `hasMainActivity` check, so the `Refs: IDEA-40` trailers
that exist on `main` never get a chance to help.

The danger is not the wrong label. It is that an archived, finished idea sitting
in `run-order.md` is a candidate for run-all or draft-all — re-executing work
that shipped months ago, which is [[IDEA-171]]'s failure with a different
trigger.

### The degraded answer is sticky, and that is the worse half

`resolvePrsByEntity` is careful here — it caches only a successful resolution,
so a failed lookup is retried on the next read. But the corpus cache in
`corpus-cache.ts`, which fronts `/api/plans`, `/api/ideas` and
`/api/archivable-ideas`, has **no TTL at all**: it stores a resolved promise and
serves it until something calls `invalidateCorpusCache()`.

So the guessed statuses computed during the outage were still being served four
minutes after the quota came back, with `gh pr list` answering correctly in
under a second the whole time. They only cleared when a corpus write forced an
invalidation. A transient limit produced a wrong worklist that outlived it and
would have persisted indefinitely on an idle desk.

The poller is supposed to catch this — it compares fresh PR state against the
cached entries and invalidates on a difference — but it evidently did not fire
here. Whatever the reason, the cache must not be able to hold a degraded read
forever: give it a TTL, or refuse to cache a result computed while
`prLookupResolved` was false.

That second option is the tighter one. A read that could not resolve PR state is
not a result worth keeping.

### Archive location is a closed signal

`readers.ts` already stamps `archived` on every entity, and `ArchivabilityInput`
already carries it — but `StatusDerivationInput`, the type `deriveStatus`
actually takes, does not. Add it, and return `done` for an archived entity
(unless a stored `dropped` overrides). An entity in `archive/` is closed by
definition; nothing about GitHub being unreachable makes it `planned` again.

This alone would have kept 40/41/55 out of the worklist and the queue.

### Degrade to the last good answer, not to nothing

`resolvePrsByEntity` is already cached. On a failed lookup it discards that
cache and reports "unresolved". Serve the **last known PR map** instead, marked
stale. A merged PR does not un-merge; yesterday's answer is far better than a
phases-only guess, and IDEA-175 would have stayed `done`.

Keep the hard-unresolved path only for a cold start with no cache at all.

### Say when the column is a guess

When status is running on a fallback, the UI must say so rather than presenting
guesses as derived truth — the worklist's status column and the run-order queue
are both affected. Today nothing distinguishes "this is derived from a merged
PR" from "GitHub is unreachable and this is a guess from phase counts".

### Spend less quota

The PR poll runs every 60 seconds and `enrichWithReviewSignal` adds a GraphQL
call per open PR, on top of the review trigger's own lookups. That is what
drained the quota. Back off when the remaining budget is low (the rate-limit
headers are already in every response), and widen the poll interval when no PR
is open.

### Out of scope

The review trigger's gates ([[IDEA-170]]) and the reviewed-SHA ledger
([[IDEA-173]]).
