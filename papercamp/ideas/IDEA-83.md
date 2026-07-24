---
id: IDEA-83
title: One release line per idea
type: fix
status: idea
created: 2026-07-22
tags:
  - ci
  - git
  - docs
subject: Workflow
order: 1
---

The v0.10.0 release notes list six separate "Gate the pass" entries, three "updates", and a pile of phase titles that mean nothing without their idea ("Close the absorbed idea", "Detect archivable ideas"). Root cause is structural, not cosmetic: release-please compiles every conventional commit on main, and merge-commit PRs deliver every per-phase agent commit individually. The user-meaningful unit of change is the **idea** — one PR, one line — but the changelog's unit is the phase.

The fix: **squash-merge, with the PR title as the conventional commit.**

- **Squash-merge PRs** (GitHub repo setting — human change: allow squash, default message "pull request title and description", optionally disable merge commits). One commit per idea lands on main; per-phase history stays on the PR and, more importantly, in `progress.md` — the corpus already narrates phases better than git does, so main's history stops duplicating it badly.
- **Conventional PR titles, automated.** Squash inherits the PR title, and today's titles ("IDEA-76: First Run Access Setup") aren't conventional — release-please would *skip* them entirely, which is worse than noise. The sync-pr-metadata workflow (which already titles PRs from the idea) changes format to `<type>(<scope>): <Idea title> (IDEA-N)` — type from the idea's `type:` frontmatter, scope from its primary tag per the existing commit-scope rule. Every release line then reads `feat(app): First-run access setup (IDEA-76)` with a clickable commit → PR → idea provenance chain.
- **Trim the sections.** `changelog-sections`: hide `refactor` and `docs` alongside `chore` — internal hygiene ("Sweep comments to the §7 bar") isn't release information; features and fixes are. The commits remain in history, just not in the notes.
- **Guard the door.** A lightweight PR-title lint (the workflow validates its own format on retitle; a check fails if a hand-titled PR isn't conventional) so the squash commit can't silently fall out of the changelog.

Heads-up recorded for the implementer: squash-merge also breaks the hygiene check's ancestry-based `stale-merged` detection (squashed branch commits never become ancestors of main) — the merge-policy phase must switch `getBranchHygieneStatus` to the PR-state signal (`resolvePrsByEntity` already knows merged) or the sync-to-main escape hatch goes blind. Not in scope: rewriting the already-published 0.9/0.10 notes (history is history), and agent-written release highlights (worth a thought once one-line-per-idea lands and the raw material is clean).

### Phases
- [x] Retitle PRs conventionally
      `sync-pr-metadata.yml`: title format `<type>(<scope>): <Idea title> (IDEA-N)` from the idea's frontmatter type + primary-tag scope (fallback `feat(repo)`); validate the format and fail the check on non-conventional hand-titled PRs.
- [x] Trim changelog sections
      `release-please-config.json`: hide `refactor` and `docs` sections; verify the next release-please PR renders features and fixes only.
- [x] Document the merge policy
      The human half: squash-merge enabled with "title and description" default (repo settings — recorded in `decisions.md` with the rationale that progress.md owns phase narrative); AGENTS.md / USAGE.md updated so the flow says squash.
- [ ] Gate the pass
      Checks green; next merged idea produces exactly one conventional commit on main, and the following release-please PR shows one line for it with the idea id.
