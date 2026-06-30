---
id: FEAT-10
title: Agent orchestration
kind: feat
status: done
created: 2026-06-21
idea: IDEA-4
updated: 2026-06-25
tags:
  - app
  - agent
---

Launches a real agent session scoped to a plan/task from the dashboard, streams a
simplified progress view into the Stack panel, and lets follow-up input go into the
same session without leaving the browser — built for more than one agent from the
start. See ideas.md's "Agent orchestration" for the full rationale, including the
decisions (capability flags, one task at a time, localhost-only) that need to stay
explicit rather than discovered mid-build.

### Phases
- [x] Build per-agent adapter interface
      `launch(prompt, options) -> stream of events`, `resume(sessionId, message) -> stream`, plus capability flags (e.g. `supportsResume`); ship a Claude Code adapter first
- [x] Add agent selection config
      Default agent in `.paper-camp/config.json`; optional per-task override via a new `Agent` field on a `plans.md` entry
- [x] Add system-prompt checkpoint instruction
      The launched agent is told to append to `progress.md` / check off `plans.md` phases as it works — no new log schema, the agent's own writes are the activity log
- [x] Stream live status to the Stack panel
      Collapse raw tool-use events into one-line human-readable status text, pushed over the existing SSE activity channel; shown only while running, never written to disk
- [x] Support mid-task steering
      For agents whose adapter supports resume, hold the running task's session id and route panel input as a new turn into that same session
- [x] Handle process lifecycle and completion
      The process keeps running independent of the browser tab; the panel returns to its idle/history state on exit, showing the fresh `progress.md` entries the session wrote

### Log
- 2026-06-25: Ran the prerequisite opencode verification IDEA-4 called for but that hadn't happened yet (see decisions.md "Verify opencode's CLI before assuming it generalizes from Claude Code"). Confirmed: opencode's `--format json` streams true NDJSON with `sessionID` on every event, and `-s/--session <id>` resume works as tested live. `supportsResume` can be `true` for the opencode adapter, not an unknown. Still open before "Build per-agent adapter interface" starts: whether the opencode adapter is subprocess-per-call (matching the Claude adapter's shape) or a long-lived `opencode serve` + `--attach` connection — a real architecture choice, not yet made.
- 2026-06-25: Shipped the v1 slice (Claude Code adapter only, per the approved sub-plan). `src/app/server/agents/claude-code.ts` implements `buildArgs`/`parseLine`/`capabilities` against a live-confirmed `stream-json` shape (see decisions.md). `src/app/server/agent.ts` is a singleton task manager (one agent at a time, ring-buffered status lines, array-arg `spawn` — never `shell: true`, since prompts embed user-editable plan text). New routes: `POST /api/agent/launch|resume|stop`, `GET /api/agent/status`; agent events multiplexed onto the existing SSE channel with `type: 'agent'`. New Stack panel "Agent" section and a per-phase "Start agent" button in plan detail. Steering is v1-scoped: a steering message kills the current process and respawns with `-r <sessionId>`, not persistent bidirectional stdin. Verified live: a real launch spawns a real `claude` process, streams into the panel, Stop kills it cleanly, and `SIGTERM`-ing the dev server (the `dev-server.ts`/`vite.app.config.ts` shutdown hooks) kills an orphaned child too — confirmed via `ps` before/after each case. `tsc`/`biome` clean. Not done: "Add agent selection config" stays unchecked — no second adapter exists yet to choose between, so a selection mechanism would be speculative (the opencode adapter is still blocked on its own architecture decision, see entry above).
- 2026-06-25: Found and fixed a real orchestration bug: Vite's dev server restarts its middleware in-process on every server-side file change (not just Ctrl-C), which was silently orphaning the singleton `agent` manager — `vite.app.config.ts` now persists the `ApiMiddleware` instance on `globalThis` so it survives those restarts. Also added a post-run check in `agent.ts` (`wasPhaseChecked`/`finishTask`) that re-reads `plans.md` after a clean finish and pushes a visible warning line if the agent's own claimed phase checkbox didn't actually get flipped, instead of trusting the agent's self-report. Added `--permission-mode auto` to the Claude Code adapter's args (Claude Code's own classifier-based approval, the same mechanism governing this orchestrating session) layered on top of the `.claude/settings.json` allowlist, after discovering headless runs without it get stuck in permission-denial loops on real Edit/Bash work. Reviewed and checked off "Add agent selection config" — `src/app/server/agents/index.ts` (new) adds a proper `AgentAdapter`/`resolveAgent` registry consumed by `agent.ts`, `AGENT_IDS`/`AGENT_LABELS`/`agent?: AgentId` landed across `types/index.ts`/`schemas.ts`/`serializer.ts`/`parser.ts`, a per-plan `Select` in `plan-detail.tsx`, and a project-wide default in Settings — all wired end-to-end, `tsc` clean. All phases done — Status set to `review` per `AGENTS.md`. While auditing this, found and killed several genuinely orphaned `claude` processes and duplicate `pnpm dev` instances left over from the restart bug, consolidated back to one dev server on port 3333.
