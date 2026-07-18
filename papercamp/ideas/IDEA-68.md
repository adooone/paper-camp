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
- **Git errors become readable toasts.** A failed commit shows "git commit exited with code 1" — contentless, because `runGit` (`git.ts`) rejects with `stderr || fallback` and git prints "nothing to commit" to *stdout*, which is discarded (live repro 2026-07-18: stale status showed 11 changed files on an actually-clean tree, the click staged nothing, and the one line explaining it was thrown away). A failed push has the opposite problem: ~7 lines of raw `! [rejected]` / `hint:` stderr crammed into the small inline `Alert`. Fix both ends: `runGit` includes stdout when stderr is empty; the client shows commit/push/sync/pull failures as toasts (`useToast` already exists) with a one-line human summary, replacing the cramped inline Alerts. The stale-status trigger itself is worth a defensive touch — refresh git status when a commit fails, so the card stops advertising files that are already committed.
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
- [ ] Make git errors readable toasts
      `runGit` includes stdout in the rejection when stderr is empty (so "nothing to commit" survives); commit/push/sync/pull failures surface as toasts with a one-line summary instead of raw multi-line git output in inline Alerts; a failed commit also refreshes git status so stale "changed files" don't invite a doomed retry.
- [ ] Gate the pass
      `tsc --noEmit`, `biome check`, full tests; click through Docs, Settings, and Tasks to confirm the kept surfaces still work and nothing dangles; force a commit and push failure and confirm both read as one-line toasts.
