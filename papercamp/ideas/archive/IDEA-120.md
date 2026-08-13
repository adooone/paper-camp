---
id: IDEA-120
title: Flow profiles
type: feat
status: dropped
created: 2026-08-04
updated: 2026-08-13
tags:
  - status
  - planning-surface
subject: Planning surface
---

Generalizes [[IDEA-116]]. Status derivation currently assumes one team shape (branch → PR → merge). Solo-direct-on-main is equally legitimate — and hit in practice in the func-ui repo, where a finished idea could not reach review/done without hand-editing files.

Make the flow a per-project setting in `papercamp/config.json`, e.g. `flow: branch-pr | direct-main`, changing what signals derivation trusts: `branch-pr` keeps today's rules; `direct-main` respects explicit frontmatter promotion and/or main-branch commits referencing the idea id. A universal tool can't hardcode one team topology; this is the smallest knob that makes both real.

### Thread
- [x] 2026-08-13 [decision] [agent] Dropped: [[IDEA-116]] (done) already delivers both signals this idea asked for — `deriveStatus` trusts a stored `review`/`done` when no PR exists (status.ts:42), and `resolveIdsWithMainActivity` (git-log.ts:39) derives in-progress/review from `Refs:` trailers on main, feeding `deriveStatus`'s `hasMainActivity` branch (status.ts:43-45). Only the `flow: branch-pr | direct-main` knob is unbuilt, and it would now be a regression — the current derivation serves both topologies at once, while this repo genuinely uses both (PRs for features, direct-to-main for bookkeeping).
