---
id: IDEA-70
title: Subjects and idea-detail polish
type: feat
status: idea
created: 2026-07-17
tags:
  - app
  - plans
  - ideas
  - settings
  - ui
---

Three improvements to the ideas surface: the page finally calls things what they are, ideas get an epic-like grouping entity, and the detail view gets its two sore spots fixed.

**Naming the grouping entity: "Subject".** The Jira analogue is an epic, but this app's metaphor is paper, notebooks, and school desks — and the school word for a long-running grouping is a *subject*. It reads naturally everywhere it appears ("group by subject", "No subject", a subject picker) and stays one plain word. Considered and passed over: *Epic* (imports Jira's ceremony), *Theme*/*Track* (vaguer, no tie to the metaphor). Subjects are a small predefined list managed in Settings, not free-form per-idea tags — that's what keeps them a grouping and not a second tag system.

- **Rename the Plans page to Ideas.** `plans-header.tsx`'s title and the nav label say "Plans" but the page lists ideas (`papercamp/ideas/`, IDEA-nn everywhere). Rename the visible title and nav label only — routes, file paths, and internal feature-folder names stay, that churn buys nothing.
- **Subject on an idea.** New optional `subject:` frontmatter key: types, parser, serializer round-trip (+ tests). No file migration — an idea without the key renders under a virtual **No subject** group at read time.
- **Group the worklist by subject.** Subject group headers over the existing rows, No subject last; `worklist-rows.tsx` already groups plans under idea headers, so the pattern exists.
- **Subjects view in Settings.** A dedicated sidebar section to add/rename/remove subjects (stored in the papercamp config, not hand-edited files). Removing a subject doesn't touch idea files — ideas pointing at a dead subject just fall back to No subject, same virtual-default rule.
- **Subject picker in idea details.** Set/change/clear the subject from the detail view; writes the one frontmatter line.
- **Detail view polish.** (1) The refresh button moves to the top-right corner of the detail view — today it sits inline in the meta row among branch/PR badges. (2) The Log section becomes **Comments**: visually separated from the idea body (its own surface, not a continuation of the prose), entries rendered chat-style — date-stamped bubbles in a column — with a full-width composer at the bottom and the send button aligned right, replacing today's awkward side-by-side textarea+button. UI rename only: the file grammar keeps the load-bearing `### Log` heading (`LOG_HEADING_RE` in the parser), so nothing breaks in the corpus or the agents that append to it.

### Phases
- [x] Rename Plans to Ideas
      Visible page title (`plans-header.tsx`) and nav label; routes, paths, and feature-folder names unchanged.
- [x] Add the subject field to entities
      Optional `subject:` frontmatter — types, parser, serializer round-trip with tests; absent key renders as the virtual "No subject", no file migration.
- [ ] Group the worklist by subject
      Subject group headers over the existing rows (No subject last), following the idea-group pattern already in `worklist-rows.tsx`.
- [ ] Manage subjects from Settings
      New Subjects sidebar view: add/rename/remove, persisted in the papercamp config; a removed subject demotes its ideas to No subject at read time without touching files.
- [ ] Pick a subject in idea details
      Set/change/clear from the detail view, writing only the frontmatter line.
- [ ] Polish the detail view
      Refresh button to the top-right corner; Log becomes Comments — separate surface, chat-style date-stamped entries, full-width bottom composer with right-aligned send. File grammar keeps `### Log`.
- [ ] Gate the pass
      `tsc --noEmit`, `biome check`, tests green (parser/serializer round-trip covered); click through grouping, settings management, picker, and comments in the app.
