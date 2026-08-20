---
id: IDEA-192
title: An Issues page you can act on
type: feat
status: review
created: 2026-08-19
updated: 2026-08-20
tags:
  - app
  - agent
  - git
  - ux
subject: Run & monitor
---

Everything that failed collects in one place, reads as a short conversation,
and is fixed from there.

### Failures have nowhere to live

A failure today is visible only where it happened, and only if you were
watching:

- **A failed agent run** ends as `outcome: error` in `tasks.log`. The Stack
  panel shows the card while it is recent; after that the only trace is the
  task log page.
- **A red project check** shows as a chip in the Desk section. The chip says
  which check went red, never why.
- **A PR review requesting changes** lands in the idea's own thread, so it is
  found only by opening that idea.
- **A git rebase or sync failure** raises `RebaseConflictError` with its
  conflicted files, or returns `stage: 'conflicted'`, and surfaces as a toast
  that is gone the moment it is dismissed.

Four kinds of failure, four unrelated surfaces, none of which survives being
looked away from. There is no answer to "what is broken right now".

### Issues takes the nav slot Tasks holds

`Tasks` leaves the navigation and `Issues` takes its place. The task log is not
lost — it is reached from the Stack panel's Agent section, which is where a
running agent is already watched, and its "N more…" link already goes there.
Navigation is for what needs attention, and a log of successful runs does not.

The four sources above feed it. Parked questions do not: they already have the
Inbox and are a question rather than a failure.

### It reads like the Inbox, because that shape works

The Inbox's expandable rows are the model — a compact row per item, oldest
first, opening in place rather than navigating away. An issue opens into a
short message thread: what failed, the reason, the last output lines, and the
replies as it is worked.

The Inbox stays exactly as it is, at the bell. The two surfaces divide by verb:
the Inbox is activity you **read** — a run finished, an agent replied, a
question is waiting. Issues is failure you **act on**. Nothing appears in both.

### Two ways out of an issue

**Fix it here.** An issue carries enough context to launch a fix agent against
it directly, the way a red check already can. The thread records the attempt and
its result, so a second failure of the same thing reads as a continuation rather
than a fresh mystery.

**Promote it to a fix entity.** A failure worth planning becomes a fix entity as
defined by [[IDEA-187]] — its own id, file, branch and PR, linked to the idea it
fixes. The issue then points at that entity and stops carrying the work itself.

An issue closes when the thing it describes stops failing: the check goes green,
the rerun succeeds, the promoted fix ships. Closure is derived from the world,
never a button that marks it read.

### Depends on IDEA-187

[[IDEA-187]] ships first. Promotion creates a real fix entity from the start
rather than raising an ordinary idea and migrating later, so the model is right
on the first pass.

### Out of scope

Any change to the Inbox. The task log page itself, which keeps its route and its
current shape. Notifications for issues — the page is pulled, not pushed.

### Phases
- [x] Define the issue model and its four collectors
      One issue shape fed by failed agent runs, red checks, PR change-requests, and rebase/sync failures — deduped by source so a repeat failure continues an existing issue.
      run: 7m10s · 11.1k in · 27.2k out · sonnet-5
- [x] Derive open/closed state from the world
      Close an issue when its check goes green, its rerun succeeds, or its promoted fix ships; never a mark-read button.
      run: 4m56s · 4.3k in · 15.4k out · sonnet-5
- [x] Swap the nav slot: Issues in, Tasks out
      Move the task log behind the Stack panel's Agent section and its "N more…" link; keep the log route and shape unchanged.
      run: 3m16s · 5.3k in · 9.4k out · sonnet-5
- [x] Build the Issues page as expandable Inbox-shaped rows
      Compact row per issue, oldest first, opening in place into a thread of what failed, the reason, and the last output lines.
      run: 9m25s · 16.8k in · 32.6k out · sonnet-5
- [x] Add "fix it here" to launch a fix agent from an issue
      Carry the issue's context into the agent and record the attempt and result back in the thread.
      run: 21m30s · 14.2k in · 70.9k out · sonnet-5
- [x] Add "promote to a fix entity" per [[IDEA-187]]
      Create the fix entity, point the issue at it, and stop the issue carrying the work.
      run: 14m30s · 11.5k in · 60.6k out · sonnet-5
- [x] [manual] Add promote-to-fix flow for issues
- [x] [manual] Fix issue promotion entity lookup and spawn kind

### Thread
- [x] 2026-08-20 [question] [agent] Run-all parked on phase 6 ("Add "promote to a fix entity" per [[IDEA-187]]") — the agent needs a decision: "Promote to a fix entity" runs into two unresolved gaps I can't safely guess past:
- [x] 2026-08-20 [question] [agent] Run-all parked on phase 6 ("Add "promote to a fix entity" per [[IDEA-187]]") — the agent needs a decision: Phase 6 ("Add promote to a fix entity") hits two unresolved gaps from the prior parked run's thread note on IDEA-192: (1) Issues have no persistence today — `Issue.promotedFixId` exists on the type but nothing stores an issue's state between loads (phases 4–5 deliberately reused `tasks.log`/live derivation instead of a real store). Should I build a persisted issues store now, or should the promoted-fix link live elsewhere (e.g. stamped on the fix entity itself, discovered by scanning fix entities for a backlink) instead of on the issue? (2) IDEA-187's boundary rule only allows `kind: fix` to spawn from a done/archived parent, but most issues come from open work (a check failing now, an agent run failing mid-plan, a PR under review) or have no parent idea at all. Should "Promote" only appear when the issue's entity happens to be closed (narrow), fall back to a plain `kind: idea` when there's no closed parent, or should IDEA-187's boundary rule be relaxed to allow `kind: fix` with no parent or an open parent?
- [x] 2026-08-20 [question] [agent] Run-all parked on phase 6 ("Add "promote to a fix entity" per [[IDEA-187]]") — the agent needs a decision: Phase 6 ("promote to a fix entity") has two unresolved gaps a prior parked run already flagged in IDEA-192's thread, and neither has been answered since:
- [x] 2026-08-20 [clarification] No issues store. Issues stay entirely derived — a store means reconciling derived state against stored state forever, and it invites the "mark read" closure this idea rules out. `sourceKind` + `sourceKey` is already documented as stable, so stamp that pair on the fix entity (a file, in git) and match derived issues against fix entities. The link survives reload because git holds it, and the scan rides on the entity read the corpus already does.
- [x] 2026-08-20 [clarification] [[IDEA-187]]'s boundary rule is not relaxed and does not change. It routes idea follow-ups by status, and an issue with no parent is simply outside its scope. Promote routes by what the issue points at: a closed or archived parent spawns a fix entity (187's case); an open parent appends to that idea's inline `### Fixes` (187's other branch); an issue with no parent becomes a plain `kind: idea`. Every issue has a destination and nothing is bent.
- [x] 2026-08-20 [clarification] Because Promote's behaviour now varies by target, the control must name what it will do — "Promote to fix", "Add to IDEA-N's fixes", or "Promote to idea" — rather than reading as one generic action.
- [x] 2026-08-20 [review] [agent] Requests changes · 4 findings — The bulk of the feature is here and well-tested at the core level, but two spec requirements aren't actually delivered end-to-end: the fourth collector (rebase/sync failures) is written and tested yet never wired into the page, and the no-parent promotion path types the spawned entity as a fix rather than the plain idea the settled decision calls for. There is also a client/server corpus mismatch in how the parent entity is resolved that can mislabel Promote and break the issue↔fix link on reload.
