---
id: IDEA-1
title: Project docs browser
---

### IDEA-1: Project docs browser

A Docs page that aggregates all project documentation into a browsable, searchable view inside the dashboard, so the project's full narrative — structure, conventions, decisions — is one click away instead of scattered across the terminal and editor. The papercamp/ folder is the living memory; the Docs page is the reference library built on top of it.

The most concrete, lowest-effort slice of this already half-exists: `parseDecisions` and `parseOpenQuestions` (`src/core/parser.ts`) and the `/api/decisions`/`/api/open-questions`/`/api/progress` routes (`src/app/server/api.ts`) are fully built and tested, but no page in the dashboard fetches them — they're dead endpoints right now. A Docs page is the natural home for the UI that's been missing all along.

Feature ideas, roughly in build order:

- **Decisions log view** — render `decisions.md` as a real list of ADRs: title, `Stamp` for `decided`/`superseded`, date, and the prose body (Context/Decision/Rationale). A `superseded` entry links forward to whatever replaced it via `Superseded-by`.
- **Open questions view** — render `open-questions.md` the same way: `Stamp` for `open`/`resolved`, and a `resolved`-entry links to the `decisions.md` entry that answered it via `Resolved-by`. Open questions are the most actionable thing in `papercamp/` that currently has zero visibility outside the raw file.
- **Cross-linking between the two** — since a decision's "Resolved-by" and a question's "Resolved-by" already reference each other by title, turn those into real in-app links (click a resolved question, land on the deciding decision, and vice versa) instead of just rendering the prose.
- **Progress timeline** — a simple reverse-chronological feed of `progress.md`'s `## YYYY-MM-DD` sections. Could stand alone, or merge with decision dates into one combined "project history" feed.
- **Repo docs section** — a second grouping, separate from the structured `papercamp/` records above, for the general markdown floating around the repo root (`README.md`, `CHANGELOG.md`, `LICENSE`) and any others that show up later (e.g. a `docs/` folder, `CONTRIBUTING.md`). Plain markdown rendering, no parsing into fields — same "read-only, no schema" treatment `ideas.md` already gets.
- **Search** — one search box, full-text across everything above (decisions, open questions, progress entries, repo docs), jumping straight to the matching section.
- **Navigation** — a left sidebar grouped by source ("Decisions", "Open Questions", "Progress", "Repo Docs"), same shape as the existing `PlansSidebar`.

Why this one first: the backend is already done and tested. This is UI work on top of an existing, working API surface, not a new subsystem.
