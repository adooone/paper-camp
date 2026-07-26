---
id: IDEA-98
title: Track run order in one file
type: refactor
status: idea
created: 2026-07-26
tags:
  - core
  - plans
  - git
order: 13
---

Run order lives in each entity's frontmatter as `order: N`, so reordering is inherently a
multi-file write: the sequence is contiguous 1..N, and moving one item renumbers everything
after it. Commit `a15d9ab` changed 13 idea files with 13 `order:` lines and nothing else —
a merge diff that says "13 files changed" while carrying no actual information. `f598efd`
did the same across 9 files.

The cost is not only noise. Because every entity file is a write target for a global
property, ordinary work collides on it:

- **Merge conflicts multiply.** Two branches that each shift the queue conflict in N files
  instead of one. Sync to main failed on 2026-07-25 partly because the corpus watcher had
  rewritten `order:` in `IDEA-83.md`, and the incoming commit touched the same line.
- **The working tree is never clean.** The watcher's normalization pass rewrites `order:`
  across many files whenever derived status changes, so the repo sits permanently dirty and
  every stash/branch-switch has to negotiate it.
- **Reviewing a real change is harder** when a PR's file count is dominated by renumbering.

Move the sequence to a single ordered list — one file, first line runs first, one entity per
line. A reorder becomes a one-file diff whose every line is meaningful; the `prioritise`
agent's verdict (`{"order": [...]}`) maps onto it directly instead of being fanned out across
the corpus; entity files stop churning, which takes the pressure off sync, stash and branch
switching. Conflicts still exist but collapse to one short list that is trivial to resolve by
hand, instead of N frontmatter hunks.

The reconciliation logic mostly survives: `normalizeRunOrder` already computes the contiguous
sequence and drops entities that are not in an ordered status — it changes from writing N
frontmatter fields to writing one list, and gains the job of reconciling the list against the
live corpus (entities added, archived, or deleted out of band). Keep the serialization
`f598efd` added for concurrent run-order passes; a single file makes the write hotspot
sharper, not softer.

Timing favours doing it soon: only 12 entities carry `order:` today, so the migration is a
one-time strip plus one generated list.

Resolved (see decisions.md, "Run order lives in `papercamp/run-order.md`, one
`IDEA-N — Title` line per entity"): the file is `papercamp/run-order.md`, alongside
`decisions.md`/`open-questions.md`/`progress.md` rather than under `ideas/` or `plans/`;
each line is `IDEA-N — Title` (id + title, not id alone) for a readable diff, accepting
the title is a refreshed copy; and it is intent, not generated output, so a later phase
must keep it out of sync's disposable-changes check ([[IDEA-94]]) the way `ideas/index.md`
is silently discarded.

### Phases
- [x] Settle the file's shape, name, and location
      Resolve the open questions: ids alone vs id + title (lean id + title for a
      readable diff, accepting the title is a refreshed copy), where the file lives
      and what it is called, and confirm it is intent — never generated output.
- [x] Add a run-order file module in `src/core`
      Parse and serialize the ordered list (one entity per line, first line runs
      first), sitting alongside `run-order.ts` as the single source of the sequence.
- [x] Reconcile the list against the live corpus in `normalizeRunOrder`
      Reshape `normalizeRunOrder` (`src/core/run-order.ts`) to read the list, drop
      ids no longer in an ordered status or gone from the corpus, append entities
      added out of band, and return one list to write instead of N frontmatter changes.
- [x] Route every write path through the list
      Point the plans PATCH route (`routes/content/plans.ts`), `run-order-pass.ts`,
      and `applyPrioritiseVerdict` (`prioritise.ts`) at the list, stop writing
      `order:` to entity frontmatter, and keep `f598efd`'s serialization guarding
      the now-sharper single-file write hotspot.
- [x] Feed the list into reads and display
      Have `readEntities`/`readWorkEntries` resolve each entity's rank from the list
      so the worklist sort (`plan-list-selector.ts`) and the drag/order control keep
      working once `order:` leaves the frontmatter.
- [x] Migrate: strip `order:` and generate the initial list
      One-time pass over the ~12 entities carrying `order:` — remove the field from
      frontmatter and emit the list in the current sequence.
- [x] Treat the file as precious in sync's disposable-changes check
      Ensure the deterministic sync ([[IDEA-94]], `dropDisposableLocalChanges` in
      `git.ts`) never silently discards the list the way it does `ideas/index.md`.
- [ ] Type-check and full pass
      `pnpm run check-types`, `npx biome check .`, and `pnpm test` clean across the repo.
