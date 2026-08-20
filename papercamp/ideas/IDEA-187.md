---
id: IDEA-187
title: Fixes are their own entity
type: feat
status: idea
created: 2026-08-17
updated: 2026-08-17
tags:
  - format
  - plans
  - app
subject: The format as the product
---

A follow-up to a shipped idea becomes its own entity, linked to the idea it
fixes. Done ideas stay done and stay archived.

### Reopening is the wrong mechanism

Four ideas were reopened this way in a single day — [[IDEA-158]], [[IDEA-162]],
[[IDEA-174]], [[IDEA-181]] — by appending to `### Fixes` and setting status back
to `in-progress`. Every one of them hit the same three problems:

- **Archived files strand.** The app sets the status but never moves the file
  out of `ideas/archive/`, so the entity sits active in the archive directory.
  Doctor flags it (`status "in-progress" is active but the file is under
  ideas/archive/`) and it takes a manual `git mv` to fix. IDEA-162 hit this;
  IDEA-181 dodged it only by not having been archived yet.
- **`done` gets credited to the wrong PR.** A reopened idea re-derives `done`
  from its *original* merged PR the moment the fix is checked. IDEA-162 showed
  `done` off PR #159, which merged before the fix existed — so the status could
  not distinguish "the fix shipped through review" from "the fix never shipped".
- **History is overwritten.** The idea's own record now describes work that
  happened after it closed, mixed into the phases that shipped it.

### A fix is an entity

`kind` gains a third value beside `idea` and `note`. A fix has its own lifetime
`IDEA-N` id, its own file, its own branch and PR, and archives when it closes —
everything ships and closes exactly once.

The parent link is the `idea:` field that **already exists in the schema**
(`'IDEA-N backlink if this plan grew out of an idea'`) and that no entity
currently uses. It stops being decorative and becomes the thing that makes a fix
a fix.

`type` is untouched: it keeps meaning feat/fix/chore/docs/refactor for commits,
which is why a fix entity is a `kind`, not a `type`. A `kind: fix` entity is
usually `type: fix` but does not have to be — a follow-up can be a `refactor`.

**Minimal by construction.** Body plus a short phase list — one to three, the
size of a follow-up. No separate status axis: it derives like any other entity
from its own phases and its own PR.

### Where it appears

**In the worklist**, a fix groups under **its parent's subject**, not a
Maintenance bucket — a fix to a Run & monitor idea belongs with Run & monitor
work, so an area's whole state reads in one place. It renders as a distinct,
minimal row: parent id visible, fewer columns than a plan row, its own marker.
It is not nested under the parent, because the parent is closed and no longer in
the list.

No new roadmap item is needed. Subject is inherited from the parent rather than
stored, so a fix cannot drift from the thing it fixes.

**In the parent's view**, a Fixes list of every linked fix entity with its
status — the parent stays archived and read-only, but it knows what came after
it.

**In the fix's own view**, its parent idea, linked, so the context that produced
it is one click away.

### The boundary rule

An **open** idea keeps its inline `### Fixes` list. That works well today —
IDEA-158 and IDEA-174 both used it — and a one-line correction mid-run should
not cost an id, a file and a PR.

A **done or archived** idea spawns a linked fix entity instead. The idea's
status at the moment the fix is raised decides which mechanism applies, so there
is never a judgement call.

Reopening a closed idea stops being something the UI offers.

### Relationship to [[IDEA-185]]

That idea deletes `IdeaGroupRowCard`, the `childrenByIdea`/`orphanPlans`
partition and the collapse machinery as unreachable. It still stands: a fix
renders as its own row, not as a nested child card, so none of that rendering
comes back.

But its evidence — "zero entities carry the `idea:` field" — stops being true
once this ships. The **field itself must survive** IDEA-185's deletion; only the
parent/child *rendering* goes. Run 185 first, with that carve-out explicit.

### Out of scope

Migrating the four already-reopened ideas — they shipped, and rewriting their
history buys nothing. Fixes on notes, which never carry plans. Any change to how
`type` is used.

### Phases
- [x] Keep the `idea:` parent field alive through IDEA-185
      185's group-machinery deletion removes only the nested parent/child rendering, not the `idea:` field itself.
      run: 1m27s · 5.7k in · 5.7k out · sonnet-5
- [x] Add `fix` to the `kind` enum
      Extend `entityFrontmatterSchema` so a fix derives status from its own phases and PR, and refine that `kind: fix` requires an `idea:` link to a done/archived parent.
      run: 7m18s · 813 in · 17.4k out · sonnet-5
- [x] Spawn a fix entity from a closed idea instead of reopening
      A done/archived idea raises a new `IDEA-N` fix file with its parent link and a short 1–3 phase list; drop the reopen action from the UI.
      run: 13m20s · 14.2k in · 50.1k out · sonnet-5
- [x] Enforce the boundary rule by parent status
      Open ideas keep the inline `### Fixes` list; only done/archived ideas can spawn a fix entity, decided by status so there is no judgement call.
      run: 9m19s · 14.1k in · 27.9k out · sonnet-5
- [ ] Render fixes as their own worklist row
      A distinct minimal row grouped under the parent's inherited subject, parent id and its own marker visible, not nested under the closed parent.
- [ ] Cross-link fix and parent in their detail views
      The parent view lists every linked fix with its status; the fix view links back to its parent idea.
