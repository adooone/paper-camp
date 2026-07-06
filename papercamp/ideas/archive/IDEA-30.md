---
id: IDEA-30
title: Claude Code native integration
type: feat
status: done
created: 2026-07-01
updated: 2026-07-03
tags:
  - integration
  - claude-code
  - skill
  - hooks
  - cli
---

Claude Code native integration: the paper-camp skill plus hooks that load project memory automatically and keep progress.md current.

### Phases
- [x] Write the Paper Camp skill (`SKILL.md`)
      Author the skill that Claude Code auto-discovers when a `papercamp/` folder is present. It packages the methodology and instructs the assistant to read `plans/`, `ideas/`, `decisions.md`, and `open-questions.md` before working, and to keep the active plan's phases and `progress.md` current as it goes. Build this first — highest leverage, lowest effort — and keep the file-access instructions thin enough that they can later delegate to the [[FEAT-32]] MCP server.
- [x] Add the SessionStart focus hook
      A `.claude/settings.json` SessionStart hook that injects a derived focus block from live data: the focus plan via the dashboard's `findFocusPlan` (src/app/features/plans/helpers.ts) over the per-file plans, the active feature branch via the git manager's `getFeatureBranchPlanId` (src/app/server/git.ts), and the last 3 `progress.md` entries. Derive, never add a `now.md` — a single source of truth (plans + log) beats a duplicate file that drifts. Ship it as a small script the hook shells out to.
- [x] Add the git post-commit auto-logger
      A committed `post-commit` git hook that appends a timestamped `progress.md` entry from each commit message. This is *the* automatic logger: deterministic, cheap, commit-linked, and it keeps `progress.md` in sync with git history with zero habit. Reuse the existing progress append/serializer path — `formatProgressEntry` in src/core/serializer.ts and the prepend-under-today's-heading logic of `prependProgressItem` in src/app/server/agent-hooks.ts — so entries match the `## YYYY-MM-DD` + bullet grammar.
- [x] Add the opt-in PostToolUse hook
      A `.claude/settings.json` PostToolUse hook, **off by default**, enabled via a config flag. When on it fires only on new-file creation (a `Write` to a path that didn't previously exist) and appends a dated `progress.md` bullet; it explicitly ignores reads, searches, bash, and anything commit-related so it never double-logs against the git hook. Add the config flag and gate the hook body on it.
- [x] Scaffold all four surfaces from `paper-camp init`
      Extend `initProject`/`init` so a fresh project gets the skill file, the `.claude/settings.json` hook entries (SessionStart plus the default-off PostToolUse), and the committed post-commit hook — never overwriting existing files, matching init's current no-clobber contract. This is what makes the integration turnkey.
- [x] Document the integration and verify end-to-end
      Add an `about.md` section covering the four surfaces and the config flag, then smoke-test in a fresh temp project: confirm the skill is discovered, the SessionStart block renders live focus, a commit lands a `progress.md` entry, and the PostToolUse hook stays silent until enabled.
