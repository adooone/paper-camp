---
id: IDEA-117
title: Multi-project hub
type: feat
status: idea
created: 2026-08-04
tags:
  - multi-project
  - app
subject: Multi-project
---

Graduates Horizon 3's **Multi-project** bullet. One local hub app registers project folders (explicitly or by scanning for `papercamp/`), reads each corpus, and offers a project switcher — instead of N dev servers on N ports. The data stays per-repo in git: never centralize the corpus, centralize only the lens. Per-repo `paper-camp dev` remains for guests/CI; the hub is the daily driver.

What the switcher unlocks is cross-project views: everything-in-review across projects, all agent activity overnight, global idea search. Because the data is git, any machine that can pull reconstructs the whole desk.

Engineering note: the hub will meet corpora written by different paper-camp versions — the corpus format needs explicit versioning and tolerant parsing (pairs with the doctor, [[IDEA-121]]).

Companion captures: [[IDEA-118]] (decisions inbox), [[IDEA-123]] (cross-corpus links).
