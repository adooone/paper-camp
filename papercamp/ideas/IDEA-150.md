---
id: IDEA-150
title: Route plans and ideas by id
type: refactor
status: idea
created: 2026-08-10
updated: 2026-08-11
tags:
  - app
  - routing
subject: App UI
order: 4
---

Plan and idea URLs are unreadable — `/plans/Deliver%20lives%20in%20the%20idea%20view`
— because the route params `$planId`/`$ideaId` are misnomers: both decode as
the entity's full title, URL-encoded. Title was picked as the routing key
because `PlanEntry.id` is typed optional (`id?: string`), but every file in
the live corpus already carries an `id:` — the safety net costs readability
for a case that no longer happens.

1. **Routes become the numeric id**: `/plans/146`, `/ideas/146`. Lookup
   switches from title-match to id-match in `useActivePlanTitle` /
   `useActiveIdeaTitle` (renamed to reflect what they resolve).

2. **Title stays as a fallback**, not a parallel system: an id-less entry
   (the rare/legacy case the optional type allows for) still routes by
   title exactly as today, so nothing that currently works stops working.

3. **Every call site updates**: the 8 places building links from
   `encodeURIComponent(title)` — inbox, Plans page, Roadmap, Deliver, and
   both idea-creation modals — switch to passing the id (falling back to
   title when absent).

4. **Old title-URLs are not redirected.** Bookmarks/links captured before
   this ships will 404; this is a single-user dev tool, not a public site,
   so a redirect table isn't worth the complexity.

### Phases
- [x] Resolve routes by id in the two hooks
      Switch `useActivePlanTitle`/`useActiveIdeaTitle` from title-match to id-match, keep title as the id-less fallback, and rename them to reflect what they resolve.
      run: 7m43s · 6.4k in · 18.3k out · sonnet-5
- [x] Emit id in every link builder
      Update the 8 call sites — inbox, Plans page, Roadmap, Deliver, both idea-creation modals — to pass the id, falling back to `encodeURIComponent(title)` only when id is absent.
      run: 4m50s · 934 in · 15.3k out · sonnet-5
- [x] Verify id-less entries still route by title
      Confirm a legacy entry with no `id:` resolves through the fallback exactly as before.
      run: 3m3s · 379 in · 5.2k out · sonnet-5
- [ ] Run quality and type checks
- [ ] Strip ID prefix from route params
      Routes use the bare numeric id (/plans/150, /ideas/150) instead of the full id string (IDEA-150) — update the two resolver hooks to match on the numeric part, and update every link builder to emit the bare number instead of the prefixed id.

### Thread
- [x] 2026-08-10 [decision] Id is the primary route key, title the fallback only for id-less entries — not a dual always-both scheme. No legacy-URL redirect.
- [x] 2026-08-11 [chat] I want the route to be simpler /plans/:id - like this - host/plans/150
- [x] 2026-08-11 [chat] [agent] Got it — id is primary, title only fills in when there's no id, no dual-write and no redirect table for old URLs. That matches phase 1's routing logic already in place.
- [x] 2026-08-11 [chat] what title, currently we have plans/IDEA-150 - what I want is /plans/150 (without IDEA!!!)
- [x] 2026-08-11 [chat] [agent] Got it — numeric only, so /plans/150 not /plans/IDEA-150. That's a change to the routing already built in phases 1-3, so I've added it as a new phase to strip the prefix in both the route params and the link builders.
