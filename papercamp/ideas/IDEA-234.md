---
id: IDEA-234
title: Daemon-only welcome screen
type: feat
status: review
created: 2026-09-05
updated: 2026-09-07
tags:
  - app
  - cli
  - docs
subject: Multi-project
order: 4
---

The empty hub still offers three doors. `add-project-column.tsx` renders the
Get started card, then Connect GitHub, then Tailnet peers, and the Get started
card itself teaches the per-repo path: `npm install --save-dev`, `npx
paper-camp init`, `npx paper-camp daemon`. Nothing on the screen says the
package is meant to be installed once per machine, and nothing mentions
`scan <dir>`, the command that adopts a folder of repositories in one go.

Worse, the path it teaches ends in a dead end on the machine it runs on.
Verified against the published 0.27.0: the daemon's Local link is a bare
`http://localhost:4333`, and the hub only learns about a machine by following
a `?machine=&token=` link — which the banner prints only for Network,
Tailnet, or Tunnel, and on a laptop without Tailscale prints not at all
("Another device needs an HTTPS address"). Open Local, and the hub served by
the daemon shows an empty registry and a Get started card telling you to
install again. `use-remembered-machines.ts` reads `listMachines()` from
localStorage and nothing else; the daemon serving the page is invisible to
the page.

The daemon becomes the one way in, the hub knows the machine that serves it,
and the GitHub project kind — the plan-only path that let the hub browse a
repo with no runtime at all — is removed rather than hidden.

**Three commands, the global path.** The Get started card prints:

```
npm install -g @dendelion/paper-camp
paper-camp scan ~/dev
paper-camp start
```

with a line under the second explaining that `~/dev` stands for the folder
holding your repositories, and that `paper-camp init` inside a single repo
registers just that one. The third switches to `paper-camp start --tailnet`
when the hub's origin is HTTPS, as it does today. `start` is [[IDEA-233]]'s
detached runner; the card lands after it. The closing line stays: open the
link it prints.

**The serving machine is implicit.** When the app boots with no mount prefix
and `window.location.origin/api/machine/projects` answers JSON, that origin
is a machine — listed first in the add column as *This machine*, ahead of any
remembered machines, without ever being written to `machine-store.ts`. The
same-origin request passes the daemon's Host check the way loopback and LAN
already do, so no token is involved and the bare Local link works as printed.
A project chosen from it persists `<origin>/p/<slug>` like any other machine
project. `servesOwnRuntime` stops relying on the SPA fallback returning HTML:
[[IDEA-235]] makes the daemon root answer `/api/*` with a JSON 404, and the
probe reads that as "no runtime here".

**Only the daemon's cards remain.** The add column renders the Get started
card (registry empty), *This machine*, and the remembered-machine cards.
`github-connect-card.tsx`, `tailnet-peers-card.tsx`, `use-github-connect.ts`,
and `use-tailnet-peers.ts` are deleted. Discovery of other machines is a link
the daemon prints, as [[IDEA-230]] settled; a tailnet peer becomes known by
opening its Tailnet link once.

**The GitHub kind goes with its card.** Every project the hub knows is a
runtime — a `paper-camp dev` origin or a `<machine>/p/<slug>` mount. The
`kind` discriminator leaves `project-registry.ts` along with
`GithubProjectEntry`, `addGithubEntry`, and the `github` branch of
`projectEntryId`; a stored entry of that kind is dropped on parse, since
nothing can open it any more. With no token to read a corpus through the
GitHub API, `services/github/` loses `corpus.ts`, `config-store.ts`,
`client.ts`, `identity.ts`, `device-flow.ts`, and `hub-token-store.ts` —
`ideas-slice.ts`, `plans-slice.ts`, `use-plan-status-patch.ts`, and
`new-idea-button.tsx` keep only their runtime branch. `github-slice.ts`
leaves the store, `main.tsx` stops passing a GitHub flag into
`hasChosenProject`, and the `/api/github/device-flow` route and
`github-device-flow.ts` are removed from the server. Nothing here touches
the `gh`-backed PR and review features, which run on the runtime and never
used this token.

**No plan-only state anywhere.** `runtime-unavailable.tsx` stops offering a
token form: an unreachable runtime says the runtime is unreachable and shows
the command that starts it. `use-runtime-statuses.ts` stamps a row that does
not answer as *Offline*; *Plan-only* disappears from the hub and from
USAGE.md's stamp list.

**The docs say the same thing.** USAGE.md's "Installing into your own
project" and "Adding a project" describe only the global path and the three
commands, and the "Connect GitHub" bullet goes. README.md's Quick Start
addresses a user, not a contributor: the same three commands, with
`pnpm install && pnpm dev` moved under a "Working on Paper Camp" heading.
`paper-camp dev` keeps one sentence as the single-repo foreground mode.

### Out of scope

The daemon's banner wording, unchanged. The server's `gh` CLI integration
for PRs, reviews, and issues, which is the runtime's own GitHub access and
stays exactly as it is. Migrating a stored GitHub-kind entry into anything
else; it is simply forgotten.

### Phases
- [x] Print the three global commands
      Rewrite the Get started card to the global install, `scan ~/dev` with its single-repo note, and `start`, switching to `--tailnet` on an HTTPS origin.
      run: 4m56s · 54 in · 6.9k out · sonnet-5
- [x] Detect the machine that serves the hub
      Probe `origin/api/machine/projects` when there is no mount prefix and list that origin first as *This machine*, never writing it to `machine-store.ts`.
      run: 6m10s · 74 in · 15.5k out · sonnet-5
- [x] Drop the GitHub and Tailnet cards
      Delete `github-connect-card.tsx`, `tailnet-peers-card.tsx`, `use-github-connect.ts` and `use-tailnet-peers.ts`, leaving Get started, *This machine* and remembered machines in the add column.
      run: 5m22s · 50 in · 10.5k out · sonnet-5
- [x] Remove the GitHub project kind
      Take `kind` out of `project-registry.ts`, drop entries of that kind on parse, and cut the GitHub services, `github-slice.ts`, the device-flow route and its callers down to their runtime branch.
      run: 12m15s · 160 in · 48.9k out · sonnet-5
- [x] Replace plan-only with offline
      `runtime-unavailable.tsx` shows the start command instead of a token form, and a row that does not answer stamps *Offline*.
      run: 5m22s · 42 in · 10.1k out · sonnet-5
- [x] Rewrite the install docs
      USAGE.md and README.md teach only the three commands, `paper-camp dev` keeps one sentence as the foreground mode, and the Connect GitHub and Plan-only entries go.
      run: 10m47s · 92 in · 28.3k out · sonnet-5 · ×2

### Fixes
- [ ] Fix the failing "Quality" check
      Fix the failing "Quality" check in this repo.
      
      The command was `pnpm lint`.
      
      Output from the last run:
      
      
      > @dendelion/paper-camp@0.27.0 lint /home/croco/dev/paper-camp
      > biome check . && node scripts/comment-stats.mjs
      
      Checked 625 files in 10s. No fixes applied.
      Comments: 1833 / 42323 lines = 4.33%
      Trailing comment lines (code; // why): 13
      Runs over the 2-line cap: 2 (6 lines)
        src/app/services/project-registry.ts:25 — 3 lines
        src/cli/daemon-lifecycle.ts:303 — 3 lines
       ELIFECYCLE  Command failed with exit code 1.
      
- [ ] Fix the failing "Tests" check
      Fix the failing "Tests" check in this repo.
      
      The command was `pnpm test`.
      
      Output from the last run:
      
      
      > @dendelion/paper-camp@0.27.0 test /home/croco/dev/paper-camp
      > vitest run --coverage
      
      
       RUN  v2.1.9 /home/croco/dev/paper-camp
            Coverage enabled with v8
      
       ✓ src/app/server/agent.test.ts (85 tests) 29597ms
         ✓ startRunAllPhases > commits the corpus via onRunStart before the first phase agent launches (IDEA-137) 350ms
         ✓ startRunAllPhases > resumes a same-run fix pass and the next phase from the running session id 507ms
         ✓ startRunAllPhases > runs fix attempts up to the cap and stops without committing when checks stay red 583ms
         ✓ startRunAllPhases > continues to the next phase when a fix attempt makes checks green 397ms
         ✓ startRunAllPhases > tolerates a check that was already red before the run instead of fixing or failing on it 330ms
         ✓ startRunAllPhases > completes untouched when read-only board helpers launch mid-run (IDEA-126) 395ms
         ✓ startRunAllPhases > Fixes > runs open Fixes after the phases are done without committing, then completes the run 521ms
         ✓ startRunAllPhases > Fixes > leaves the fix pass as one accumulated diff with no per-fix commits 1718ms
         ✓ startRunAllPhases > Fixes > starts a run for open Fixes alone when every phase is already checked 342ms
         ✓ commitPhase scoping (IDEA-190) > commits only the paths the phase changed, leaving other dirty files untouched 6082ms
         ✓ resumeQuestionParkedTasks > re-launches a run-all that parked on a question and clears errorKind 390ms
         ✓ startFixReview > finishes cleanly and maps the agent verdict back to thread ids 418ms
         ✓ startFixReview > accepts a verdict wrapped in a markdown code fence 321ms
         ✓ startFixReview > treats a run that skips every comment as success, not a failure 430ms
         ✓ startFixReview > warns when the agent exits without reporting a verdict 668ms
         ✓ startFixReview > rejects a verdict that omits a thread index 317ms
         ✓ startFixReview > rejects a verdict that lists the same thread as both addressed and skipped 458ms
         ✓ startPrReview > launches a pr-review-kind task and, on completion, durably records the SHA it reviewed 468ms
         ✓ startPrReview > records the SHA even when the agent never reports a parseable verdict 368ms
         ✓ startPrReview > appends the verdict summary as a [review] thread message on the idea 1194ms
         ✓ startPrReview > ends the task as error when a good verdict reaches neither GitHub nor the idea 1420ms
         ✓ startPrReview > gives up and records the SHA after repeated delivery failures on it 3266ms
         ✓ startBatchReconcile / getReconcileQueue > leaves the queue empty when no entity actually drifted 453ms
         ✓ startBatchReconcile / getReconcileQueue > picks up an entity with no stored status override via its derived status 327ms
         ✓ startBatchReconcile / getReconcileQueue > excludes an entity whose stored status is done 313ms
       ✓ src/app/server/git.test.ts (102 tests) 33546ms
         ✓ getBranchHygieneStatus > reports a fresh feature branch at main tip as fine, not stale 586ms
         ✓ getBranchHygieneStatus > reports a fresh feature branch with uncommitted work as dirty, not stale 541ms
         ✓ getBranchHygieneStatus > reports a branch with unmerged local commits as fine 390ms
         ✓ getBranchHygieneStatus > reports stale-merged after a no-ff merge into main (PR-style merge) 663ms
         ✓ getBranchHygieneStatus > reports stale-merged after a ff merge once main advances past the branch 469ms
         ✓ getBranchHygieneStatus > reports stale-merged even when the working tree is dirty 492ms
         ✓ getBranchHygieneStatus > reports stale-merged via origin/main when the local main ref is stale 851ms
         ✓ getBranchHygieneStatus > reports fine for a fresh branch cut from a stale local main 703ms
         ✓ getPhaseStateAtRef > reads a ref other than HEAD, not the working tree 327ms
         ✓ findStaleBaseRef > flags origin/main when local main lags but origin/main is ahead 615ms
         ✓ runGitSync > carries uncommitted and untracked changes onto main 592ms
         ✓ runGitSync > restores staged changes as staged, not just as a working-tree edit 635ms
         ✓ runGitSync > leaves a pre-existing unrelated stash alone 433ms
         ✓ runGitSync > keeps local corpus edits that differ from origin/main, with no generated-file exception 543ms
         ✓ runGitSync > rebases a diverged local main onto origin instead of failing 697ms
         ✓ runGitSync > reports a pop conflict and keeps the changes in the stash 882ms
         ✓ runGitSync > keeps the corpus out of the stash, committing it separately even when the source pop conflicts 1167ms
         ✓ runGitSync > does not create a corpus commit when papercamp/ is already clean 657ms
         ✓ hasPendingSyncStash > is true once a sync pop conflict leaves work stranded in the stash 855ms
         ✓ hasPendingSyncStash > is false again once the sync succeeds and the stash pops cleanly 516ms
         ✓ getStashes > flags a papercamp-sync stash but not a lookalike or a human WIP stash 319ms
         ✓ fixDivergence > rebases a diverged branch onto its remote instead of failing 554ms
         ✓ fixDivergence > reports a conflicted rebase with the conflicted files and a recovery prompt instead of throwing 660ms
         ✓ fixDivergence > reconciles an unpushed feature branch against origin/main, not a nonexistent upstream 808ms
         ✓ getAheadCount > counts commits past the upstream when one is configured 415ms
         ✓ getAheadCount > counts commits missing from every remote-tracking branch when no upstream is set 404ms
         ✓ ensureBranch > branches from main even when currently on another branch 352ms
         ✓ ensureBranch > defaults the branch prefix to feat for an untyped entity 322ms
         ✓ ensureBranch > warns when creating a branch while HEAD is behind local main for this entity 425ms
         ✓ ensureBranch > does not warn when checking out an already-existing branch 327ms
         ✓ verifyDirectCompletion > checks origin/main when it exists, not the possibly-behind local main 436ms
         ✓ returnToMain > checks out main, fast-forwards it, and deletes the branch locally and on the remote 488ms
         ✓ returnToMain > reports remoteDeleted: false without throwing when the remote branch is already gone 421ms
         ✓ returnToMain > is a safe no-op when already on main 374ms
         ✓ commit > commits only the selected files, leaving other changes untouched 352ms
         ✓ commit > commits a staged rename including the old path, not as a copy 320ms
         ✓ commit > treats selected paths literally instead of as glob pathspecs 309ms
       ✓ src/core/git-pr/pr.test.ts (87 tests) 2217ms
       ✓ src/core/parse/parser.test.ts (51 tests) 217ms
       ✓ src/mcp/tools.test.ts (26 tests) 6321ms
         ✓ read tools > list_plans returns per-file plans 599ms
         ✓ read tools > get_plan finds a plan by id and returns null for an unknown id 576ms
         ✓ promote_roadmap_item > rejects an unknown horizon, item, or candidate 324ms
         ✓ promote_thread_message > distills a thread message into an open decision in place 329ms
       ✓ src/cli/daemon-lifecycle.test.ts (37 tests) 23696ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > refuses a second daemon and prints the status line for the one already running 997ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > prints the log and exits 1 when the spawned daemon dies before answering 2145ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > stop reports nothing running and exits 0 when there is no daemon 991ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > stop sends SIGTERM, waits for exit, and removes the state file 961ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > stop escalates to SIGKILL when the daemon ignores SIGTERM, then removes the state file 6283ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > restart stops the running daemon, then attempts to start a new one 1490ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > ls prints "—" for every project when no daemon is running 519ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > ls prints missing in the STATE column and a hint to forget a deleted project 574ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > ls reports "No projects registered." with no daemon running and an empty registry 679ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > ls reports mounted/busy state per project once the daemon answers 964ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > status reports the daemon as not running, then the "—" project table 1009ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > status reports the running daemon block, then the live project table 1052ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs says so and exits 0 when there is no daemon.log yet 1138ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs -f also exits 0 immediately when there is no daemon.log yet 1160ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs defaults to printing the last 50 lines of daemon.log 1097ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs -n limits the printed lines to the requested count 1075ms
         ✓ paper-camp start / stop / restart / status / ls / logs (CLI) > logs -f prints existing content, then follows appended lines until killed 1432ms
      stdout | src/cli/daemon-server.test.ts > createProjectMounter > builds and caches a registered project on first request
      paper-camp: mounted "repo" (/tmp/paper-camp-daemon-project-ZP71QE/repo)
      
      stdout | src/cli/daemon-server.test.ts > createProjectMounter > mounts independent slugs independently
      paper-camp: mounted "alpha" (/tmp/paper-camp-daemon-project-15de5F/alpha)
      
      stdout | src/cli/daemon-server.test.ts > createProjectMounter > mounts independent slugs independently
      paper-camp: mounted "beta" (/tmp/paper-camp-daemon-project-2DNtFQ/beta)
      
      stdout | src/cli/daemon-server.test.ts > createProjectMounter > evicts a mounted project once its folder is gone, then mounts it fresh when restored
      paper-camp: mounted "repo" (/tmp/paper-camp-daemon-project-wXiuub/repo)
      
      stdout | src/cli/daemon-server.test.ts > createProjectMounter > evicts a mounted project once its folder is gone, then mounts it fresh when restored
      paper-camp: mounted "repo" (/tmp/paper-camp-daemon-project-wXiuub/repo)
      
      stdout | src/cli/daemon-server.test.ts > createDaemonRequestHandler > reports a project as mounted after a request has built its middleware
      paper-camp: mounted "demo" (/tmp/paper-camp-daemon-e2e-project-ivNBkx/demo)
      
      stdout | src/cli/daemon-server.test.ts > createDaemonRequestHandler > mounts a registered slug and rewrites the forwarded URL to strip the /p/<slug> prefix
      paper-camp: mounted "demo" (/tmp/paper-camp-daemon-e2e-project-WhrXUY/demo)
      
       ✓ src/cli/daemon-server.test.ts (30 tests) 746ms
       ✓ src/app/server/routes/agent.test.ts (13 tests) 985ms
       ✓ src/core/roadmap.test.ts (38 tests) 104ms
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
      
       ✓ src/core/readers.test.ts (20 tests) 1178ms
       ✓ src/core/parse/frontmatter.test.ts (32 tests) 158ms
       ✓ src/app/server/capabilities.test.ts (39 tests) 192ms
       ✓ src/app/features/plans/prompts/__tests__/prompts.test.ts (25 tests) 41ms
       ✓ src/app/server/pr-review-settle.test.ts (24 tests) 257ms
       ✓ src/app/features/plans/helpers/__tests__/plan-list-selector.test.ts (30 tests) 56ms
       ✓ src/app/server/prioritise.test.ts (16 tests) 1062ms
       ✓ src/core/trail.test.ts (19 tests) 1877ms
         ✓ resolveEntityTrail > resolves branch commits ahead of main for the entity 318ms
         ✓ resolveIdeasForRelease > joins every commit in the range to the idea it served 320ms
       ✓ src/core/issues.test.ts (23 tests) 63ms
       ✓ src/core/parse/entity.test.ts (15 tests) 383ms
       ✓ src/app/server/routes/agent-login-relay.test.ts (9 tests) 506ms
       ✓ src/app/server/login-relay.test.ts (14 tests) 1352ms
         ✓ startClaudeLoginRelay > gives up polling after the timeout without calling onLoginConfirmed 333ms
       ✓ src/core/status/status.test.ts (40 tests) 24ms
       ✓ src/app/server/feedback-reply.test.ts (22 tests) 21ms
       ✓ src/app/services/runtime-connection.test.ts (19 tests) 80ms
       ✓ src/app/server/api.test.ts (19 tests) 66ms
       ✓ src/vite/index.test.ts (12 tests) 95ms
       ✓ src/core/daemon-state/daemon-state.test.ts (14 tests) 340ms
       ✓ src/cli/registration-link.test.ts (19 tests) 58ms
       ✓ src/core/run-filters.test.ts (19 tests) 76ms
       ✓ src/core/desk-discovery/evidence.test.ts (17 tests) 619ms
       ✓ src/core/stats.test.ts (12 tests) 42ms
       ✓ src/core/machine-registry/machine-registry.test.ts (18 tests) 206ms
       ✓ src/app/services/project-registry.test.ts (17 tests) 27ms
       ✓ src/app/features/plans/helpers/__tests__/check-fixes.test.ts (11 tests) 22ms
       ✓ src/core/run-rows.test.ts (12 tests) 38ms
       ✓ src/app/server/task-log.test.ts (8 tests) 41ms
       ✓ src/app/server/agents/claude-code.test.ts (16 tests) 40ms
       ✓ src/cli/stamp-release.test.ts (5 tests) 2316ms
         ✓ paper-camp stamp-release (CLI) > stamps released: <version> onto every idea the release shipped, run as a real subprocess 1475ms
       ✓ src/app/services/hub.test.ts (24 tests) 33ms
       ✓ src/core/phase-progress.test.ts (18 tests) 30ms
       ✓ src/vite/proxy.test.ts (7 tests) 235ms
       ✓ src/core/scaffold/scaffold.test.ts (9 tests) 270ms
       ✓ src/core/parked-questions.test.ts (8 tests) 91ms
       ✓ src/app/components/layout/status-bar-core.test.tsx (11 tests) 40ms
       ✓ src/core/rate-limit.test.ts (14 tests) 20ms
       ✓ src/app/server/merge-policy.test.ts (8 tests) 162ms
       ✓ src/app/server/agent.opencode-permission.test.ts (1 test) 357ms
         ✓ opencode external_directory permission ask (IDEA-125) > parks the run, records the cause in tasks.log, and resumes on answer 349ms
       ✓ src/app/server/routes/content/plans.test.ts (7 tests) 315ms
       ✓ src/app/server/routes/trail.test.ts (7 tests) 720ms
       ✓ src/core/phase-run.test.ts (11 tests) 34ms
       ❯ src/cli/registry-commands.test.ts (4 tests | 1 failed) 11948ms
         ✓ paper-camp scan / ls / rm (CLI) > scan skips a directory with no papercamp/config.json and registers the rest 941ms
         ✓ paper-camp scan / ls / rm (CLI) > ls reports no projects against a fresh registry, then lists what scan added 2365ms
         ✓ paper-camp scan / ls / rm (CLI) > rm removes a registered project and fails for an unknown slug 3542ms
         × paper-camp scan / ls / rm (CLI) > init registers the project, and stays clean if the path is already registered 5062ms
           → Test timed out in 5000ms.
      If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
       ✓ src/app/server/pairing.test.ts (11 tests) 87ms
       ✓ src/cli/audit.test.ts (3 tests) 1448ms
         ✓ runAudit > skips a plan whose audited-hash still matches its content, without invoking an agent 366ms
         ✓ runAudit > re-audits and re-stamps a plan whose content changed since its audited-hash was set 574ms
         ✓ runAudit > audits a plan that has never been audited, stamping audited-hash for the first time 457ms
       ✓ src/core/run-order.test.ts (11 tests) 80ms
       ✓ src/core/release-notes.test.ts (5 tests) 710ms
         ✓ resolveReleaseNotes > groups shipped ideas by type, one row per idea, in first-shipped order 392ms
       ✓ src/core/corpus-format.test.ts (11 tests) 112ms
       ✓ src/core/run-stats.test.ts (9 tests) 35ms
       ✓ src/cli/dev-port.test.ts (14 tests) 95ms
       ✓ src/core/doctor/checks/metadata.test.ts (10 tests) 150ms
       ✓ src/app/server/routes/release-notes.test.ts (3 tests) 219ms
       ✓ src/core/doctor/checks/structural.test.ts (9 tests) 76ms
       ✓ src/cli/tunnel.test.ts (10 tests) 89ms
       ✓ src/app/stores/slices/runtime-slice.test.ts (7 tests) 68ms
       ✓ src/app/server/agent-hooks.test.ts (2 tests) 2565ms
         ✓ commitPhase > commits a renamed file without failing git add on the old path 2266ms
       ✓ src/app/server/helpers.test.ts (6 tests) 93ms
       ✓ src/app/hooks/use-route-selection.test.ts (12 tests) 20ms
       ✓ src/cli/serve-static.test.ts (5 tests) 300ms
       ✓ src/app/features/plans/helpers/__tests__/effective-status.test.ts (12 tests) 15ms
       ✓ src/app/server/routes/content/ideas.test.ts (3 tests) 73ms
       ✓ src/app/server/routes/services.test.ts (6 tests) 20ms
       ✓ src/app/server/notification-log.test.ts (7 tests) 70ms
       ✓ src/app/server/run-order-pass.test.ts (2 tests) 151ms
       ✓ src/app/server/pr-review-state.test.ts (9 tests) 85ms
       ✓ src/app/features/settings/helpers/__tests__/desk-diff.test.ts (6 tests) 13ms
       ✓ src/core/ci/ci-release.test.ts (8 tests) 15ms
       ✓ src/cli/dev-banner.test.ts (8 tests) 9ms
       ✓ src/cli/release-notes.test.ts (2 tests) 520ms
       ✓ src/app/utils/check-status.test.ts (7 tests) 25ms
       ✓ src/app/server/tailnet-discovery.test.ts (4 tests) 33ms
       ✓ src/app/components/stack-panel/checks-group.test.ts (7 tests) 13ms
       ✓ src/app/features/plans/helpers/__tests__/idea-similarity.test.ts (8 tests) 21ms
       ✓ src/app/server/routes/notifications.test.ts (2 tests) 45ms
       ✓ src/app/components/stack-panel/agent-section.test.ts (12 tests) 12ms
       ✓ src/core/doctor/fix.test.ts (5 tests) 7ms
       ✓ src/app/services/machine-store.test.ts (9 tests) 28ms
       ✓ src/core/thread.test.ts (8 tests) 9ms
       ✓ src/app/server/routes/checks.test.ts (4 tests) 12ms
       ✓ src/core/tailnet.test.ts (7 tests) 206ms
       ✓ src/cli/tailnet-serve.test.ts (7 tests) 181ms
       ✓ src/app/features/plans/helpers/__tests__/completion-gate.test.ts (8 tests) 27ms
       ✓ src/app/services/lazy-page.test.ts (5 tests) 54ms
       ✓ src/app/server/routes/pairing.test.ts (3 tests) 11ms
       ✓ src/core/git-log.test.ts (4 tests) 535ms
       ✓ src/core/notifications.test.ts (6 tests) 10ms
       ✓ src/app/utils/parse-diff.test.ts (7 tests) 19ms
       ✓ src/app/chrome-outside-scroll.guard.test.ts (3 tests) 18ms
       ✓ src/app/server/routes/desk-discovery.test.ts (2 tests) 33ms
       ✓ src/core/serialize/content-hash.test.ts (6 tests) 13ms
       ✓ src/app/server/routes/tailnet-discovery.test.ts (2 tests) 46ms
       ✓ src/app/utils/local-draft-store.test.ts (6 tests) 48ms
       ✓ src/core/doctor/finding.test.ts (4 tests) 17ms
       ✓ src/app/services/machine-connection.test.ts (6 tests) 13ms
       ✓ src/app/inline-styles.guard.test.ts (1 test) 44ms
       ✓ src/app/features/plans/helpers/__tests__/manual-commit.test.ts (9 tests) 21ms
       ✓ src/app/server/desk-discovery.test.ts (6 tests) 22ms
       ✓ src/app/features/plans/helpers/__tests__/can-mark-plan-done.test.ts (7 tests) 6ms
       ✓ src/app/features/plans/helpers/__tests__/review-findings.test.ts (7 tests) 16ms
       ✓ src/core/serialize/serializer.test.ts (3 tests) 71ms
       ✓ src/core/run-order-file.test.ts (8 tests) 10ms
       ✓ src/app/server/corpus-cache.test.ts (6 tests) 33ms
       ✓ src/app/server/agents/opencode.test.ts (4 tests) 9ms
       ✓ src/app/services/module-layer.test.ts (8 tests) 12ms
       ✓ src/app/features/plans/helpers/__tests__/open-questions.test.ts (3 tests) 42ms
       ✓ src/core/parse/desk-schema.test.ts (6 tests) 18ms
       ✓ src/app/hooks/notification-push.test.ts (4 tests) 20ms
       ✓ src/core/runtime-reachability.test.ts (7 tests) 15ms
       ✓ src/app/server/capacity-probe.test.ts (2 tests) 35ms
       ✓ src/app/features/plans/helpers/__tests__/rollup-progress.test.ts (5 tests) 24ms
       ✓ src/app/components/stack-panel/services-group.test.ts (6 tests) 9ms
       ✓ src/app/components/empty-state.test.tsx (3 tests) 14ms
       ✓ src/app/utils/check-summary.test.ts (6 tests) 8ms
       ✓ src/app/features/hub/components/remembered-machines-cards.test.tsx (2 tests) 16ms
       ✓ src/app/server/run.test.ts (4 tests) 305ms
       ✓ src/app/features/plans/helpers/__tests__/diff.test.ts (4 tests) 22ms
       ✓ src/app/services/mount.test.ts (4 tests) 9ms
       ✓ src/app/utils/error-summary.test.ts (4 tests) 4ms
       ✓ src/app/features/plans/helpers/__tests__/has-completed-phase.test.ts (3 tests) 8ms
       ✓ src/app/components/stack-panel/shared.test.ts (3 tests) 39ms
       ✓ src/app/utils/path-display.test.ts (2 tests) 5ms
      
      ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      
       FAIL  src/cli/registry-commands.test.ts > paper-camp scan / ls / rm (CLI) > init registers the project, and stays clean if the path is already registered
      Error: Test timed out in 5000ms.
      If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
      
       Test Files  1 failed | 128 passed (129)
            Tests  1 failed | 1603 passed (1604)
         Start at  15:36:44
         Duration  313.73s (transform 8.54s, setup 0ms, collect 52.09s, tests 132.31s, environment 86ms, prepare 40.66s)
      
       ELIFECYCLE  Test failed. See above for more details.
      

### Thread
- [x] 2026-09-05 [log] [agent] Run order: Depends on IDEA-233's start/scan commands and IDEA-235's daemon-root JSON contract for same-origin machine detection, so it must follow both.
