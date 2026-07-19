---
id: IDEA-72
title: Truthful status and one-click archive
type: feat
status: done
created: 2026-07-17
updated: 2026-07-19
tags:
  - app
  - plans
  - agent
  - git
  - ui
subject: Workflow
order: 2
---

The app already knows the truth about a plan's state and doesn't say it: the task registry knows an agent is working on IDEA-nn right now (the row still says *Planned*), and PR lookup knows the branch merged (the file still sits in `ideas/` as *review* forever, since `done` is a human-only promotion nobody performs). Two fixes, one principle — **derive the displayed truth, write files only at the human decision point.** Absorbs the dormant [[IDEA-56]] ("Derive status from git and PR state"), which had the same thesis and never started.

- **Effective status, display-only.** The UI shows a status derived at read time: a running task whose `planId` matches the plan → **In progress** (live from the agent registry — zero file writes, disappears when the task ends); a merged PR → a **merged** signal on the row/detail. The frontmatter `status:` stays the durable record; no timer ever writes derived state back, so the corpus doesn't churn and agents aren't fought.
- **Archive is deterministic, and not part of Actualise all.** Finding "merged PR + status review/done + file still in `ideas/`" is a pure function over data the app already reads — after [[IDEA-67]], file moves must not be an agent's judgment call, and Actualise all is an agent content-sweep, the wrong home. A dedicated **Archive action** lists the archivable ideas, and one click moves each to `ideas/archive/`, flips `status: done`, and refreshes the index — the click *is* the human promotion moment, so the file is written exactly once, at the decision. A count badge ("3 ready to archive") on the list header or Stack makes it discoverable.

### Phases
- [x] Derive effective status for display
      Worklist rows and the detail view overlay a live status: agent task running for the plan → In progress; merged PR → merged signal. Read-time only — frontmatter untouched, registry/PR data already in the store.
- [x] Detect archivable ideas
      Server-side read returning ideas with a merged PR, status review/done, file still in `ideas/` — pure data, no agent.
- [x] Add the Archive action
      A confirm list of archivable ideas; one click per idea (or archive-all) moves the file to `ideas/archive/`, sets `status: done` in the same write, refreshes the index; count badge for discoverability.
- [x] Close the absorbed idea
      [[IDEA-56]] marked dropped-as-absorbed with a pointer here (done at filing time), so the backlog carries one statement of this thesis, not two.
- [x] Gate the pass
      `tsc --noEmit`, `biome check`, tests green (archivable detection covered); run an agent task and watch the live status flip; archive a merged idea end-to-end in the app.
