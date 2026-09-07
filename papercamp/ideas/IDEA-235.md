---
id: IDEA-235
title: Stale entries and daemon root answers
type: fix
status: review
created: 2026-09-05
updated: 2026-09-07
tags:
  - cli
  - server
subject: Multi-project
order: 3
---

Three small wrongs found while checking the published 0.27.0 daemon.

**A deleted project is served as an empty one.** Register a repo, delete its
folder, request `/p/<slug>/api/plans`: the daemon answers `200
{"entries":[],"warnings":[]}` and `paper-camp ls` lists the path as if it
were there. `createProjectMounter` mounts whatever path the registry holds
without looking at it. The fix: a registered path without
`papercamp/config.json` is *missing*. The daemon refuses to mount it — 404
`paper-camp daemon: project folder missing at <path>` — and
`/api/machine/projects` reports `missing: true` for it, so the hub renders
the row greyed and unpickable instead of opening an empty desk. `ls` and
`status` print `missing` in the `STATE` column and, below the table, one hint:
`paper-camp rm <slug>` to forget it. Nothing is removed automatically; the
registry is the user's list.

**The daemon root answers `/api/*` with HTML.** `GET /api/capabilities` at
the root falls through `createDaemonRequestHandler` to `serveStatic` and
returns the SPA index with 200. `servesOwnRuntime` in `hub.ts` only knows
the root is not a project because that HTML fails `response.json()` — an
accident, not a contract. Any `/api/` path at the root other than
`/api/machine/projects` now answers 404 `{"error":"no project mounted at the
daemon root"}`. [[IDEA-234]]'s self-discovery reads this as the definitive
answer.

**The port-in-use remedy is `dev`'s.** `portInUseMessage` tells a daemon
user to "set port in papercamp/config.json for this project", which the
daemon never reads. It takes a variant for the daemon: `Port 4333 is already
taken — a daemon may already be running; paper-camp status shows it, or pick
another port with -p.` `dev` keeps its message.

### Out of scope

Re-scanning or pruning the registry on the daemon's behalf. Any change to how
`scan` decides what is a project.

### Phases
- [x] Decide missing from the registry entry
      One helper reads a registered path and reports it missing when `papercamp/config.json` is absent.
      run: 3m31s · 88 in · 15k out · sonnet-5
- [x] Refuse to mount a missing project
      `createProjectMounter` answers 404 `paper-camp daemon: project folder missing at <path>` instead of serving an empty desk.
      run: 6m51s · 58 in · 16.1k out · sonnet-5
- [x] Report `missing: true` from `/api/machine/projects`
      run: 11m27s · 80 in · 17.3k out · sonnet-5
- [x] Grey the missing row in the hub and make it unpickable
      run: 11m16s · 140 in · 28.3k out · sonnet-5
- [x] Print `missing` in the `ls` and `status` STATE column
      Add one hint below the table naming `paper-camp rm <slug>`; nothing is removed automatically.
      run: 12m54s · 94 in · 22k out · sonnet-5
- [x] Answer `/api/*` at the daemon root with 404 JSON
      Every root `/api/` path but `/api/machine/projects` returns `{"error":"no project mounted at the daemon root"}`; drop `servesOwnRuntime`'s reliance on HTML failing `response.json()`.
      run: 14m21s · 64 in · 15.1k out · sonnet-5
- [x] Give the daemon its own port-in-use message
      `portInUseMessage` takes a daemon variant pointing at `paper-camp status` and `-p`; `dev` keeps its wording.
      run: 5m50s · 40 in · 5.1k out · sonnet-5

### Fixes
- [ ] Fix the failing "Tests" check
      Fix the failing "Tests" check in this repo.
      
      The command was `pnpm test`.
      
      Output from the last run:
      
      
      > @dendelion/paper-camp@0.27.0 test /home/croco/dev/paper-camp
      > vitest run --coverage
      
      
       RUN  v2.1.9 /home/croco/dev/paper-camp
            Coverage enabled with v8
      
       ✓ src/app/server/agent.test.ts (85 tests) 27859ms
         ✓ startRunAllPhases > runs each unchecked phase, committing after each, then completes the run 333ms
         ✓ startRunAllPhases > commits the corpus via onRunStart before the first phase agent launches (IDEA-137) 305ms
         ✓ startRunAllPhases > starts the first phase cold, then resumes each later phase from the prior session id 393ms
         ✓ startRunAllPhases > resumes a same-run fix pass and the next phase from the running session id 517ms
         ✓ startRunAllPhases > runs fix attempts up to the cap and stops without committing when checks stay red 487ms
         ✓ startRunAllPhases > continues to the next phase when a fix attempt makes checks green 492ms
         ✓ startRunAllPhases > short-circuits to escalation when the fix pass declares a blocker, without exhausting the cap 547ms
         ✓ startRunAllPhases > tolerates a check that was already red before the run instead of fixing or failing on it 388ms
         ✓ startRunAllPhases > completes untouched when read-only board helpers launch mid-run (IDEA-126) 411ms
         ✓ startRunAllPhases > Fixes > runs open Fixes after the phases are done without committing, then completes the run 461ms
         ✓ startRunAllPhases > Fixes > leaves the fix pass as one accumulated diff with no per-fix commits 906ms
         ✓ commitPhase scoping (IDEA-190) > commits only the paths the phase changed, leaving other dirty files untouched 5198ms
         ✓ resumeQuestionParkedTasks > re-launches a run-all that parked on a question and clears errorKind 406ms
         ✓ startFixReview > finishes cleanly and maps the agent verdict back to thread ids 392ms
         ✓ startFixReview > accepts a verdict wrapped in a markdown code fence 1424ms
         ✓ startFixReview > treats a run that skips every comment as success, not a failure 724ms
         ✓ startFixReview > warns when the agent exits without reporting a verdict 869ms
         ✓ startFixReview > rejects a verdict with a duplicate thread index 333ms
         ✓ startPrReview > records the SHA even when the agent never reports a parseable verdict 365ms
         ✓ startPrReview > appends the verdict summary as a [review] thread message on the idea 1635ms
         ✓ startPrReview > ends the task as error when a good verdict reaches neither GitHub nor the idea 924ms
         ✓ startPrReview > gives up and records the SHA after repeated delivery failures on it 2899ms
         ✓ startBatchReconcile / getReconcileQueue > queues a before snapshot for an entity whose prose actually changed 310ms
       ✓ src/app/server/git.test.ts (102 tests) 22429ms
         ✓ getBranchHygieneStatus > reports a branch with unmerged local commits as fine 341ms
         ✓ getBranchHygieneStatus > reports stale-merged after a no-ff merge into main (PR-style merge) 331ms
         ✓ getBranchHygieneStatus > reports stale-merged after a ff merge once main advances past the branch 422ms
         ✓ getBranchHygieneStatus > reports stale-merged even when the working tree is dirty 359ms
         ✓ getBranchHygieneStatus > reports stale-merged via origin/main when the local main ref is stale 526ms
         ✓ getBranchHygieneStatus > reports fine for a fresh branch cut from a stale local main 463ms
         ✓ getPhaseStateAtRef > reads a ref other than HEAD, not the working tree 351ms
         ✓ findStaleBaseRef > flags origin/main when local main lags but origin/main is ahead 317ms
         ✓ runGitSync > carries uncommitted and untracked changes onto main 356ms
         ✓ runGitSync > restores staged changes as staged, not just as a working-tree edit 347ms
         ✓ runGitSync > keeps local corpus edits that differ from origin/main, with no generated-file exception 340ms
         ✓ runGitSync > rebases a diverged local main onto origin instead of failing 357ms
         ✓ runGitSync > reports a pop conflict and keeps the changes in the stash 539ms
         ✓ runGitSync > keeps the corpus out of the stash, committing it separately even when the source pop conflicts 579ms
         ✓ runGitSync > does not create a corpus commit when papercamp/ is already clean 314ms
         ✓ hasPendingSyncStash > is true once a sync pop conflict leaves work stranded in the stash 479ms
         ✓ fixDivergence > rebases a diverged branch onto its remote instead of failing 331ms
         ✓ fixDivergence > reports a conflicted rebase with the conflicted files and a recovery prompt instead of throwing 350ms
         ✓ fixDivergence > reconciles an unpushed feature branch against origin/main, not a nonexistent upstream 395ms
         ✓ returnToMain > checks out main, fast-forwards it, and deletes the branch locally and on the remote 671ms
         ✓ returnToMain > force-deletes locally even though squashing means the branch never merged into main 332ms
         ✓ returnToMain > reports remoteDeleted: false without throwing when the remote branch is already gone 379ms
         ✓ commit > treats selected paths literally instead of as glob pathspecs 309ms
       ✓ src/core/git-pr/pr.test.ts (87 tests) 3453ms
       ✓ src/core/parse/parser.test.ts (51 tests) 651ms
       ✓ src/mcp/tools.test.ts (26 tests) 4011ms
         ✓ read tools > list_plans returns per-file plans 336ms
         ✓ read tools > get_plan finds a plan by id and returns null for an unknown id 427ms
         ✓ writes on any branch > adds an idea while another plan owns the branch 329ms
       ✓ src/cli/daemon-lifecycle.test.ts (37 tests) 22312ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > refuses a second daemon and prints the status line for the one already running 912ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > prints the log and exits 1 when the spawned daemon dies before answering 3166ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > stop reports nothing running and exits 0 when there is no daemon 1014ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > stop sends SIGTERM, waits for exit, and removes the state file 1365ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > stop escalates to SIGKILL when the daemon ignores SIGTERM, then removes the state file 6047ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > restart stops the running daemon, then attempts to start a new one 1889ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > ls prints "—" for every project when no daemon is running 587ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > ls prints missing in the STATE column and a hint to forget a deleted project 497ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > ls reports "No projects registered." with no daemon running and an empty registry 600ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > ls reports mounted/busy state per project once the daemon answers 915ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > status reports the daemon as not running, then the "—" project table 639ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > status reports the running daemon block, then the live project table 770ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs says so and exits 0 when there is no daemon.log yet 545ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs -f also exits 0 immediately when there is no daemon.log yet 878ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs defaults to printing the last 50 lines of daemon.log 775ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs -n limits the printed lines to the requested count 750ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs -f prints existing content, then follows appended lines until killed 889ms
       ✓ src/app/server/routes/agent.test.ts (13 tests) 300ms
      stdout | src/cli/daemon-server.test.ts > createProjectMounter > builds and caches a registered project on first request
      paper-camp: mounted "repo" (/tmp/paper-camp-daemon-project-l5J8PP/repo)
      
      stdout | src/cli/daemon-server.test.ts > createProjectMounter > mounts independent slugs independently
      paper-camp: mounted "alpha" (/tmp/paper-camp-daemon-project-jpmzk8/alpha)
      paper-camp: mounted "beta" (/tmp/paper-camp-daemon-project-cGTKjl/beta)
      
      stdout | src/cli/daemon-server.test.ts > createDaemonRequestHandler > reports a project as mounted after a request has built its middleware
      paper-camp: mounted "demo" (/tmp/paper-camp-daemon-e2e-project-79htk2/demo)
      
      stdout | src/cli/daemon-server.test.ts > createDaemonRequestHandler > mounts a registered slug and rewrites the forwarded URL to strip the /p/<slug> prefix
      paper-camp: mounted "demo" (/tmp/paper-camp-daemon-e2e-project-nwdiMe/demo)
      
       ✓ src/cli/daemon-server.test.ts (29 tests) 372ms
       ✓ src/core/roadmap.test.ts (38 tests) 51ms
      stderr | src/core/readers.test.ts > status derivation from PR state > is idea with no phases, planned with phases and no PR
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:463:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:85:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:116:65)
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
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:463:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:85:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:116:65)
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
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:463:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:85:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:116:65)
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
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:463:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:85:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:116:65)
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
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:463:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:85:34)
          at Module.readEntitiesWithDerivedStatus (/home/croco/dev/paper-camp/src/core/readers.ts:97:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:366:5
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
      stderr | src/core/readers.test.ts > board status rollup from tickets > rolls a board up from its tickets, capping at review
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:463:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:85:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:116:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:401:8
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
      stderr | src/core/readers.test.ts > board status rollup from tickets > respects a manually stamped done/dropped board status instead of the rollup
      papercamp: could not persist PR map for /: Error: EACCES: permission denied, mkdir '/papercamp'
          at Proxy.mkdir (node:internal/fs/promises:852:10)
          at persistPrMap (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:33:5)
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:463:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:85:34)
          at Module.readWorkEntries (/home/croco/dev/paper-camp/src/core/readers.ts:116:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:420:8
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
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:463:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:85:34)
          at Module.findArchivableIdeas (/home/croco/dev/paper-camp/src/core/readers.ts:140:38)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:518:47
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
          at Module.resolvePrsByEntity (/home/croco/dev/paper-camp/src/core/git-pr/pr-lookup.ts:463:5)
          at async Promise.all (index 0)
          at readEntitiesAndPrs (/home/croco/dev/paper-camp/src/core/readers.ts:85:34)
          at Module.readEntitiesWithDerivedStatus (/home/croco/dev/paper-camp/src/core/readers.ts:97:65)
          at /home/croco/dev/paper-camp/src/core/readers.test.ts:550:35
          at file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:5
          at runTest (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:11)
          at runSuite (file:///home/croco/dev/paper-camp/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15) {
        errno: -13,
        code: 'EACCES',
        syscall: 'mkdir',
        path: '/papercamp'
      }
      
       ✓ src/core/readers.test.ts (20 tests) 741ms
       ✓ src/core/parse/frontmatter.test.ts (32 tests) 124ms
       ✓ src/app/server/capabilities.test.ts (39 tests) 39ms
       ✓ src/app/features/plans/prompts/__tests__/prompts.test.ts (25 tests) 21ms
       ✓ src/app/server/pr-review-settle.test.ts (24 tests) 166ms
       ✓ src/app/features/plans/helpers/__tests__/plan-list-selector.test.ts (30 tests) 67ms
       ✓ src/app/server/prioritise.test.ts (16 tests) 458ms
       ✓ src/core/trail.test.ts (19 tests) 1275ms
       ✓ src/core/issues.test.ts (23 tests) 86ms
       ✓ src/core/parse/entity.test.ts (15 tests) 122ms
       ✓ src/app/server/routes/agent-login-relay.test.ts (9 tests) 451ms
       ✓ src/app/services/project-registry.test.ts (23 tests) 38ms
       ✓ src/app/server/login-relay.test.ts (14 tests) 1300ms
         ✓ startClaudeLoginRelay > gives up polling after the timeout without calling onLoginConfirmed 326ms
       ✓ src/core/status/status.test.ts (40 tests) 26ms
       ✓ src/app/server/feedback-reply.test.ts (22 tests) 26ms
       ✓ src/app/services/runtime-connection.test.ts (19 tests) 33ms
       ✓ src/app/server/api.test.ts (19 tests) 21ms
       ✓ src/vite/index.test.ts (12 tests) 119ms
       ✓ src/core/daemon-state/daemon-state.test.ts (14 tests) 213ms
       ✓ src/cli/registration-link.test.ts (19 tests) 81ms
       ✓ src/core/run-filters.test.ts (19 tests) 30ms
       ✓ src/core/desk-discovery/evidence.test.ts (17 tests) 351ms
       ✓ src/core/stats.test.ts (12 tests) 28ms
       ✓ src/core/machine-registry/machine-registry.test.ts (18 tests) 66ms
       ✓ src/app/features/plans/helpers/__tests__/check-fixes.test.ts (11 tests) 48ms
       ✓ src/core/run-rows.test.ts (12 tests) 35ms
       ✓ src/app/server/task-log.test.ts (8 tests) 53ms
       ✓ src/app/server/agents/claude-code.test.ts (16 tests) 13ms
       ✓ src/cli/stamp-release.test.ts (5 tests) 4302ms
         ✓ paper-camp stamp-release (CLI) > stamps released: <version> onto every idea the release shipped, run as a real subprocess 2338ms
         ✓ paper-camp stamp-release (CLI) > is idempotent — skips an idea already stamped with that version 355ms
         ✓ paper-camp stamp-release (CLI) > never overwrites an existing stamp with a later version a follow-up commit shipped in 643ms
         ✓ paper-camp stamp-release (CLI) > never stamps an idea whose stored status is dropped 594ms
       ✓ src/core/phase-progress.test.ts (18 tests) 42ms
       ✓ src/vite/proxy.test.ts (7 tests) 498ms
       ✓ src/core/scaffold/scaffold.test.ts (9 tests) 379ms
       ✓ src/app/services/github/corpus.test.ts (8 tests) 127ms
       ✓ src/core/parked-questions.test.ts (8 tests) 66ms
       ✓ src/app/components/layout/status-bar-core.test.tsx (11 tests) 80ms
       ✓ src/core/rate-limit.test.ts (14 tests) 27ms
       ✓ src/app/server/merge-policy.test.ts (8 tests) 201ms
       ✓ src/app/server/agent.opencode-permission.test.ts (1 test) 341ms
         ✓ opencode external_directory permission ask (IDEA-125) > parks the run, records the cause in tasks.log, and resumes on answer 335ms
       ✓ src/app/services/hub.test.ts (22 tests) 15ms
       ✓ src/app/server/routes/content/plans.test.ts (7 tests) 383ms
       ✓ src/app/server/routes/trail.test.ts (7 tests) 592ms
       ✓ src/core/phase-run.test.ts (11 tests) 15ms
       ✓ src/cli/registry-commands.test.ts (4 tests) 12050ms
         ✓ paper-camp scan / ls / rm (CLI) > scan skips a directory with no papercamp/config.json and registers the rest 951ms
         ✓ paper-camp scan / ls / rm (CLI) > ls reports no projects against a fresh registry, then lists what scan added 3206ms
         ✓ paper-camp scan / ls / rm (CLI) > rm removes a registered project and fails for an unknown slug 4232ms
         ✓ paper-camp scan / ls / rm (CLI) > init registers the project, and stays clean if the path is already registered 3637ms
       ✓ src/app/server/pairing.test.ts (11 tests) 44ms
       ✓ src/cli/audit.test.ts (3 tests) 1074ms
         ✓ runAudit > skips a plan whose audited-hash still matches its content, without invoking an agent 390ms
         ✓ runAudit > re-audits and re-stamps a plan whose content changed since its audited-hash was set 358ms
         ✓ runAudit > audits a plan that has never been audited, stamping audited-hash for the first time 307ms
       ✓ src/core/run-order.test.ts (11 tests) 37ms
       ✓ src/core/release-notes.test.ts (5 tests) 721ms
         ✓ resolveReleaseNotes > groups shipped ideas by type, one row per idea, in first-shipped order 396ms
       ✓ src/core/corpus-format.test.ts (11 tests) 162ms
       ✓ src/app/services/github/client.test.ts (9 tests) 47ms
       ✓ src/core/run-stats.test.ts (9 tests) 33ms
       ✓ src/cli/dev-port.test.ts (14 tests) 132ms
       ✓ src/core/doctor/checks/metadata.test.ts (10 tests) 117ms
       ✓ src/app/server/routes/release-notes.test.ts (3 tests) 389ms
       ✓ src/core/doctor/checks/structural.test.ts (9 tests) 85ms
       ✓ src/cli/tunnel.test.ts (10 tests) 144ms
       ✓ src/app/stores/slices/runtime-slice.test.ts (7 tests) 67ms
       ❯ src/app/server/agent-hooks.test.ts (2 tests | 1 failed) 6903ms
         × commitPhase > commits a renamed file without failing git add on the old path 5084ms
           → Test timed out in 5000ms.
      If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
         ✓ annotateFixRun > persists the run stamp to the corpus without committing it 1689ms
       ✓ src/app/server/helpers.test.ts (6 tests) 507ms
         ✓ entityFileInput > writes back the stored order, not the run-order rank overlaid on read 343ms
       ✓ src/app/hooks/use-route-selection.test.ts (12 tests) 28ms
       ✓ src/cli/serve-static.test.ts (5 tests) 281ms
       ✓ src/app/features/plans/helpers/__tests__/effective-status.test.ts (12 tests) 17ms
       ✓ src/app/server/routes/content/ideas.test.ts (3 tests) 74ms
       ✓ src/app/server/routes/services.test.ts (6 tests) 28ms
       ✓ src/app/server/routes/github-device-flow.test.ts (4 tests) 16ms
       ✓ src/app/server/notification-log.test.ts (7 tests) 92ms
       ✓ src/app/server/run-order-pass.test.ts (2 tests) 101ms
       ✓ src/app/server/pr-review-state.test.ts (9 tests) 102ms
       ✓ src/app/features/settings/helpers/__tests__/desk-diff.test.ts (6 tests) 9ms
       ✓ src/core/ci/ci-release.test.ts (8 tests) 20ms
       ✓ src/app/services/github/device-flow.test.ts (6 tests) 18ms
       ✓ src/cli/dev-banner.test.ts (8 tests) 8ms
       ✓ src/cli/release-notes.test.ts (2 tests) 542ms
       ✓ src/app/utils/check-status.test.ts (7 tests) 27ms
       ✓ src/app/server/tailnet-discovery.test.ts (4 tests) 25ms
       ✓ src/app/components/stack-panel/checks-group.test.ts (7 tests) 9ms
       ✓ src/app/features/plans/helpers/__tests__/idea-similarity.test.ts (8 tests) 28ms
       ✓ src/app/server/routes/notifications.test.ts (2 tests) 41ms
       ✓ src/app/components/stack-panel/agent-section.test.ts (12 tests) 11ms
       ✓ src/core/doctor/fix.test.ts (5 tests) 20ms
       ✓ src/app/services/machine-store.test.ts (9 tests) 37ms
       ✓ src/core/thread.test.ts (8 tests) 18ms
       ✓ src/app/server/routes/checks.test.ts (4 tests) 14ms
       ✓ src/core/tailnet.test.ts (7 tests) 147ms
       ✓ src/cli/tailnet-serve.test.ts (7 tests) 45ms
       ✓ src/app/features/plans/helpers/__tests__/completion-gate.test.ts (8 tests) 14ms
       ✓ src/app/services/lazy-page.test.ts (5 tests) 42ms
       ✓ src/app/server/routes/pairing.test.ts (3 tests) 14ms
       ✓ src/core/git-log.test.ts (4 tests) 328ms
       ✓ src/core/notifications.test.ts (6 tests) 15ms
       ✓ src/app/utils/parse-diff.test.ts (7 tests) 12ms
       ✓ src/app/chrome-outside-scroll.guard.test.ts (3 tests) 4ms
       ✓ src/app/server/routes/desk-discovery.test.ts (2 tests) 64ms
       ✓ src/core/serialize/content-hash.test.ts (6 tests) 9ms
       ✓ src/app/server/routes/tailnet-discovery.test.ts (2 tests) 12ms
       ✓ src/app/utils/local-draft-store.test.ts (6 tests) 23ms
       ✓ src/core/doctor/finding.test.ts (4 tests) 36ms
       ✓ src/app/services/machine-connection.test.ts (6 tests) 36ms
       ✓ src/app/inline-styles.guard.test.ts (1 test) 21ms
       ✓ src/app/features/plans/helpers/__tests__/manual-commit.test.ts (9 tests) 12ms
       ✓ src/app/server/desk-discovery.test.ts (6 tests) 32ms
       ✓ src/app/features/plans/helpers/__tests__/can-mark-plan-done.test.ts (7 tests) 8ms
       ✓ src/app/features/plans/helpers/__tests__/review-findings.test.ts (7 tests) 20ms
       ✓ src/app/services/github/identity.test.ts (4 tests) 43ms
       ✓ src/core/serialize/serializer.test.ts (3 tests) 85ms
       ✓ src/core/run-order-file.test.ts (8 tests) 16ms
       ✓ src/app/server/corpus-cache.test.ts (6 tests) 39ms
       ✓ src/app/server/agents/opencode.test.ts (4 tests) 12ms
       ✓ src/app/services/github/config-store.test.ts (5 tests) 23ms
       ✓ src/app/services/module-layer.test.ts (8 tests) 22ms
       ✓ src/app/features/plans/helpers/__tests__/open-questions.test.ts (3 tests) 83ms
       ✓ src/core/parse/desk-schema.test.ts (6 tests) 29ms
       ✓ src/app/hooks/notification-push.test.ts (4 tests) 13ms
       ✓ src/app/services/github/hub-token-store.test.ts (4 tests) 11ms
       ✓ src/core/runtime-reachability.test.ts (7 tests) 5ms
       ✓ src/app/server/capacity-probe.test.ts (2 tests) 140ms
       ✓ src/app/features/plans/helpers/__tests__/rollup-progress.test.ts (5 tests) 23ms
       ✓ src/app/components/stack-panel/services-group.test.ts (6 tests) 13ms
       ✓ src/app/components/empty-state.test.tsx (3 tests) 20ms
       ✓ src/app/utils/check-summary.test.ts (6 tests) 20ms
       ✓ src/app/features/hub/components/remembered-machines-cards.test.tsx (2 tests) 14ms
       ✓ src/app/server/run.test.ts (4 tests) 349ms
       ✓ src/app/features/plans/helpers/__tests__/diff.test.ts (4 tests) 17ms
       ✓ src/app/services/mount.test.ts (4 tests) 31ms
       ✓ src/app/utils/error-summary.test.ts (4 tests) 6ms
       ✓ src/app/features/plans/helpers/__tests__/has-completed-phase.test.ts (3 tests) 20ms
       ✓ src/app/components/stack-panel/shared.test.ts (3 tests) 56ms
       ✓ src/app/utils/path-display.test.ts (2 tests) 10ms
      
      ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      
       FAIL  src/app/server/agent-hooks.test.ts > commitPhase > commits a renamed file without failing git add on the old path
      Error: Test timed out in 5000ms.
      If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
      
       Test Files  1 failed | 135 passed (136)
            Tests  1 failed | 1646 passed (1647)
         Start at  10:01:37
         Duration  311.93s (transform 10.33s, setup 0ms, collect 52.69s, tests 120.60s, environment 124ms, prepare 41.58s)
      
       ELIFECYCLE  Test failed. See above for more details.
      

### Thread
- [x] 2026-09-05 [log] [agent] Run order: Extends the same daemon root/registry contract IDEA-233 lays down and must land before the welcome screen relies on the daemon root answering /api/* with JSON 404 for self-discovery.
