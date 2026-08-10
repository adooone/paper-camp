---
id: IDEA-151
title: Manual commits become phase rows
type: feat
status: idea
created: 2026-08-10
tags:
  - app
  - plans
  - git
subject: App UI
---

The Deliver commit form sits as the Phases table's own footer
([[IDEA-146]]) — visually the same list, same card. A commit made there
should read as another row in that list, not a separate, invisible git
action.

1. **Committing from the Deliver form appends a phase entry.** The same
   `handleCommit` call that runs the commit also appends
   `{ done: true, text: <title, stripped>, source: 'manual' }` to the
   plan's `phases` array — written at the moment of commit, since that's
   the only point anything reliably knows "this wasn't an agent phase."
   No retroactive matching against git log, no new commit-SHA field —
   the fact is captured live, not reconstructed later.

2. **Title stripping.** The commit title's conventional-commit prefix
   (`type(scope):`) and its following space are stripped before it becomes the phase text — the
   inverse of `deriveSuggestedCommit`'s own `${kind}(${scope}): ${title}`
   assembly. `fix(app): Smaller toolbar button text` → `Smaller toolbar
   button text`.

3. **`source: 'manual'` reuses the existing badge mechanism.** `PhaseItem.source`
   already has `'review'`, rendered as a small stamp next to review-found
   phases. `'manual'` is a second value through the same code path, its
   own stamp label — no new rendering system.

4. **Scope: Deliver-form commits only.** A commit made from the terminal,
   outside the app, has no code path this can hook into and stays
   invisible to the phases list. Accepted as a known limit, not a gap to
   close — closing it would mean git-log scanning/reconciliation, which
   reintroduces exactly the fragility avoided by capturing the fact live
   instead of reconstructing it after.

### Thread
- [x] 2026-08-10 [decision] Persisted at commit time (appended to `phases` by the commit action itself), not derived/virtual rows computed from git log — the commit action already knows the fact with certainty; reconstructing it later would need a new commit-SHA field plus fuzzy title matching. Scoped to commits made through the Deliver form; terminal commits are an accepted, stated gap.
