---
id: IDEA-242
title: Tests in a minute
type: chore
status: idea
created: 2026-09-07
tags:
  - testing
  - cli
  - server
subject: Testing
order: 10
---

`pnpm test` takes 274 seconds. Measured on 2026-09-07 without coverage it
is 183 seconds of wall clock on two cores for 136 files and 1648 tests —
and the time is not where the count is. The sum of time spent inside test
files is 84 seconds, and four files account for 64 of them:

```
20s  102 tests  src/app/server/git.test.ts          a real git repo per test
19s   37 tests  src/cli/daemon-lifecycle.test.ts    spawns bun per command, waits on a daemon
18s   85 tests  src/app/server/agent.test.ts        spawns fake CLIs, real timers
 7s    4 tests  src/cli/registry-commands.test.ts   spawns bun, transpiling the CLI each time
```

The other 132 files take 20 seconds together; 111 of them finish in under
200 milliseconds and the median file takes 19. The remaining wall clock is
overhead: collecting and preparing 136 modules, and the V8 coverage
instrumentation `vitest run --coverage` applies to every run, local or CI.
Component tests are not the weight — three files, sixteen tests.

The count is a separate problem. Core carries 604 tests and the server 480,
and the parser, PR, git, and status suites spell out near-identical
variants as separate cases. That costs reading time, not run time.

Two moves fix the clock; a third fixes the count.

**Unit and integration are two projects.** A `vitest.workspace.ts` defines
`unit` and `integration`. Integration is the four files above plus
`src/mcp/tools.test.ts`, `src/app/server/login-relay.test.ts`, and
`src/app/server/routes/agent-login-relay.test.ts` — everything that spawns
a process or drives a real repository. Unit is everything else. `pnpm test`
runs unit alone with no coverage; `pnpm test:integration` runs the other
project; `pnpm test:all` runs both, and CI's test job runs `test:all
--coverage`. Coverage leaves the default script. The desk check named
`test` in `papercamp/config.json` runs `pnpm test`, so the Stack panel's
Tests stamp answers in the unit project's time.

**Affected tests on demand.** `pnpm test:changed` is `vitest run --changed`,
which walks the import graph from the working tree's git changes. The
Stack panel's Tests check gains a second stamp, `changed`, that runs it;
the full unit run stays the gate before a commit. Measured today,
`--changed` against a live working tree ran 6 files and 79 tests in 38
seconds, 26 of them the git suite; after the fixture rewrites below it
lands under ten.

**The four heavy suites get cheap fixtures.**

- `git.test.ts` creates one repository per `describe` and resets it between
  tests with `git checkout -- . && git clean -fd` instead of a fresh
  `initRepo` per test; the 22 describes become 22 repositories, not 102.
- `daemon-lifecycle.test.ts` and `registry-commands.test.ts` call the
  command functions in-process against a throwaway `PAPERCAMP_CONFIG_DIR`,
  the way `daemon-server.test.ts` already drives the handler with a real
  `http.Server`. One spawn per file remains, proving the entry point parses
  its arguments; every other case is a function call.
- `agent.test.ts` uses `vi.useFakeTimers()` for the phase timeout, the
  retry delays, and the parked-question wait; the fake CLI scripts exit
  immediately instead of sleeping.

**One case per behaviour.** A consolidation pass over `src/core/parse`,
`src/core/git-pr`, `src/core/status`, and `src/app/server/git.test.ts`
turns runs of sibling tests that differ only in an input value into
`it.each` tables, and deletes tests that assert a shape the type system
already guarantees. The target is the behaviours, not a number: a test
survives when its failure would name a bug a user could hit. Component
tests are untouched; there are sixteen.

**The bar is written down.** `docs/CODE_STYLE.md` gains a testing section:
core and server logic get unit tests at the function boundary; a feature
gets one test for its selector or hook and none for its child components;
anything that spawns a process or touches a real repository lives in the
integration project. `pnpm test` under a minute on a laptop is the number
the section states, and the CI job fails if the unit project passes it.

### Out of scope

Replacing the git, agent, and CLI integration tests with mocks — they catch
the failures that matter and only need cheaper fixtures. Any change to what
the desk checks are or how the Stack panel runs them beyond the second
stamp. Browser-rendered component tests; there is no DOM environment and
this idea adds none.

### Phases
- [x] Split unit and integration into two vitest projects
      Add `vitest.workspace.ts`, repoint `test`, `test:integration`, and
      `test:all`, and move coverage to CI's `test:all --coverage`.
      run: 13m49s · 92 in · 17.1k out · sonnet-5
- [x] Add `pnpm test:changed` and its Stack stamp
      run: 15m15s · 122 in · 32.4k out · sonnet-5
- [x] Reuse one repository per describe in `git.test.ts`
      run: 14m59s · 32 in · 78.7k out · sonnet-5
- [ ] Drive the daemon and registry commands in-process
      Keep one spawn per file for the entry point's argument parsing.
- [ ] Run `agent.test.ts` on fake timers with instant fake CLIs
- [ ] Consolidate sibling cases into `it.each` tables
      Covers `src/core/parse`, `src/core/git-pr`, `src/core/status`, and
      `git.test.ts`.
- [ ] Write the testing bar into `docs/CODE_STYLE.md` and gate CI on it
