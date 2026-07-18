---
id: IDEA-68
title: Trim the UI to what's used
type: refactor
status: idea
created: 2026-07-17
tags:
  - app
  - ui
  - docs
  - settings
  - tasks
---

The app has grown surfaces nobody visits. Minimise to the features actually used, and make the ones that stay denser. This is UI-only pruning: the `papercamp/` corpus files and every agent/server write to them stay exactly as they are — agents keep logging decisions, open questions, and progress; the app just stops rendering reading views for them.

- **Docs keeps only general docs.** The Decisions, Open Questions, and Progress sections (sidebar groups, `/docs/$section` views, `decision-detail`/`open-question-detail`/`progress-timeline`) go — never looked at, and they crowd out the repo docs that are the reason to open the page. Two seams to settle while removing: the Stack's Docs stamp click-through (`status-section.tsx`'s `handleFindingClick`) navigates consistency findings to `/docs/decisions|questions`, and docs-search may index the removed sections — both need a new target or removal alongside.
- **Settings keeps only General.** The Environment and Config Files sections go; editing the app's config belongs in code, not in the UI. The `/api/config` read the app itself boots from is untouched — only the editing surfaces are removed.
- **Tasks groups by date.** Every task row sits under its date — one group per day, newest day first, mirroring `progress.md`'s day-grouped shape. Same kraft-header-over-canvas-rows pattern the list already uses; the date becomes a group header instead of two timestamp columns doing all the work.
- **Sweep what the removals orphan.** Client slices, fetchers, and components that only served the removed views (`fetchDecisions`/`fetchOpenQuestions` and friends) go with them — but only after checking what the Stack still reads (the consistency card consumes doc issues; `progress` may feed more than the timeline). Server routes can stay if the CLI or checks use them; the sweep is client-first.

### Phases
- [ ] Trim Docs to general docs only
      Remove the Decisions/Open Questions/Progress sidebar sections and their `/docs/$section` detail views; keep repo docs and search over them. Re-point or drop `status-section.tsx`'s consistency-finding navigation and prune the removed sections from docs-search.
- [ ] Trim Settings to General
      Drop the Environment and Config Files sections from `settings-sidebar.tsx`/`settings-page.tsx`; config editing is code-only from here on. The boot-time config read stays.
- [ ] Group the Tasks list by date
      One group per day, newest first: a kraft date header over that day's task rows, reusing the existing task-rows pattern; timestamps within a row can slim down once the date lives in the header.
- [ ] Sweep orphaned client code
      Delete slices/fetchers/components only the removed views used, after confirming what the Stack panel still consumes (doc-issue findings, progress reads). Corpus files, agent writes, and server routes with non-UI consumers stay.
- [ ] Gate the pass
      `tsc --noEmit`, `biome check`, full tests; click through Docs, Settings, and Tasks to confirm the kept surfaces still work and nothing dangles.
