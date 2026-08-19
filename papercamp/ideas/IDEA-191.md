---
id: IDEA-191
title: Tests run in-process and fast
type: refactor
status: review
created: 2026-08-19
updated: 2026-08-19
tags:
  - testing
  - performance
  - agent
  - cli
subject: Testing
---

The suite exercises behaviour in-process. Spawning a real subprocess is a
deliberate, rare choice — not the default shape of a test.

### What the suite costs today

88 files, 1057 tests, **88s wall** on a 2-core machine:

| phase | time |
|---|---|
| tests | 45.2s |
| collect | 14.7s |
| prepare | 9.5s |
| transform | 2.7s |

Measured test time concentrates almost entirely in five files — they are 94% of
it:

| file | time | tests | per test |
|---|---|---|---|
| `agent.test.ts` | 11.3s | 79 | 143ms |
| `stamp-release.test.ts` | 3.2s | 5 | **640ms** |
| `audit.test.ts` | 1.6s | 3 | **529ms** |
| `git.test.ts` | 0.9s | 93 | 9ms |
| `release-notes.test.ts` | 0.9s | 2 | **437ms** |

The per-test column is the tell. `git.test.ts` shells out to git constantly and
costs 9ms a test. The CLI files cost 400–640ms because each test spawns **`bun`
running `src/cli/index.ts`** — paying a full runtime boot and module graph per
assertion. `agent.test.ts` spawns a `node -e` script per test on top of building
a real git repo with eight git calls.

Ten test files import `child_process`.

### Spawning is what forces the timeouts

`waitForStatus` budgets 10s for an agent run while vitest's default kills the
test at 5s, so the helper's own diagnostic can never fire — a slow run reports
a bare "timed out in 5000ms" instead of naming the last status. One test already
carries an explicit `20_000` because it takes 4288ms locally, 14% under the
limit, and tipped over on a loaded CI runner.

Timeouts are the symptom. A test that calls a function does not need one; a test
that boots a runtime does. Removing the spawns removes the timeouts, and the
explicit `20_000` comes out with them.

### Call the code instead of launching it

The CLI's commands become exported functions the tests call directly, with the
process boundary — argv parsing, exit codes — covered once rather than per
assertion. The agent manager already takes an injected adapter; the tests use a
fake that resolves in-process instead of a `node -e` stub, keeping the manager's
own state machine under test without a process to wait for.

**Two or three end-to-end tests keep spawning for real.** One CLI invocation
through `bun`, one agent run through the real spawn/readline/exit path. They
prove the wiring the in-process tests assume, and they are the only places a
timeout is legitimate. Everything else drops its subprocess.

### There is almost nothing to delete

An audit of `agent.test.ts` says the weight is not spread across its 79 tests —
**63 of them already run under 50ms**, and the slowest 12 carry **91%** of the
file's 15.8s. Only 5 tests avoid the agent harness at all (the `buildAgentPrompt`
family), and those are already the cheap ones. Culling tests would save
essentially nothing; the entire win sits in roughly a dozen cases.

Those twelve are slow for two specific reasons, and neither is the spawn itself:

- **Deliberate wall-clock sleeps.** The stub agent is handed scripts like
  `setTimeout(() => process.exit(0), 5000)` and `400`, and one test body waits
  a flat 600ms. The concurrency and locking tests need *something* in flight,
  but sleeping in real time to get it is what costs the seconds.
- **Real git repositories.** `makeGitRoot` runs eight git subprocesses to build
  a repo with a bare remote. The commit-scoping test from [[IDEA-190]] is the
  single slowest in the suite at 3905ms, almost all of it setup.

So the work is: give the fake adapter a completion signal the test controls
instead of a timer, and share one git fixture across the cases that need a repo
rather than building one per test. Both change how a test waits, not what it
covers.

### Out of scope

Per-file isolation. Running with `isolate: false` is 23% faster (88s → 68s) but
25 tests fail on cross-file state leakage, which is a separate correctness
problem in its own right and easier to chase once these files are smaller.

The runner configuration is already correct and stays: the `forks` pool beats
`threads` here by a wide margin (88s vs 106s on 2 cores), so neither the pool
nor a global `testTimeout` is part of this.

### Phases
- [x] Export CLI command bodies as callable functions
      Split argv parsing and exit codes from each command's work so tests can call the function directly.
- [x] Move the CLI tests in-process
      Rewrite `stamp-release`, `audit`, and `release-notes` tests to call the exported functions; keep one real `bun` invocation as the sole process-boundary test.
- [x] Give the fake agent adapter a test-controlled completion signal
      Replace the `node -e` stub and the wall-clock sleeps in `agent.test.ts` with a signal the test resolves itself.
- [x] Share one git fixture across the repo-dependent tests
      Build the `makeGitRoot` repo once and reuse it instead of running eight git subprocesses per test.
- [x] Drop the spawn-driven timeouts, keep one real end-to-end agent run
      Remove `waitForStatus`'s timeout budgeting and the explicit `20_000`; leave a single real spawn/readline/exit test as the one legitimate timeout.
      run: 4m10s · 6k in · 11.1k out · sonnet-5
- [x] Sweep the remaining `child_process` importers
      Audit the other test files that spawn and convert any whose behaviour a direct call already covers.
      run: 1m25s · 382 in · 5.1k out · sonnet-5
- [x] [manual] Mark the Tests-check fix as done in IDEA-191
- [x] [manual] Fix deliver footer sizing and git action label wrapping

### Fixes
- [x] Fix the failing "Tests" check
      Fix the failing "Tests" check in this repo.
      run: 5m9s · 5.8k in · 4.5k out · sonnet-5
