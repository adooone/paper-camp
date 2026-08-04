---
id: IDEA-124
title: Tie ideas to releases — release notes grouped by idea
type: feat
status: idea
created: 2026-08-04
tags:
  - status
  - releases
---

The release train already knows which commits shipped in a version; the corpus knows which idea each branch/commit served. Join them: each release lists the ideas it shipped, and each done idea records the version that carried it (`released: v0.13.1` in frontmatter or a log line at promotion time).

Two payoffs: release notes grouped by idea (human-readable by construction, better than raw conventional-commit changelogs), and the archive gains an audit trail from idea → code → published version. Complements Horizon 2's **Richer review loop** — the idea's story gets its final chapter.
