---
id: IDEA-178
title: Rate limits must not rewrite status
type: fix
status: idea
created: 2026-08-14
updated: 2026-08-15
tags:
  - core
  - github
  - plans
subject: Planning surface
---

When PR state cannot be resolved, every entity's status silently becomes a guess
and the UI presents the guess as fact.

[[IDEA-181]] removes the automatic fetching that produced today's outages, but it
does not remove this path: a manual refresh can still fail, and a cold start
before the persisted map loads has no PR state at all. What has to change is how
the app behaves when it has no answer.

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

### Archive location is a closed signal

`readers.ts` already stamps `archived` on every entity, and `ArchivabilityInput`
already carries it — but `StatusDerivationInput`, the type `deriveStatus`
actually takes, does not. Add it, and return `done` for an archived entity
(unless a stored `dropped` overrides). An entity in `archive/` is closed by
definition; nothing about GitHub being unreachable makes it `planned` again.

This alone would have kept 40/41/55 out of the worklist and the queue.

### Never cache a degraded read

`resolvePrsByEntity` is careful — it caches only a successful resolution. But the
corpus cache in `corpus-cache.ts`, which fronts `/api/plans`, `/api/ideas` and
`/api/archivable-ideas`, has **no TTL at all**: it stores a resolved promise and
serves it until something calls `invalidateCorpusCache()`.

So the guessed statuses computed during the outage were still being served four
minutes after the quota came back, with `gh pr list` answering correctly in
under a second the whole time. They cleared only when a corpus write forced an
invalidation. A transient failure produced a wrong worklist that outlived it and
would have persisted indefinitely on an idle desk.

Refuse to cache a result computed while `prLookupResolved` was false. A read that
could not resolve PR state is not a result worth keeping — and under
[[IDEA-181]], where refresh is on demand, a cached wrong answer lives until the
human happens to ask again.

### Say when the column is a guess

When status is running on a fallback the UI must say so, rather than presenting
guesses as derived truth. The worklist's status column and the run-order queue
are both affected, and today nothing distinguishes "derived from a merged PR"
from "GitHub was unreachable, so this is a phase-count guess".

This matters more under on-demand fetching, not less: a degraded read now
persists until someone refreshes, so it has to be visible while it lasts.

### Moved out

Backing off the poll on low quota, and degrading to the last good PR map, both
belong to [[IDEA-181]] — the first because there is no longer a schedule to back
off from, the second because a persisted map that is only replaced on a
successful fetch *is* the last-good-answer behaviour.

### Out of scope

The review trigger's gates ([[IDEA-170]]) and the reviewed-SHA ledger
([[IDEA-173]]).

### Phases
- [x] Treat archive location as closed in status derivation
      Carry `archived` into `StatusDerivationInput` and return `done` for an archived entity unless a stored `dropped` overrides.
      run: 2m51s · 5.9k in · 3.3k out · sonnet-5
- [x] Stop caching degraded reads
      Refuse to store a corpus-cache result computed while `prLookupResolved` was false, so a transient failure cannot outlive itself.
      run: 4m24s · 796 in · 11.4k out · sonnet-5
- [ ] Surface fallback status in the UI
      Mark the worklist status column and run-order queue when a status is a guess rather than derived from resolved PR state.
