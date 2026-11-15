---
id: IDEA-325
title: Agent tests stop leaking processes
type: fix
status: done
created: 2026-11-03
updated: 2026-11-15
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
- [x] 2026-11-15 [log] [agent] Reviewed 2026-11-15: the phase is implemented in `src/app/server/agent.test.ts` (pid file per worker, `buildArgs` prefix, `afterEach`/`afterAll` kill) but landed inside the bookkeeping commit d4f4a1c8 rather than its own. The parked question that followed was a false positive of `extractDecision` matching the prompt's own NEEDS-DECISION template in `pgrep` output; removed here and filed as its own fix idea.
