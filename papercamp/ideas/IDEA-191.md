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

### Fixes
- [ ] Fix the failing "Tests" check
      Fix the failing "Tests" check in this repo.
      
      The command was `pnpm test`.
      
      Output from the last run:
      
      
      > @dendelion/paper-camp@0.19.0 test /home/croco/dev/paper-camp
      > vitest run --coverage
      
      
       RUN  v2.1.9 /home/croco/dev/paper-camp
            Coverage enabled with v8
      
       ✓ src/app/server/agent.test.ts (79 tests) 12206ms
         ✓ startRunAllPhases > runs each unchecked phase, committing after each, then completes the run 306ms
         ✓ startRunAllPhases > Fixes > leaves the fix pass as one accumulated diff with no per-fix commits 644ms
         ✓ commitPhase scoping (IDEA-190) > commits only the paths the phase changed, leaving other dirty files untouched 1568ms
         ✓ startPrReview > appends the verdict summary as a [review] thread message on the idea 790ms
         ✓ startPrReview > ends the task as error when a good verdict reaches neither GitHub nor the idea 821ms
         ✓ startPrReview > gives up and records the SHA after repeated delivery failures on it 2133ms
       ✓ src/app/server/git.test.ts (93 tests) 16483ms
         ✓ getBranchHygieneStatus > reports fine for a fresh branch cut from a stale local main 389ms
         ✓ findStaleBaseRef > flags origin/main when local main lags but origin/main is ahead 704ms
         ✓ runGitSync > carries uncommitted and untracked changes onto main 413ms
         ✓ runGitSync > restores staged changes as staged, not just as a working-tree edit 490ms
         ✓ runGitSync > leaves a pre-existing unrelated stash alone 722ms
         ✓ runGitSync > keeps local corpus edits that differ from origin/main, with no generated-file exception 662ms
         ✓ runGitSync > rebases a diverged local main onto origin instead of failing 529ms
         ✓ runGitSync > reports a pop conflict and keeps the changes in the stash 590ms
         ✓ runGitSync > keeps the corpus out of the stash, committing it separately even when the source pop conflicts 760ms
         ✓ runGitSync > does not create a corpus commit when papercamp/ is already clean 493ms
         ✓ hasPendingSyncStash > is true once a sync pop conflict leaves work stranded in the stash 600ms
         ✓ hasPendingSyncStash > is false again once the sync succeeds and the stash pops cleanly 319ms
         ✓ fixDivergence > reports a conflicted rebase with the conflicted files and a recovery prompt instead of throwing 337ms
         ✓ fixDivergence > reconciles an unpushed feature branch against origin/main, not a nonexistent upstream 357ms
       ✓ src/core/git-pr/pr.test.ts (82 tests) 953ms
       ✓ src/mcp/tools.test.ts (30 tests) 4966ms
         ✓ read tools > list_plans returns per-file plans 311ms
         ✓ read tools > get_plan finds a plan by id and returns null for an unknown id 331ms
         ✓ branch-conflict guard > rejects draft_plan while the current branch has an unfinished plan of its own 477ms
         ✓ branch-conflict guard > rejects update_phase on a different plan while the branch has an unfinished plan of its own 366ms
         ✓ branch-conflict guard on the full write surface > rejects add_idea while the branch has an unfinished plan of its own 303ms
         ✓ branch-conflict guard on the full write surface > rejects promote_suggestion while the branch has an unfinished plan of its own 433ms
         ✓ branch-conflict guard on the full write surface > rejects a mutation on a different plan but allows it on the branch owner 408ms
       ✓ src/core/parse/parser.test.ts (47 tests) 65ms
       ✓ src/core/roadmap.test.ts (38 tests) 28ms
       ✓ src/app/server/routes/agent.test.ts (11 tests) 266ms
      stderr | src/core/readers.test.ts > status derivation from PR state > is idea with no phases, planned with phases and no PR
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:464:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:138:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:163:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:259:8
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
      stderr | src/core/readers.test.ts > status derivation from PR state > is in-progress with an open PR and unchecked phases, review when all are checked
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:464:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:138:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:163:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:288:8
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
      stderr | src/core/readers.test.ts > status derivation from PR state > is done from a merged PR and dropped from a closed one
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:464:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:138:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:163:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:314:8
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
      stderr | src/core/readers.test.ts > status derivation from PR state > threads the resolved PR (number/url/state) onto the PlanEntry for the badge
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:464:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:138:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:163:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:348:13
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
      stderr | src/core/readers.test.ts > status derivation from PR state > never persists the derived status back onto the raw EntityEntry
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:464:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:138:34)
          at Module.readEntitiesWithDerivedStatus (/home/croco/dev/paper-camp/src/core/readers.ts:151:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:366:5
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
      stderr | src/core/readers.test.ts > findArchivableIdeas > lists a merged, review/done idea still in ideasDir, skipping notes and already-archived files
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:464:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:138:34)
          at Module.findArchivableIdeas (/home/croco/dev/paper-camp/src/core/readers.ts:181:38)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:464:47
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
      stderr | src/core/readers.test.ts > readEntitiesWithDerivedStatus > replaces status with the derived value for work entities, leaving notes untouched
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:464:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:138:34)
          at Module.readEntitiesWithDerivedStatus (/home/croco/dev/paper-camp/src/core/readers.ts:151:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:496:35
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
       ✓ src/core/readers.test.ts (18 tests) 407ms
       ✓ src/core/parse/frontmatter.test.ts (29 tests) 62ms
       ✓ src/app/features/plans/prompts/__tests__/prompts.test.ts (23 tests) 19ms
       ✓ src/app/features/plans/helpers/__tests__/plan-list-selector.test.ts (27 tests) 25ms
       ✓ src/app/server/pr-review-settle.test.ts (22 tests) 96ms
       ✓ src/core/trail.test.ts (19 tests) 848ms
       ✓ src/app/server/capabilities.test.ts (28 tests) 21ms
       ✓ src/core/parse/entity.test.ts (13 tests) 68ms
       ✓ src/core/stats.test.ts (15 tests) 23ms
       ✓ src/vite/index.test.ts (12 tests) 53ms
       ✓ src/app/server/feedback-reply.test.ts (20 tests) 18ms
       ✓ src/core/status/status.test.ts (34 tests) 13ms
       ✓ src/app/server/login-relay.test.ts (12 tests) 1040ms
         ✓ startClaudeLoginRelay > gives up polling after the timeout without calling onLoginConfirmed 315ms
       ✓ src/app/server/routes/agent-login-relay.test.ts (6 tests) 215ms
       ✓ src/app/features/plans/helpers/__tests__/check-fixes.test.ts (11 tests) 11ms
       ✓ src/app/server/task-log.test.ts (8 tests) 33ms
       ✓ src/cli/stamp-release.test.ts (5 tests) 1223ms
         ✓ paper-camp stamp-release (CLI) > stamps released: <version> onto every idea the release shipped, run as a real subprocess 707ms
       ✓ src/core/phase-progress.test.ts (18 tests) 36ms
       ✓ src/vite/proxy.test.ts (7 tests) 141ms
       ✓ src/core/parked-questions.test.ts (8 tests) 52ms
       ✓ src/app/server/prioritise.test.ts (5 tests) 117ms
       ✓ src/app/server/merge-policy.test.ts (8 tests) 99ms
       ✓ src/app/components/shell/status-bar-core.test.tsx (11 tests) 20ms
       ✓ src/app/server/agent.opencode-permission.test.ts (1 test) 255ms
       ✓ src/app/server/routes/trail.test.ts (7 tests) 430ms
       ✓ src/core/phase-run.test.ts (11 tests) 17ms
       ✓ src/cli/audit.test.ts (3 tests) 465ms
       ✓ src/core/release-notes.test.ts (5 tests) 425ms
       ✓ src/core/run-order.test.ts (10 tests) 47ms
       ✓ src/app/server/routes/release-notes.test.ts (3 tests) 253ms
       ✓ src/core/doctor/checks/structural.test.ts (9 tests) 81ms
       ✓ src/app/features/plans/helpers/__tests__/effective-status.test.ts (12 tests) 9ms
       ✓ src/app/server/routes/services.test.ts (6 tests) 12ms
       ✓ src/cli/dev-port.test.ts (12 tests) 68ms
       ✓ src/app/server/notification-log.test.ts (7 tests) 45ms
       ✓ src/app/server/run-order-pass.test.ts (2 tests) 85ms
       ✓ src/app/server/agents/claude-code.test.ts (9 tests) 11ms
       ✓ src/app/server/pr-review-state.test.ts (9 tests) 47ms
       ✓ src/core/ci/ci-release.test.ts (8 tests) 9ms
       ✓ src/cli/release-notes.test.ts (2 tests) 306ms
       ✓ src/app/utils/check-status.test.ts (7 tests) 9ms
       ✓ src/core/doctor/checks/metadata.test.ts (7 tests) 98ms
       ✓ src/app/features/plans/helpers/__tests__/idea-similarity.test.ts (8 tests) 25ms
       ✓ src/app/server/routes/notifications.test.ts (2 tests) 17ms
       ✓ src/core/doctor/fix.test.ts (5 tests) 10ms
       ✓ src/core/thread.test.ts (8 tests) 8ms
       ✓ src/app/server/routes/checks.test.ts (4 tests) 11ms
       ✓ src/app/server/api.test.ts (8 tests) 11ms
       ✓ src/core/git-log.test.ts (4 tests) 458ms
       ✓ src/core/notifications.test.ts (6 tests) 10ms
       ✓ src/app/server/agent-hooks.test.ts (1 test) 138ms
       ✓ src/app/utils/parse-diff.test.ts (7 tests) 13ms
       ✓ src/app/hooks/use-route-selection.test.ts (8 tests) 7ms
       ✓ src/core/serialize/content-hash.test.ts (6 tests) 9ms
       ✓ src/app/utils/local-draft-store.test.ts (6 tests) 35ms
       ✓ src/core/doctor/finding.test.ts (4 tests) 20ms
       ✓ src/app/chrome-outside-scroll.guard.test.ts (3 tests) 9ms
       ✓ src/app/features/plans/helpers/__tests__/manual-commit.test.ts (9 tests) 7ms
       ✓ src/app/components/stack-panel/agent-section.test.ts (9 tests) 7ms
       ✓ src/app/inline-styles.guard.test.ts (1 test) 19ms
       ✓ src/app/features/plans/helpers/__tests__/review-findings.test.ts (7 tests) 9ms
       ✓ src/core/run-order-file.test.ts (8 tests) 7ms
       ✓ src/core/scaffold/scaffold.test.ts (2 tests) 40ms
       ✓ src/app/server/corpus-cache.test.ts (6 tests) 9ms
       ✓ src/app/server/agents/opencode.test.ts (4 tests) 6ms
       ✓ src/app/features/plans/helpers/__tests__/open-questions.test.ts (3 tests) 15ms
       ✓ src/app/features/plans/helpers/__tests__/can-mark-plan-done.test.ts (5 tests) 10ms
       ✓ src/core/parse/desk-schema.test.ts (6 tests) 11ms
       ✓ src/app/hooks/notification-push.test.ts (4 tests) 7ms
       ✓ src/app/features/plans/helpers/__tests__/rollup-progress.test.ts (5 tests) 6ms
       ✓ src/app/components/stack-panel/services-group.test.ts (6 tests) 4ms
       ✓ src/core/serialize/serializer.test.ts (2 tests) 11ms
       ✓ src/app/utils/check-summary.test.ts (6 tests) 7ms
       ✓ src/app/features/plans/helpers/__tests__/diff.test.ts (4 tests) 8ms
       ✓ src/core/rate-limit.test.ts (4 tests) 5ms
       ✓ src/app/components/stack-panel/checks-group.test.ts (2 tests) 11ms
       ✓ src/app/services/mount.test.ts (4 tests) 4ms
       ✓ src/app/utils/error-summary.test.ts (4 tests) 5ms
       ✓ src/app/server/helpers.test.ts (2 tests) 5ms
       ✓ src/app/components/stack-panel/shared.test.ts (3 tests) 24ms
       ✓ src/app/utils/path-display.test.ts (2 tests) 4ms
      
      ⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯
      
      Vitest caught 1 unhandled error during the test run.
      This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.
      
      ⎯⎯⎯⎯⎯ Uncaught Exception ⎯⎯⎯⎯⎯
      Error: ENOENT: no such file or directory, scandir '/tmp/papercamp-agent-test-Kj0u1X/.git/objects'
       ❯ readdirSync node:fs:1584:26
       ❯ FSWatcher.#watchFolder node:internal/fs/recursive_watch:111:21
       ❯ FSWatcher.<anonymous> node:internal/fs/recursive_watch:191:26
       ❯ FSWatcher.emit node:events:518:28
       ❯ FSEvent.FSWatcher._handle.onchange node:internal/fs/watchers:215:12
      
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
      Serialized Error: { errno: -2, code: 'ENOENT', syscall: 'scandir', path: '/tmp/papercamp-agent-test-Kj0u1X/.git/objects' }
      This error originated in "src/app/server/agent.test.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
      The latest test that might've caused the error is "src/app/server/agent.test.ts". It might mean one of the following:
      - The error was thrown, while Vitest was running this test.
      - If the error occurred after the test had been completed, this was the last documented test before it was thrown.
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
      
       Test Files  88 passed (88)
            Tests  1057 passed (1057)
           Errors  1 error
         Start at  11:39:43
         Duration  109.21s (transform 3.19s, setup 0ms, collect 19.96s, tests 43.30s, environment 42ms, prepare 14.17s)
      
       % Coverage report from v8
      -------------------|---------|----------|---------|---------|-------------------
      File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
      -------------------|---------|----------|---------|---------|-------------------
      All files          |   40.68 |    82.53 |   56.01 |   40.68 |                   
       paper-camp        |       0 |        0 |       0 |       0 |                   
        ...css.config.js |       0 |        0 |       0 |       0 | 1-6               
        ...ind.config.ts |       0 |        0 |       0 |       0 | 1-76              
        ...app.config.ts |       0 |        0 |       0 |       0 | 1-249             
        ...bar.config.ts |       0 |        0 |       0 |       0 | 1-40              
       ...r-camp/scripts |       0 |        0 |       0 |       0 |                   
        ...ent-stats.mjs |       0 |        0 |       0 |       0 | 1-57              
       ...r-camp/src/app |       0 |        0 |       0 |       0 |                   
        main.tsx         |       0 |        0 |       0 |       0 | 1-19              
        router.tsx       |       0 |        0 |       0 |       0 | 1-509             
       ...app/components |    4.63 |        0 |       0 |    4.63 |                   
        ...ge-fields.tsx |       0 |        0 |       0 |       0 | 1-50              
        ...ding-style.ts |       0 |        0 |       0 |       0 | 1-2               
        ...h-surface.tsx |       0 |        0 |       0 |       0 | 1-82              
        ...c-actions.tsx |       0 |        0 |       0 |       0 | 1-45              
        icons.tsx        |    8.65 |      100 |       0 |    8.65 | ...27-241,245-258 
        index.ts         |       0 |        0 |       0 |       0 | 1                 
        link-button.tsx  |       0 |        0 |       0 |       0 | 1-13              
        markdown.tsx     |       0 |        0 |       0 |       0 | 1-43              
        page-title.tsx   |       0 |        0 |       0 |       0 | 1-18              
       ...mponents/shell |   37.29 |    56.25 |   16.66 |   37.29 |                   
        ...ty-header.tsx |       0 |        0 |       0 |       0 | 1-31              
        ...ad-banner.tsx |       0 |        0 |       0 |       0 | 1-31              
        ...bar-shell.tsx |       0 |        0 |       0 |       0 | 1-79              
        ...-bar-core.tsx |   84.25 |       75 |      50 |   84.25 | 7-14,96-105       
        status-bar.tsx   |       0 |        0 |       0 |       0 | 1-53              
       ...ts/stack-panel |   13.54 |    66.66 |   27.27 |   13.54 |                   
        ...t-section.tsx |   29.47 |    53.84 |      50 |   29.47 | ...82-176,179-214 
        checks-group.tsx |   10.69 |      100 |   16.66 |   10.69 | ...5,69-89,93-211 
        ci-group.tsx     |       0 |        0 |       0 |       0 | 1-110             
        desk-section.tsx |       0 |        0 |       0 |       0 | 1-61              
        index.ts         |       0 |        0 |       0 |       0 | 1                 
        ...ces-group.tsx |   11.45 |      100 |      20 |   11.45 | ...68-140,143-163 
        shared.tsx       |   44.06 |      100 |   66.66 |   44.06 | 24-69             
        stack-panel.tsx  |       0 |        0 |       0 |       0 | 1-199             
       .../features/docs |       0 |        0 |       0 |       0 |                   
        docs-page.tsx    |       0 |        0 |       0 |       0 | 1-67              
        index.ts         |       0 |        0 |       0 |       0 | 1                 
       ...ocs/components |       0 |        0 |       0 |       0 |                   
        docs-search.tsx  |       0 |        0 |       0 |       0 | 1-81              
        docs-sidebar.tsx |       0 |        0 |       0 |       0 | 1-98              
        ...es-detail.tsx |       0 |        0 |       0 |       0 | 1-44              
        ...oc-detail.tsx |       0 |        0 |       0 |       0 | 1-29              
       ...res/docs/hooks |       0 |        0 |       0 |       0 |                   
        ...ease-notes.ts |       0 |        0 |       0 |       0 | 1-23              
       ...p/features/git |       0 |        0 |       0 |       0 |                   
        count-badge.tsx  |       0 |        0 |       0 |       0 | 1-10              
        ...f-section.tsx |       0 |        0 |       0 |       0 | 1-118             
        file-path.tsx    |       0 |        0 |       0 |       0 | 1-22              
        ...-controls.tsx |       0 |        0 |       0 |       0 | 1-69              
        ...file-list.tsx |       0 |        0 |       0 |       0 | 1-168             
        git-page.tsx     |       0 |        0 |       0 |       0 | 1-130             
        ...us-marker.tsx |       0 |        0 |       0 |       0 | 1-61              
        index.ts         |       0 |        0 |       0 |       0 | 1                 
       ...features/inbox |       0 |        0 |       0 |       0 |                   
        helpers.ts       |       0 |        0 |       0 |       0 | 1-5               
        inbox-page.tsx   |       0 |        0 |       0 |       0 | 1-111             
        index.ts         |       0 |        0 |       0 |       0 | 1                 
        ...ation-row.tsx |       0 |        0 |       0 |       0 | 1-31              
        question-row.tsx |       0 |        0 |       0 |       0 | 1-102             
       ...features/plans |       0 |    33.33 |   33.33 |       0 |                   
        constants.ts     |       0 |      100 |     100 |       0 | 4-68              
        index.ts         |       0 |        0 |       0 |       0 | 1                 
        plans-page.tsx   |       0 |        0 |       0 |       0 | 1-198             
       .../plans/actions |       0 |        0 |       0 |       0 |                   
        ...es-button.tsx |       0 |        0 |       0 |       0 | 1-102             
        ...rt-button.tsx |       0 |        0 |       0 |       0 | 1-53              
        ...es-button.tsx |       0 |        0 |       0 |       0 | 1-47              
        ...an-button.tsx |       0 |        0 |       0 |       0 | 1-68              
        ...ea-button.tsx |       0 |        0 |       0 |       0 | 1-78              
        ...ew-button.tsx |       0 |        0 |       0 |       0 | 1-55              
        index.ts         |       0 |        0 |       0 |       0 | 1-12              
        ...ea-button.tsx |       0 |        0 |       0 |       0 | 1-25              
        ...ew-button.tsx |       0 |        0 |       0 |       0 | 1-76              
        ...le-button.tsx |       0 |        0 |       0 |       0 | 1-52              
        ...sh-button.tsx |       0 |        0 |       0 |       0 | 1-66              
        ...es-button.tsx |       0 |        0 |       0 |       0 | 1-48              
        ...ions-menu.tsx |       0 |        0 |       0 |       0 | 1-137             
       ...ans/components |       0 |        0 |       0 |       0 |                   
        ...ible-text.tsx |       0 |        0 |       0 |       0 | 1-56              
        ...-controls.tsx |       0 |        0 |       0 |       0 | 1-403             
        ...ck-thread.tsx |       0 |        0 |       0 |       0 | 1-135             
        index.ts         |       0 |        0 |       0 |       0 | 1-9               
        ...-id-stamp.tsx |       0 |        0 |       0 |       0 | 1-14              
        pr-badge.tsx     |       0 |        0 |       0 |       0 | 1-45              
        progress-bar.tsx |       0 |        0 |       0 |       0 | 1-11              
        ...nce-trail.tsx |       0 |        0 |       0 |       0 | 1-121             
        ...nal-badge.tsx |       0 |        0 |       0 |       0 | 1-38              
        ...r-section.tsx |       0 |        0 |       0 |       0 | 1-19              
       .../plans/helpers |   93.52 |     93.4 |   88.88 |   93.52 |                   
        check-fixes.ts   |     100 |    94.44 |     100 |     100 | 19                
        diff.ts          |     100 |      100 |     100 |     100 |                   
        helpers.ts       |   68.42 |    92.15 |   68.75 |   68.42 | ...-26,72,118-127 
        ...similarity.ts |     100 |    92.85 |     100 |     100 | 92                
        index.ts         |     100 |      100 |     100 |     100 |                   
        manual-commit.ts |     100 |      100 |     100 |     100 |                   
        ...t-selector.ts |   96.81 |       92 |      95 |   96.81 | ...15,117,119,194 
        ...w-findings.ts |     100 |    96.55 |     100 |     100 | 19                
       ...es/plans/hooks |       0 |        0 |       0 |       0 |                   
        index.ts         |       0 |        0 |       0 |       0 | 1-6               
        ...et-summary.ts |       0 |        0 |       0 |       0 | 1-30              
        ...atus-patch.ts |       0 |        0 |       0 |       0 | 1-38              
        ...ad-message.ts |       0 |        0 |       0 |       0 | 1-63              
        ...phase-fill.ts |       0 |        0 |       0 |       0 | 1-41              
        ...ck-message.ts |       0 |        0 |       0 |       0 | 1-95              
        use-trail.ts     |       0 |        0 |       0 |       0 | 1-23              
       ...s/plans/modals |       0 |        0 |       0 |       0 |                   
        ...dea-modal.tsx |       0 |        0 |       0 |       0 | 1-258             
        ...all-modal.tsx |       0 |        0 |       0 |       0 | 1-94              
        index.ts         |       0 |        0 |       0 |       0 | 1-4               
        ...ion-modal.tsx |       0 |        0 |       0 |       0 | 1-78              
        ...iff-panel.tsx |       0 |        0 |       0 |       0 | 1-143             
       .../plans/prompts |   85.58 |    68.06 |      80 |   85.58 |                   
        index.ts         |     100 |      100 |     100 |     100 |                   
        prompts.ts       |   85.52 |    68.06 |      80 |   85.52 | ...52,157,400-434 
       ...es/plans/views |       0 |        0 |       0 |       0 |                   
        ...e-section.tsx |       0 |        0 |       0 |       0 | 1-123             
        ...ty-detail.tsx |       0 |        0 |       0 |       0 | 1-793             
        index.ts         |       0 |        0 |       0 |       0 | 1-12              
        list-view.tsx    |       0 |        0 |       0 |       0 | 1-48              
        note-detail.tsx  |       0 |        0 |       0 |       0 | 1-41              
        ...ns-column.tsx |       0 |        0 |       0 |       0 | 1-224             
        ...er-column.tsx |       0 |        0 |       0 |       0 | 1-98              
        plan-rows.tsx    |       0 |        0 |       0 |       0 | 1-174             
        plans-header.tsx |       0 |        0 |       0 |       0 | 1-14              
        ...-skeleton.tsx |       0 |        0 |       0 |       0 | 1-56              
        ...ue-review.tsx |       0 |        0 |       0 |       0 | 1-66              
        ...s-section.tsx |       0 |        0 |       0 |       0 | 1-48              
        ...list-rows.tsx |       0 |        0 |       0 |       0 | 1-330             
       ...atures/roadmap |    1.12 |        0 |       0 |    1.12 |                   
        ...tem-modal.tsx |       0 |        0 |       0 |       0 | 1-92              
        index.ts         |       0 |        0 |       0 |       0 | 1                 
        ...tem-modal.tsx |       0 |        0 |       0 |       0 | 1-114             
        ...ap-filters.ts |   17.07 |      100 |       0 |   17.07 | ...34,37-45,48-61 
        roadmap-page.tsx |       0 |        0 |       0 |       0 | 1-415             
        ...p-sidebar.tsx |       0 |        0 |       0 |       0 | 1-105             
        ...item-names.ts |       0 |        0 |       0 |       0 | 1-21              
       ...tures/settings |       0 |        0 |       0 |       0 |                   
        index.ts         |       0 |        0 |       0 |       0 | 1                 
        ...ings-page.tsx |       0 |        0 |       0 |       0 | 1-406             
       ...ngs/components |       0 |        0 |       0 |       0 |                   
        ...y-section.tsx |       0 |        0 |       0 |       0 | 1-124             
        ...s-sidebar.tsx |       0 |        0 |       0 |       0 | 1-52              
        ...p-section.tsx |       0 |        0 |       0 |       0 | 1-301             
        ...s-section.tsx |       0 |        0 |       0 |       0 | 1-41              
       ...features/stats |       0 |        0 |       0 |       0 |                   
        index.ts         |       0 |        0 |       0 |       0 | 1                 
        stats-page.tsx   |       0 |        0 |       0 |       0 | 1-239             
       ...features/tasks |       0 |        0 |       0 |       0 |                   
        index.ts         |       0 |        0 |       0 |       0 | 1                 
        tasks-page.tsx   |       0 |        0 |       0 |       0 | 1-280             
       .../src/app/hooks |    5.44 |    64.28 |   19.23 |    5.44 |                   
        index.ts         |     100 |      100 |     100 |     100 |                   
        ...ation-push.ts |     100 |      100 |     100 |     100 |                   
        ...n-feedback.ts |       0 |        0 |       0 |       0 | 1-44              
        ...anch-sync.tsx |       0 |        0 |       0 |       0 | 1-160             
        ...ci-release.ts |       0 |        0 |       0 |       0 | 1-28              
        ...ommit-form.ts |       0 |        0 |       0 |       0 | 1-178             
        ...esk-checks.ts |    5.88 |      100 |       0 |    5.88 | 12-48             
        ...k-manifest.ts |       0 |        0 |       0 |       0 | 1-27              
        ...cus-client.ts |       0 |        0 |       0 |       0 | 1-35              
        ...ation-push.ts |       0 |        0 |       0 |       0 | 1-41              
        ...iew-status.ts |       0 |        0 |       0 |       0 | 1-31              
        ...t-identity.ts |   10.34 |      100 |       0 |   10.34 | 5-8,17-42         
        ...-selection.ts |   45.83 |      100 |    37.5 |   45.83 | ...52,56-60,65-72 
        ...out-client.ts |       0 |        0 |       0 |       0 | 1-44              
        ...ces-client.ts |    4.44 |      100 |       0 |    4.44 | 15-63             
        ...ilar-ideas.ts |   15.78 |      100 |       0 |   15.78 | 14-31             
        ...tus-client.ts |       0 |        0 |       0 |       0 | 1-245             
        ...vocabulary.ts |      10 |      100 |       0 |      10 | 15-34             
       ...src/app/server |   72.75 |    80.73 |   84.27 |   72.75 |                   
        activity.ts      |    2.98 |      100 |       0 |    2.98 | 12-86             
        agent-hooks.ts   |    56.6 |    47.36 |   66.66 |    56.6 | ...92-114,117-119 
        agent-process.ts |    92.3 |     87.5 |     100 |    92.3 | 25-26             
        agent.ts         |   78.33 |    73.28 |   85.91 |   78.33 | ...1845,1850-1872 
        api.ts           |      50 |     87.5 |      75 |      50 | 41-42,106-170     
        biome-fix.ts     |   90.47 |       75 |     100 |   90.47 | 23-24             
        capabilities.ts  |   98.03 |    94.11 |     100 |   98.03 | 50                
        ...it-suggest.ts |       0 |      100 |       0 |       0 | 1-53              
        corpus-cache.ts  |     100 |      100 |     100 |     100 |                   
        desk-checks.ts   |    4.16 |      100 |       0 |    4.16 | ...6,31-43,46-126 
        desk-services.ts |    5.17 |      100 |       0 |    5.17 | ...7,55-73,76-282 
        ...back-reply.ts |   93.26 |    93.22 |     100 |   93.26 | 25-31             
        ...iew-settle.ts |   96.87 |    70.83 |     100 |   96.87 | 35-36             
        ...c-recovery.ts |   96.77 |       90 |     100 |   96.77 | 18                
        git.ts           |   84.47 |    84.21 |   82.22 |   84.47 | ...72,899,936-938 
        helpers.ts       |   95.55 |    89.65 |     100 |   95.55 | 17-18,110-111     
        http.ts          |     100 |     87.5 |     100 |     100 | 22                
        login-relay.ts   |   97.03 |    92.85 |     100 |   97.03 | 41,96-98          
        merge-policy.ts  |   94.39 |    81.25 |     100 |   94.39 | ...,76-77,125-126 
        ...cation-log.ts |    87.5 |    83.33 |     100 |    87.5 | 35-36,55-57       
        overlap-check.ts |    6.89 |      100 |       0 |    6.89 | 10-45             
        ...iew-settle.ts |   95.67 |    88.31 |   91.66 |   95.67 | 15-17,31-32,49-50 
        ...view-state.ts |   87.32 |    81.81 |     100 |   87.32 | ...48,75-77,87-88 
        prioritise.ts    |   91.66 |    68.18 |     100 |   91.66 | ...54,125,138-141 
        ...ict-prompt.ts |     100 |     37.5 |     100 |     100 | 10-14,17-22       
        ...order-pass.ts |     100 |     87.5 |     100 |     100 | 11                
        run.ts           |   95.23 |      100 |     100 |   95.23 | 23                
        services.ts      |   97.14 |    91.07 |     100 |   97.14 | 104-105,107-108   
        status.ts        |    2.73 |      100 |       0 |    2.73 | ...0,45-53,56-202 
        task-log.ts      |   88.88 |    88.46 |     100 |   88.88 | ...02,105-106,109 
       .../server/agents |   80.93 |    59.34 |     100 |   80.93 |                   
        claude-code.ts   |   73.75 |    71.69 |     100 |   73.75 | ...48,150-158,167 
        index.ts         |   96.07 |       25 |     100 |   96.07 | 74-75             
        opencode.ts      |   83.72 |    44.11 |     100 |   83.72 | ...69,82,93-97,99 
       .../server/routes |   40.93 |    83.96 |   37.33 |   40.93 |                   
        agent.ts         |   52.34 |    78.26 |   38.23 |   52.34 | ...32-733,740-748 
        capabilities.ts  |    5.55 |      100 |       0 |    5.55 | 6-39              
        checks.ts        |     100 |      100 |     100 |     100 |                   
        ci.ts            |    9.67 |      100 |       0 |    9.67 | 10-22,25-39       
        git.ts           |    0.79 |      100 |       0 |    0.79 | 14-33,36-291      
        index.ts         |    9.09 |      100 |       0 |    9.09 | 20-39             
        notifications.ts |    87.5 |       80 |     100 |    87.5 | 15-17             
        reads.ts         |   43.87 |      100 |       0 |   43.87 | ...65-172,181-183 
        release-notes.ts |     100 |      100 |     100 |     100 |                   
        services.ts      |   81.66 |    88.88 |      80 |   81.66 | 37-44,53-55       
        status.ts        |    3.27 |      100 |       0 |    3.27 | 8-74              
        tasks.ts         |   15.78 |      100 |       0 |   15.78 | 8-25              
        trail.ts         |     100 |      100 |     100 |     100 |                   
        types.ts         |       0 |        0 |       0 |       0 |                   
       ...routes/content |    1.51 |      100 |       0 |    1.51 |                   
        ideas.ts         |    0.77 |      100 |       0 |    0.77 | 26-332            
        index.ts         |     100 |      100 |     100 |     100 |                   
        plans.ts         |    1.47 |      100 |       0 |    1.47 | 29-37,40-204      
       .../routes/system |    8.69 |      100 |       0 |    8.69 |                   
        config.ts        |    5.88 |      100 |       0 |    5.88 | 19,32-39,42-238   
        env.ts           |    3.44 |      100 |       0 |    3.44 | 10-72             
        icon.ts          |   16.66 |      100 |       0 |   16.66 | 16-69             
        index.ts         |     100 |      100 |     100 |     100 |                   
        merge-policy.ts  |   10.52 |      100 |       0 |   10.52 | 6-22              
       ...c/app/services |   15.32 |       50 |    1.69 |   15.32 |                   
        ...ity-stream.ts |   15.38 |      100 |       0 |   15.38 | 14-44,47-62       
        agent-api.ts     |   12.76 |      100 |       0 |   12.76 | ...12-214,217-218 
        api-base.ts      |   42.85 |      100 |       0 |   42.85 | 4-5,8-9           
        checks-api.ts    |   18.75 |      100 |       0 |   18.75 | 5-9,12-19         
        ci-api.ts        |       0 |        0 |       0 |       0 | 1-12              
        git-api.ts       |   10.79 |      100 |       0 |   10.79 | ...48-158,161-172 
        mount.ts         |     100 |       75 |     100 |     100 | 10                
        ...-notes-api.ts |      25 |      100 |       0 |      25 | 5-9,12-15         
        services-api.ts  |   19.35 |      100 |       0 |   19.35 | ...23,26-30,33-37 
        status-api.ts    |   28.57 |      100 |       0 |   28.57 | 14-16,19-20,25-29 
        trail-api.ts     |       0 |        0 |       0 |       0 | 1-8               
       ...rvices/content |   19.09 |      100 |       0 |   19.09 |                   
        docs-api.ts      |   13.97 |      100 |       0 |   13.97 | ...06-108,111-113 
        ideas-api.ts     |   15.38 |      100 |       0 |   15.38 | ...49,52-63,66-70 
        index.ts         |     100 |      100 |     100 |     100 |                   
        ...ations-api.ts |   21.42 |      100 |       0 |   21.42 | 5-8,11-17         
        ...stions-api.ts |   33.33 |      100 |       0 |   33.33 | 5-8               
        plans-api.ts     |   18.18 |      100 |       0 |   18.18 | 15-19,22-49       
        stats-api.ts     |   33.33 |      100 |       0 |   33.33 | 5-8               
       ...ervices/system |    17.5 |      100 |       0 |    17.5 |                   
        ...lities-api.ts |    14.7 |      100 |       0 |    14.7 | ...15,18-26,29-39 
        config-api.ts    |      12 |      100 |       0 |      12 | 5-12,27-40        
        icon-api.ts      |   11.11 |      100 |       0 |   11.11 | 3-15,18-28        
        index.ts         |     100 |      100 |     100 |     100 |                   
        ...policy-api.ts |   15.78 |      100 |       0 |   15.78 | 5-12,15-22        
        package-api.ts   |      20 |      100 |       0 |      20 | 3-10              
       ...src/app/stores |   71.42 |      100 |       0 |   71.42 |                   
        app-store.ts     |   71.42 |      100 |       0 |   71.42 | ...51,54-56,59,66 
       .../stores/slices |   44.61 |      100 |   24.59 |   44.61 |                   
        agent-slice.ts   |      25 |      100 |   11.11 |      25 | ...28-233,238-240 
        diff-slice.ts    |   54.28 |      100 |      20 |   54.28 | 37-39,44-56       
        docs-slice.ts    |    42.5 |      100 |   16.66 |    42.5 | 29-43,54-61       
        ideas-slice.ts   |   86.95 |      100 |      25 |   86.95 | 37-39             
        ...ions-slice.ts |   55.17 |      100 |      50 |   55.17 | 27-39             
        ...ions-slice.ts |     100 |      100 |     100 |     100 |                   
        plans-slice.ts   |    45.2 |      100 |      25 |    45.2 | ...00-105,109-111 
        roadmap-slice.ts |   52.94 |      100 |   33.33 |   52.94 | 37-44,46-53       
        slice-helpers.ts |   57.69 |      100 |   66.66 |   57.69 | 17-24,34-36       
        status-slice.ts  |   33.33 |      100 |    12.5 |   33.33 | ...93-118,134-150 
        ...ions-slice.ts |   54.54 |      100 |   16.66 |   54.54 | ...49,52-55,58-61 
        ...-log-slice.ts |     100 |      100 |      50 |     100 |                   
       ...src/app/styles |     100 |      100 |     100 |     100 |                   
        tokens.ts        |     100 |      100 |     100 |     100 |                   
       .../src/app/utils |     100 |    93.75 |     100 |     100 |                   
        check-status.ts  |     100 |      100 |     100 |     100 |                   
        check-summary.ts |     100 |      100 |     100 |     100 |                   
        error-summary.ts |     100 |    85.71 |     100 |     100 | 11                
        ...raft-store.ts |     100 |      100 |     100 |     100 |                   
        parse-diff.ts    |     100 |    86.95 |     100 |     100 | 37,47,62          
        path-display.ts  |     100 |      100 |     100 |     100 |                   
       ...r-camp/src/cli |   45.38 |    73.68 |   70.58 |   45.38 |                   
        dev-port.ts      |     100 |      100 |     100 |     100 |                   
        dev-server.ts    |   21.21 |      100 |       0 |   21.21 | 21-97             
        index.ts         |   46.61 |       60 |   88.88 |   46.61 | ...55-766,769-770 
        session-focus.ts |    4.16 |      100 |       0 |    4.16 | 7-34              
       ...-camp/src/core |   88.64 |    94.55 |   87.06 |   88.64 |                   
        env.ts           |    6.12 |      100 |       0 |    6.12 | 5-26,29-35,38-60  
        git-log.ts       |     100 |    94.11 |     100 |     100 | 21                
        index.ts         |       0 |        0 |       0 |       0 | 1-13              
        notifications.ts |     100 |      100 |     100 |     100 |                   
        ...-questions.ts |     100 |      100 |     100 |     100 |                   
        ...e-progress.ts |     100 |    93.87 |     100 |     100 | 31,59,99          
        phase-run.ts     |     100 |    91.42 |     100 |     100 | 15,25,37-39,68,94 
        rate-limit.ts    |     100 |      100 |     100 |     100 |                   
        readers.ts       |   98.66 |    96.87 |     100 |   98.66 | 65-66             
        release-notes.ts |     100 |    92.85 |     100 |     100 | 36                
        roadmap.ts       |     100 |    98.01 |     100 |     100 | 235,291           
        ...order-file.ts |     100 |      100 |     100 |     100 |                   
        run-order.ts     |     100 |       80 |     100 |     100 | 15,35-40,62       
        sections.ts      |   91.12 |    94.11 |   78.57 |   91.12 | ...,91-93,116-125 
        stats.ts         |   61.97 |    95.23 |   68.75 |   61.97 | ...,46-81,227-252 
        thread.ts        |   91.17 |    94.44 |   88.88 |   91.17 | 62-67             
        trail.ts         |     100 |    96.36 |     100 |     100 | 48,86             
       ...mp/src/core/ci |   40.81 |    96.42 |   57.14 |   40.81 |                   
        ci-release.ts    |   40.41 |    96.42 |   57.14 |   40.41 | 28-62,125-181     
        index.ts         |     100 |      100 |     100 |     100 |                   
       ...rc/core/doctor |    67.5 |    96.29 |   41.66 |    67.5 |                   
        doctor.ts        |    5.26 |      100 |       0 |    5.26 | 24-80,83-88       
        finding.ts       |   75.55 |     92.3 |      75 |   75.55 | 22,37-46          
        fix.ts           |     100 |      100 |     100 |     100 |                   
        index.ts         |     100 |      100 |     100 |     100 |                   
        rules.ts         |     100 |      100 |     100 |     100 |                   
       .../doctor/checks |   97.62 |    85.71 |     100 |   97.62 |                   
        metadata.ts      |   96.74 |    84.21 |     100 |   96.74 | 64-65,68-69       
        structural.ts    |   98.46 |     87.8 |     100 |   98.46 | 28-29             
       ...rc/core/git-pr |    96.8 |    91.72 |   98.03 |    96.8 |                   
        branch.ts        |   84.21 |    83.33 |     100 |   84.21 | 17-19             
        index.ts         |     100 |      100 |     100 |     100 |                   
        pr-lookup.ts     |    95.7 |    95.45 |   95.83 |    95.7 | ...57,474-484,508 
        pr.ts            |   98.16 |    88.59 |     100 |   98.16 | ...31-233,238-239 
        scopes.ts        |     100 |      100 |     100 |     100 |                   
       ...src/core/parse |    99.8 |    97.22 |   94.11 |    99.8 |                   
        ...er-schemas.ts |       0 |        0 |       0 |       0 | 1                 
        index.ts         |     100 |      100 |     100 |     100 |                   
        parser.ts        |     100 |       98 |     100 |     100 | 214,354           
        schemas.ts       |     100 |      100 |     100 |     100 |                   
       .../core/scaffold |   95.34 |     87.5 |      75 |   95.34 |                   
        index.ts         |     100 |      100 |     100 |     100 |                   
        scaffold.ts      |   94.11 |     87.5 |      75 |   94.11 | 12-13,36-37       
        templates.ts     |     100 |      100 |     100 |     100 |                   
       ...core/serialize |   87.38 |    82.85 |    87.5 |   87.38 |                   
        content-hash.ts  |     100 |      100 |     100 |     100 |                   
        index.ts         |     100 |      100 |     100 |     100 |                   
        serializer.ts    |   86.47 |    82.08 |   86.66 |   86.47 | ...68-269,316-318 
       ...rc/core/status |     100 |      100 |     100 |     100 |                   
        index.ts         |     100 |      100 |     100 |     100 |                   
        status.ts        |     100 |      100 |     100 |     100 |                   
       ...r-camp/src/mcp |   96.66 |    82.75 |      90 |   96.66 |                   
        schemas.ts       |     100 |      100 |     100 |     100 |                   
        server.ts        |    7.69 |      100 |       0 |    7.69 | 11-24             
        tools.ts         |   99.06 |    82.75 |     100 |   99.06 | 195-198           
       ...mp/src/toolbar |    2.53 |        0 |       0 |    2.53 |                   
        index.ts         |       0 |        0 |       0 |       0 | 1-13              
        ...-attribute.ts |     100 |      100 |     100 |     100 |                   
        ...r-element.tsx |       0 |        0 |       0 |       0 | 1-63              
        toolbar.tsx      |       0 |        0 |       0 |       0 | 1-43              
       .../toolbar/scout |       0 |        0 |       0 |       0 |                   
        paper-logo.tsx   |       0 |        0 |       0 |       0 | 1-33              
        scout-card.tsx   |       0 |        0 |       0 |       0 | 1-376             
        scout-thread.tsx |       0 |        0 |       0 |       0 | 1-205             
        ...t-trigger.tsx |       0 |        0 |       0 |       0 | 1-109             
        ...out-reveal.ts |       0 |        0 |       0 |       0 | 1-71              
       ...camp/src/types |   73.91 |      100 |       0 |   73.91 |                   
        index.ts         |   73.91 |      100 |       0 |   73.91 | 512-522,544-545   
       ...-camp/src/vite |     100 |    83.33 |     100 |     100 |                   
        index.ts         |     100 |     91.3 |     100 |     100 | 22,31             
        proxy.ts         |     100 |    69.23 |     100 |     100 | 23,28,35,43       
      -------------------|---------|----------|---------|---------|-------------------
       ELIFECYCLE  Test failed. See above for more details.
