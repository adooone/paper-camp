---
id: IDEA-325
title: Agent tests stop leaking processes
type: fix
status: in-progress
created: 2026-11-03
updated: 2026-11-14
tags:
  - server
  - agents
  - testing
subject: Testing
---

Six `node -e` processes from `src/app/server/agent.test.ts` were still running
on the dev box twelve days after the test run that started them, each in a
deleted `/tmp/papercamp-agent-test-*` folder. They are the
`HANGS_IGNORING_SIGTERM` fixture: a fake agent that ignores SIGTERM and never
exits, used by the phase-timeout test and the `killCurrent` escalation test.
Both tests drive the SIGKILL escalation under fake timers, and when an attempt
does not deliver the SIGKILL (a test that fails or times out first, or an
escalation timer that never advances) nothing else kills the process. Each
leaked fixture wakes every second forever, and the temporary roots they sit
in are only removed from disk, not freed while the process holds them.

**Every fake agent records its pid.** The mocked adapter's `buildArgs` in
`agent.test.ts` prefixes every script it runs with a line that appends
`process.pid` to `<tmpdir>/papercamp-agent-test-pids` for the current test
file run (one file per Vitest worker, named with the worker id).

**Every recorded pid is killed after each test.** An `afterEach` reads the
file, sends SIGKILL to every pid still alive, and truncates it, whether the
test passed or failed. `afterAll` does the same once more and deletes the
file.

Done when `pnpm test:all` followed by `pgrep -f "setInterval(() => {}, 1000)"`
finds nothing, including after a run in which the phase-timeout test is made
to fail.

### Phases
- [x] Record and kill fake-agent pids
      Pid file per worker, the `buildArgs` prefix, `afterEach` and
      `afterAll` cleanup; verified with a deliberately failing run.

### Thread
- [x] 2026-11-14 [log] [agent] Restored on 2026-11-14 from a stranded `papercamp-reconcile` stash dated 2026-11-06 (see IDEA-331). Not started: `agent.test.ts` has no pid file per worker.
- [ ] 2026-11-14 [question] [agent] Run-all parked on phase 1 ("Record and kill fake-agent pids") — the agent needs a decision: <one question, at most 140 characters, ending in ?> OPTION: <at most 80 characters> — <one consequence, at most 100 characters> OPTION: <two to four options total; the first is your recommendation> CONTEXT: <at most three sentences; no file paths unless the choice is about a file>  When the work is done: 1. In the plan file's `### Phases` list, change this phase's checkbox from `- [ ]` to `- [x]`. Do not change any other line. 2. If every phase in the list is now checked, set the plan's `status:` frontmatter field to `review` — never `done`; per this repo's AGENTS.md a human promotes plans to done. --output-format stream-json --verbose --permission-mode auto --mcp-config {"mcpServers":{"paper-camp":{"command":"paper-camp","args":["mcp"]}}} --strict-mcp-config --disallowedTools WebFetch WebSearch --model opus --effort high
