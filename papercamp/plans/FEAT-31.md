---
id: FEAT-31
title: Claude Code native integration
kind: feat
status: in-progress
created: 2026-07-01
idea: IDEA-30
updated: 2026-07-03
tags:
  - integration
  - claude-code
  - skill
  - hooks
  - cli
---

Paper Camp's distribution story is making itself automatic inside Claude Code: whenever the assistant works in a project that contains a `papercamp/` folder, it loads the project's memory and keeps it current with zero prompting. This is how Paper Camp plugs into the AI-coding loop, not another dashboard feature. It lands as four surfaces — a `SKILL.md` skill, a SessionStart hook, a git post-commit hook, and an opt-in PostToolUse hook — all scaffolded by `paper-camp init` so a fresh project is turnkey.

The design is deliberately anti-drift: the SessionStart focus block is *derived* from live data (the per-file plans plus `progress.md`) rather than stored in a hand-maintained `now.md`, and the automatic logger is the deterministic commit-linked git hook, not an always-on tool watcher. The PostToolUse surface stays off by default and narrow when on — new-file creation only — so it only catches scaffolding milestones the git hook would miss, without the noise and token cost of watching every tool call. Complements [[FEAT-32]] (the MCP server, drafted from IDEA-31 since this plan was written): if that server exists, the skill reads through it rather than reimplementing file access.

### Phases
- [x] Write the Paper Camp skill (`SKILL.md`)
      Author the skill that Claude Code auto-discovers when a `papercamp/` folder is present. It packages the methodology and instructs the assistant to read `plans/`, `ideas/`, `decisions.md`, and `open-questions.md` before working, and to keep the active plan's phases and `progress.md` current as it goes. Build this first — highest leverage, lowest effort — and keep the file-access instructions thin enough that they can later delegate to the [[FEAT-32]] MCP server.
- [x] Add the SessionStart focus hook
      A `.claude/settings.json` SessionStart hook that injects a derived focus block from live data: the focus plan via the dashboard's `findFocusPlan` (src/app/features/plans/helpers.ts) over the per-file plans, the active feature branch via the git manager's `getFeatureBranchPlanId` (src/app/server/git.ts), and the last 3 `progress.md` entries. Derive, never add a `now.md` — a single source of truth (plans + log) beats a duplicate file that drifts. Ship it as a small script the hook shells out to.
- [ ] Add the git post-commit auto-logger
      A committed `post-commit` git hook that appends a timestamped `progress.md` entry from each commit message. This is *the* automatic logger: deterministic, cheap, commit-linked, and it keeps `progress.md` in sync with git history with zero habit. Reuse the existing progress append/serializer path — `formatProgressEntry` in src/core/serializer.ts and the prepend-under-today's-heading logic of `prependProgressItem` in src/app/server/agent-hooks.ts — so entries match the `## YYYY-MM-DD` + bullet grammar.
- [ ] Add the opt-in PostToolUse hook
      A `.claude/settings.json` PostToolUse hook, **off by default**, enabled via a config flag. When on it fires only on new-file creation (a `Write` to a path that didn't previously exist) and appends a dated `progress.md` bullet; it explicitly ignores reads, searches, bash, and anything commit-related so it never double-logs against the git hook. Add the config flag and gate the hook body on it.
- [ ] Scaffold all four surfaces from `paper-camp init`
      Extend `initProject`/`init` so a fresh project gets the skill file, the `.claude/settings.json` hook entries (SessionStart plus the default-off PostToolUse), and the committed post-commit hook — never overwriting existing files, matching init's current no-clobber contract. This is what makes the integration turnkey.
- [ ] Document the integration and verify end-to-end
      Add an `about.md` section covering the four surfaces and the config flag, then smoke-test in a fresh temp project: confirm the skill is discovered, the SessionStart block renders live focus, a commit lands a `progress.md` entry, and the PostToolUse hook stays silent until enabled.
