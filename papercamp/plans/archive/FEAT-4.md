---
id: FEAT-4
title: Build Docs page
kind: feat
status: done
created: 2026-06-19
idea: IDEA-1
updated: 2026-06-19
tags:
  - app
  - docs
---

A new `/docs` route surfacing project documentation that's currently invisible in the
dashboard. The highest-value slice is UI work on top of an API surface that's already
built and tested but has zero consumers: `/api/decisions`, `/api/open-questions`, and
`/api/progress`. See ideas.md's "Project docs browser" for the full feature rationale.

### Phases
- [x] Add `/docs` route and sidebar
      Add a `/docs` route + nav entry to the bottom NavigationIsland, with a left sidebar matching `PlansSidebar`'s shape, grouped by source (Decisions, Open Questions, Progress, Repo Docs)
- [x] Render decisions log view
      Decisions log view — render `decisions.md` via the existing `/api/decisions`, with a `Stamp` for `decided`/`superseded`; a `superseded` entry links to its `Superseded-by` replacement
- [x] Render open questions view
      Open questions view — render `open-questions.md` via the existing `/api/open-questions`, with a `Stamp` for `open`/`resolved`; a `resolved` entry links to its `Resolved-by` decision
- [x] Cross-link resolved questions
      Cross-link resolved questions and their deciding decisions in both directions (click through either way)
- [x] Render progress timeline
      Progress timeline — render `progress.md` via the existing `/api/progress` as a reverse-chronological feed of dated entries
- [x] Add repo docs API and view
      Add a new `/api/docs` endpoint serving general repo-root markdown (`README.md`, `CHANGELOG.md`, `LICENSE`, any others found) and a read-only "Repo Docs" section rendering it
- [x] Add full-text docs search
      Full-text search across decisions, open questions, progress entries, and repo docs, jumping to the matching section
