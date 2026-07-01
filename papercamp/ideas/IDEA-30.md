---
id: IDEA-30
title: Claude Code native integration
---

## IDEA-30: Claude Code native integration

Make Paper Camp *automatic* inside Claude Code whenever it's working in a project that contains a `papercamp/` folder — the assistant loads the project's memory and keeps it current with zero prompting. This is Paper Camp's **distribution/integration story** (how it plugs into the AI-coding loop), not a dashboard feature. Written against the current layout: the append-only log is `progress.md`; plans/ideas are per-file under `plans/` and `ideas/`; decisions/open-questions are `decisions.md`/`open-questions.md`.

Four surfaces, each with a settled behavior:

1. **Skill (`SKILL.md`)** — a Claude Code skill auto-discovered when a `papercamp/` folder is present. It packages the methodology and tells the assistant to read `plans/`, `ideas/`, `decisions.md`, and `open-questions.md` before working, and to keep the active plan's phases/`progress.md` updated as it goes. Build first — highest leverage, lowest effort.

2. **SessionStart hook → current focus.** Injects a derived focus block at session start, read from live data (no focus file to hand-maintain): the focus plan via the dashboard's `findFocusPlan` over the per-file plans, the active feature branch via `getFeatureBranchPlanId`, and the last 3 `progress.md` entries. Decision: **derive, do not add a `now.md`** — a single source of truth (the plans + log) beats a duplicate file that drifts.

3. **Git post-commit hook → the auto-log.** Appends a timestamped `progress.md` entry from each commit message. This is **the** automatic logger: deterministic, cheap, commit-linked, and it keeps `progress.md` and git history in sync with zero habit. Installed by `paper-camp init`.

4. **PostToolUse hook → opt-in, narrow.** Decision: **off by default**, enabled via config. When on, it fires only on new-file creation (a `Write` to a path that didn't exist) and appends a dated `progress.md` bullet; it explicitly ignores reads/searches/bash and anything commit-related (the git hook owns commits, so there's no double-logging). Default-off because the post-commit hook already captures the durable trail, and an always-on PostToolUse is noisy and burns tokens — this surface only exists to catch scaffolding milestones that never get their own commit.

**Wiring:** the skill is a `SKILL.md` + Claude Code discovery; SessionStart/PostToolUse are `.claude/settings.json` hooks; the git hook is a committed hook. `paper-camp init` scaffolds all of them (skill file, `.claude/settings.json` hook entries, the post-commit hook) so the integration is turnkey on a fresh project.

Complements [[IDEA-31]] (MCP server): these are deep Claude-Code-specific UX; MCP is broad assistant-agnostic access. If the MCP server exists, the skill reads through it rather than reimplementing file access.
