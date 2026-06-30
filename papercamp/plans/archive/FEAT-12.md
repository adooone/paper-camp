---
id: FEAT-12
title: Commit section
kind: feat
status: done
created: 2026-06-21
idea: IDEA-7
updated: 2026-06-25
tags:
  - app
  - stack
  - git
---

A second top-of-panel Stack section, below "Status", showing the live working-tree diff
and a small form to write and fire off a commit without switching to a terminal. Commit
only — no Push button, on purpose. See ideas.md's "Commit section" for the full
rationale.

### Phases
- [x] Add GET /api/git/status route
      Runs `git status --porcelain=v1` from the repo root, parsed into `{ path, status }[]`, pushed over the existing activity SSE channel on the same file-watcher trigger
- [x] Build changed-files accordion
      The Commit section: a "N files changed" headline expanding via paper-ui's `Accordion`, each row showing a path and its git status letter with an include/exclude checkbox
- [x] Add POST /api/git/commit route
      Body `{ files, title, message? }`; runs `git add -- <explicit files>` (never `-A`/`-u`) then `git commit -m`
- [x] Add commit form
      Title `Input` + message `Textarea` + Commit `Button`, disabled when zero files are checked or the title is empty; a `commit-msg` hook failure surfaces as an inline `Alert`
- [x] Pre-fill from active plan
      If `findFocusPlan` resolves a single in-progress plan, pre-fill the title with its `Kind` as a conventional-commit prefix and offer a one-click `Refs: FEAT-N` footer

### Log
- 2026-06-24: Needs changes: GET /api/git/status caches the result and only invalidates on a watcher tied to .git/index changes, not the src/ file watcher FEAT-6/FEAT-11 already use. Editing or creating a file never refreshes it, so the Commit section can stay stale indefinitely — verified it kept showing a deleted test file as staged hours after removal. Form validation, pre-fill from active plan, and the commit/accordion UI are all correct otherwise. Fix: drop the cache and call runGitStatus() fresh on every GET, or hook into the existing src/ watcher instead of watching .git/index.
- 2026-06-25: Re-reviewed the fix in `src/app/server/git.ts`: the cache is gone and `getStatus()` now calls `runGitStatus()` fresh on every GET, so the stale-status bug is fixed regardless of any watcher. Also added a `src/` watcher so the live SSE broadcast itself fires on file edits, not just `.git/index` changes (previously the push only fired on stage/commit). Two non-blocking nits for later: `refresh()` still calls `runGitStatus()` only to discard the result now that there's no cache to populate it into; and there are now two independent recursive `src/` watchers (here and in `status.ts`) with different debounce windows doing the same directory-tree watch — worth consolidating into one shared watcher per IDEA-5's original plan. Approved and closed.
