---
id: IDEA-120
title: Flow profiles — status derivation per project topology
type: feat
status: idea
created: 2026-08-04
tags:
  - status
  - planning-surface
subject: Planning surface
---

Generalizes [[IDEA-116]]. Status derivation currently assumes one team shape (branch → PR → merge). Solo-direct-on-main is equally legitimate — and hit in practice in the func-ui repo, where a finished idea could not reach review/done without hand-editing files.

Make the flow a per-project setting in `papercamp/config.json`, e.g. `flow: branch-pr | direct-main`, changing what signals derivation trusts: `branch-pr` keeps today's rules; `direct-main` respects explicit frontmatter promotion and/or main-branch commits referencing the idea id. A universal tool can't hardcode one team topology; this is the smallest knob that makes both real.
