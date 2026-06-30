---
id: IDEA-7
title: Commit section
---

### IDEA-7: Commit section

A second top-of-panel section in the Stack panel (`src/app/components/stack-panel.tsx`), sitting right below "Status" (see the "Repo health status" idea above — final order ends up Status → Commit → Active → Live). Shows the live working-tree diff — how many files changed and which ones — plus a small form to write a commit title/message and fire it off, so a commit doesn't require switching to a terminal.

This pairs naturally with two ideas already in this file: it's fed by the same file-watcher/SSE plumbing "Status" needs, and it's the natural place to cash in the `Kind`/ID scheme from "Plan & phase IDs" — pre-filling the commit's conventional-commit type from whatever plan is currently in focus.

**Look:** a changed-files count (`"7 files changed"`) as the section's headline, expanding via the same paper-ui `Accordion` the phase-description idea above needs to be built anyway — each row showing a path and its git status letter (`M`/`A`/`D`/`??`) with a checkbox to include/exclude it from the commit. Below that, a title `Input` and a message `Textarea`, then a `Button` labeled "Commit", disabled whenever zero files are checked or the title is empty.

**Feature ideas, roughly in build order:**

- **`GET /api/git/status`** — new route in `src/app/server/api.ts` that runs `git status --porcelain=v1` from the repo root and parses it into `{ path: string, status: string }[]`. Pushed over the existing `/api/activity/stream` SSE channel on the same debounced file-watcher trigger the "Status" idea already needs — "files changed" is exactly the signal that watcher is already positioned to recompute.
- **`POST /api/git/commit`** — body `{ files: string[], title: string, message?: string }`. Runs `git add -- <files>` against *only* the explicit paths in the request (never a blanket `git add -A`/`-u`) — same "write path only accepts an allowlisted/explicit set, never an arbitrary blob" principle the Settings idea's config-save endpoint already follows — then `git commit -m "<title>" -m "<message>"`.
- **Real git hooks fire for free** — since the commit happens as an actual `git commit` subprocess (not a reimplementation), a `commit-msg` hook from commitlint+husky (once the previous idea's commitlint piece lands) rejects a malformed message exactly as it would from the terminal — surfaced back to the UI as an inline `Alert` with the hook's own error text, no client-side validation logic to keep in sync with it.
- **Smart pre-fill from the active plan** — if `findFocusPlan` resolves a single in-progress plan, pre-fill the title field with that plan's `Kind` as a conventional-commit prefix (`feat: `, `fix: `) and offer a one-click "add `Refs: FEAT-2`" footer — turning the ID scheme from the previous idea into something that actually shows up in `git log`, not just in `plans.md`.

**Decisions worth making explicit:**

- **Commit only — no Push button, on purpose.** Committing is local and reversible; pushing touches shared/remote state and shouldn't be one click away in a panel that's open by default on every page. If push ever gets added, it should be its own deliberate, separately-confirmed action, not a checkbox on this form.
- **Don't hard-block commits when "Status" is red.** Failing tests/lint shouldn't disable the Commit button outright — plenty of legitimate commits are WIP or a deliberate checkpoint mid-fix. Show a non-blocking `Alert` next to the button when Status is failing (same spirit as GitHub showing a failing-check badge without blocking the merge button by default), rather than this panel unilaterally deciding what counts as "clean enough to commit."
- **Same localhost/repo-root boundary as every other child-process-spawning idea in this panel** — `git status`/`git add`/`git commit` always run against the fixed project root the dev server already knows, never a path from the request.
