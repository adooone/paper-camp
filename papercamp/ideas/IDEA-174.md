---
id: IDEA-174
title: Show a running PR review in the UI
type: feat
status: review
created: 2026-08-14
updated: 2026-08-14
tags:
  - app
  - ui
  - agent
subject: Richer review loop
---

A `pr-review` task is invisible *as a review* while it runs. It takes two to
three minutes, and the only surface that says what it is is `/tasks`.

**Already true.** `pr-review` tasks are ordinary agent tasks, so they appear in
`/api/agent/status`, in the Stack panel's Agent section, and on the Tasks page —
which is the one place that labels them, via `'pr-review': 'PR review'` in
`tasks-page.tsx`.

**The gap.** `taskSubtitle` in `agent-section.tsx` covers thirteen task kinds
and has no `pr-review` case, so it falls through to `default: return ''`. In the
Stack panel a running review renders as *"Review pull requests with a local
agent · Claude Code"* — the plan title and the agent, with nothing saying a
review is underway. It reads exactly like a phase run on the same idea.

Add the case, carrying the PR number the task already holds: ` — reviewing PR
#153`.

**Where it actually belongs.** The Stack panel is ambient agent activity and
that fix is one line. But "is my PR being reviewed?" is a question asked while
looking at the idea, so the state belongs on `pr-badge.tsx`, which already shows
the PR number and its draft/open/merged state. It gains a reviewing state while
a `pr-review` task is running for that entity, and afterwards reflects that a
review landed — both signals already exist (the `[review]` thread message on the
idea, and the PR's own review count).

This matters more than for other task kinds because a review fires from a
60-second poll rather than a button. Nobody presses anything, so the badge is
the only place a user would learn it started; without it the first signal is a
finished review appearing on GitHub minutes later.

**Out of scope.** A manual "review now" button — the trigger stays automatic
([[IDEA-170]]). Streaming the reviewer's partial output anywhere but the Tasks
page.

### Phases
- [x] Subtitle a running review in the Stack panel
      Add the `pr-review` case to `taskSubtitle` in `agent-section.tsx`, reading the PR number off the task.
      run: 2m24s · 6k in · 5.5k out · sonnet-5
- [x] Detect a review running for the current entity
      Match an in-flight `pr-review` task from `/api/agent/status` to the idea `pr-badge.tsx` renders on.
      run: 1m41s · 516 in · 4.9k out · sonnet-5
- [x] Add a reviewing state to `pr-badge.tsx`
      Show it alongside the existing draft/open/merged states while a review is in flight.
      run: 4m29s · 883 in · 9k out · sonnet-5
- [x] Reflect a landed review on the badge
      After the task settles, surface it from the `[review]` thread message and the PR's review count.
      run: 3m22s · 801 in · 12.8k out · sonnet-5
- [x] [manual] Dedupe review badge and fix concurrent-task review detection

### Fixes
- [x] Trigger the PR review by hand, not by poll
      Drop the `triggerPrReviews` call from `pollOpenPrs` (the poll itself stays — derived status needs fresh PR state) along with its branch/CI/SHA gates. Add `POST /api/agent/launch-pr-review` taking `planId` and building the prompt server-side like `launch-fix-review`, plus a "Review PR" `ListItem` in `PlanActionsColumn` beside `FixReviewButton`, enabled on an open PR + authenticated `gh` + a configured agent.
      run: 7m31s · 7k in · 20.7k out · sonnet-5
- [x] Demote the reviewed-SHA ledger to a label
      With no poller there is no relaunch to prevent, so `pr-reviews.json` stops gating and only labels the action — "Review PR", or "Review again — last reviewed at abc1234" when the head SHA already has one. CI-green and ready-for-review become advisory too: show the state next to the button rather than disabling it.
      run: 7m37s · 5.1k in · 22.3k out · sonnet-5
- [ ] Fix the failing "Tests" check
      Fix the failing "Tests" check in this repo.
      
      The command was `npx vitest run --passWithNoTests`.
      
      Output from the last run:
      
      
       RUN  v2.1.9 /home/croco/dev/paper-camp
      
       ✓ src/app/server/agent.test.ts (77 tests) 16265ms
         ✓ startRunAllPhases > completes untouched when read-only board helpers launch mid-run (IDEA-126) 404ms
         ✓ write-set collision gate > admits a disjoint entity-writer while one is running, but rejects same-entity and exclusive launches 612ms
         ✓ write-set collision gate > rejects a launch colliding with an older running task, not just the most recently launched one 617ms
         ✓ startGitSyncRecovery > launches a sync-kind task carrying the recovery prompt, and blocks a second launch while it runs 462ms
         ✓ startResolveConflict > launches a resolve-conflict-kind task carrying the prompt, and blocks a second launch while it runs 453ms
         ✓ resumeAuthParkedTasks > keeps a second parked task eligible for retry when the write-set gate blocks its relaunch 719ms
         ✓ startFixReview > finishes cleanly and maps the agent verdict back to thread ids 345ms
         ✓ startFixReview > accepts a verdict wrapped in a markdown code fence 367ms
         ✓ startFixReview > treats a run that skips every comment as success, not a failure 435ms
         ✓ startFixReview > warns when the agent exits without reporting a verdict 412ms
         ✓ startPrReview > appends the verdict summary as a [review] thread message on the idea 1841ms
         ✓ startPrReview > ends the task as error when a good verdict reaches neither GitHub nor the idea 847ms
         ✓ startPrReview > gives up and records the SHA after repeated delivery failures on it 2189ms
         ✓ startPrReview > blocks a second launch while one is running (exclusive, worktree-touching) 522ms
       ✓ src/core/git-pr/pr.test.ts (79 tests) 684ms
       ✓ src/app/server/git.test.ts (66 tests) 11183ms
         ✓ getBranchHygieneStatus > reports stale-merged even when the working tree is dirty 473ms
         ✓ getBranchHygieneStatus > reports stale-merged via origin/main when the local main ref is stale 335ms
         ✓ getBranchHygieneStatus > reports fine for a fresh branch cut from a stale local main 405ms
         ✓ runGitSync > keeps a local run-order.md edit that differs from origin/main, unlike the generated ideas index 546ms
         ✓ runGitSync > rebases a diverged local main onto origin instead of failing 490ms
         ✓ runGitSync > reports a pop conflict and keeps the changes in the stash 364ms
         ✓ fixDivergence > reconciles an unpushed feature branch against origin/main, not a nonexistent upstream 538ms
         ✓ getAheadCount > counts commits missing from every remote-tracking branch when no upstream is set 319ms
       ✓ src/mcp/tools.test.ts (30 tests) 6818ms
         ✓ branch-conflict guard > rejects draft_plan while the current branch has an unfinished plan of its own 421ms
         ✓ branch-conflict guard > allows update_phase to advance the branch's own active plan 320ms
         ✓ branch-conflict guard > rejects update_phase on a different plan while the branch has an unfinished plan of its own 484ms
         ✓ append tools > append_decision and append_note write open (unchecked) thread entries 354ms
         ✓ append tools > append_clarification writes a clarification entry 352ms
         ✓ promote_suggestion > mints an idea from a suggestion line and removes that line 386ms
         ✓ branch-conflict guard on the full write surface > rejects add_idea while the branch has an unfinished plan of its own 312ms
         ✓ branch-conflict guard on the full write surface > rejects promote_suggestion while the branch has an unfinished plan of its own 307ms
         ✓ branch-conflict guard on the full write surface > rejects a mutation on a different plan but allows it on the branch owner 350ms
       ✓ src/core/parse/parser.test.ts (47 tests) 69ms
       ✓ src/core/roadmap.test.ts (38 tests) 27ms
       ✓ src/core/readers.test.ts (18 tests) 380ms
       ✓ src/app/server/routes/agent.test.ts (9 tests) 1422ms
         ✓ POST /api/agent/feedback-message auto-launching fixes > does not auto-launch when another plan owns the current branch 326ms
       ✓ src/core/parse/frontmatter.test.ts (29 tests) 69ms
       ✓ src/app/features/plans/prompts/__tests__/prompts.test.ts (23 tests) 15ms
       ✓ src/app/server/pr-review-settle.test.ts (22 tests) 453ms
       ✓ src/app/features/plans/helpers/__tests__/plan-list-selector.test.ts (27 tests) 17ms
       ✓ src/core/trail.test.ts (19 tests) 650ms
       ✓ src/app/server/capabilities.test.ts (28 tests) 17ms
       ✓ src/core/parse/entity.test.ts (13 tests) 74ms
       ✓ src/core/stats.test.ts (15 tests) 36ms
       ✓ src/vite/index.test.ts (12 tests) 70ms
       ✓ src/app/server/feedback-reply.test.ts (20 tests) 14ms
       ✓ src/app/server/login-relay.test.ts (12 tests) 1057ms
         ✓ startClaudeLoginRelay > gives up polling after the timeout without calling onLoginConfirmed 332ms
       ✓ src/app/server/routes/agent-login-relay.test.ts (6 tests) 229ms
       ✓ src/app/server/task-log.test.ts (8 tests) 31ms
       ✓ src/core/status/status.test.ts (26 tests) 10ms
       ✓ src/core/phase-progress.test.ts (18 tests) 19ms
       ✓ src/vite/proxy.test.ts (7 tests) 97ms
       ✓ src/app/features/plans/helpers/__tests__/check-fixes.test.ts (10 tests) 10ms
       ✓ src/core/parked-questions.test.ts (8 tests) 42ms
       ✓ src/app/server/agent.opencode-permission.test.ts (1 test) 169ms
       ✓ src/app/server/prioritise.test.ts (5 tests) 132ms
       ✓ src/app/server/merge-policy.test.ts (8 tests) 69ms
       ✓ src/app/components/shell/status-bar-core.test.tsx (11 tests) 13ms
       ✓ src/cli/stamp-release.test.ts (5 tests) 5387ms
         ✓ paper-camp stamp-release (CLI) > stamps released: <version> onto every idea the release shipped 832ms
         ✓ paper-camp stamp-release (CLI) > is idempotent — skips an idea already stamped with that version 1500ms
         ✓ paper-camp stamp-release (CLI) > never overwrites an existing stamp with a later version a follow-up commit shipped in 1515ms
         ✓ paper-camp stamp-release (CLI) > never stamps an idea whose stored status is dropped 785ms
         ✓ paper-camp stamp-release (CLI) > fails when the CHANGELOG has no range for the requested version 732ms
       ✓ src/app/server/routes/trail.test.ts (7 tests) 410ms
       ✓ src/core/phase-run.test.ts (11 tests) 9ms
       ✓ src/core/release-notes.test.ts (5 tests) 286ms
       ✓ src/cli/audit.test.ts (3 tests) 2476ms
         ✓ paper-camp audit (CLI) > skips a plan whose audited-hash still matches its content, without invoking an agent 757ms
         ✓ paper-camp audit (CLI) > re-audits and re-stamps a plan whose content changed since its audited-hash was set 893ms
         ✓ paper-camp audit (CLI) > audits a plan that has never been audited, stamping audited-hash for the first time 818ms
       ✓ src/core/run-order.test.ts (10 tests) 21ms
       ✓ src/app/server/routes/release-notes.test.ts (3 tests) 280ms
       ✓ src/core/doctor/checks/structural.test.ts (9 tests) 85ms
       ✓ src/app/server/routes/services.test.ts (6 tests) 15ms
       ✓ src/cli/dev-port.test.ts (12 tests) 39ms
       ✓ src/app/utils/check-status.test.ts (9 tests) 14ms
       ✓ src/app/features/plans/helpers/__tests__/effective-status.test.ts (12 tests) 15ms
       ✓ src/app/server/notification-log.test.ts (7 tests) 116ms
       ✓ src/app/server/run-order-pass.test.ts (2 tests) 87ms
       ✓ src/app/server/agents/claude-code.test.ts (9 tests) 10ms
       ✓ src/app/server/pr-review-state.test.ts (9 tests) 24ms
       ✓ src/core/ci/ci-release.test.ts (8 tests) 7ms
       ✓ src/core/doctor/checks/metadata.test.ts (7 tests) 35ms
       ✓ src/app/features/plans/helpers/__tests__/idea-similarity.test.ts (8 tests) 9ms
       ✓ src/app/server/routes/notifications.test.ts (2 tests) 52ms
       ✓ src/core/doctor/fix.test.ts (5 tests) 8ms
       ✓ src/cli/release-notes.test.ts (2 tests) 2127ms
         ✓ paper-camp release-notes (CLI) > prints release notes grouped by idea 884ms
         ✓ paper-camp release-notes (CLI) > fails when the CHANGELOG has no range for the requested version 1202ms
       ✓ src/core/thread.test.ts (8 tests) 9ms
       ✓ src/app/server/routes/checks.test.ts (4 tests) 8ms
       ✓ src/app/server/api.test.ts (8 tests) 56ms
       ✓ src/core/git-log.test.ts (4 tests) 198ms
       ✓ src/core/notifications.test.ts (6 tests) 22ms
       ✓ src/app/hooks/use-route-selection.test.ts (8 tests) 7ms
       ✓ src/core/serialize/content-hash.test.ts (6 tests) 6ms
       ✓ src/app/utils/parse-diff.test.ts (7 tests) 8ms
       ✓ src/core/doctor/finding.test.ts (4 tests) 13ms
       ✓ src/app/chrome-outside-scroll.guard.test.ts (3 tests) 4ms
       ✓ src/app/features/plans/helpers/__tests__/manual-commit.test.ts (9 tests) 8ms
       ✓ src/app/inline-styles.guard.test.ts (1 test) 73ms
       ✓ src/app/features/plans/helpers/__tests__/review-findings.test.ts (7 tests) 12ms
       ✓ src/core/run-order-file.test.ts (8 tests) 34ms
       ✓ src/core/scaffold/scaffold.test.ts (2 tests) 37ms
       ✓ src/app/server/agents/opencode.test.ts (4 tests) 12ms
       ✓ src/app/features/plans/helpers/__tests__/open-questions.test.ts (3 tests) 18ms
       ✓ src/app/features/plans/helpers/__tests__/can-mark-plan-done.test.ts (5 tests) 5ms
       ✓ src/core/parse/desk-schema.test.ts (6 tests) 13ms
       ✓ src/app/hooks/notification-push.test.ts (4 tests) 6ms
       ✓ src/app/features/plans/helpers/__tests__/rollup-progress.test.ts (5 tests) 34ms
       ✓ src/core/serialize/serializer.test.ts (2 tests) 27ms
       ✓ src/app/server/corpus-cache.test.ts (4 tests) 9ms
       ✓ src/app/utils/check-summary.test.ts (6 tests) 7ms
       ✓ src/app/features/plans/helpers/__tests__/diff.test.ts (4 tests) 10ms
       ✓ src/core/rate-limit.test.ts (4 tests) 6ms
       ✓ src/app/services/mount.test.ts (4 tests) 19ms
       ✓ src/app/utils/error-summary.test.ts (4 tests) 8ms
      
      ⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯
      
      Vitest caught 1 unhandled error during the test run.
      This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
       Test Files  80 passed (80)
            Tests  983 passed (983)
           Errors  1 error
         Start at  17:13:25
         Duration  101.65s (transform 2.71s, setup 0ms, collect 14.44s, tests 52.33s, environment 23ms, prepare 11.36s)
      
      
      ⎯⎯⎯⎯⎯ Uncaught Exception ⎯⎯⎯⎯⎯
      Error: write EPIPE
       ❯ afterWriteDispatched node:internal/stream_base_commons:159:15
       ❯ writeGeneric node:internal/stream_base_commons:150:3
       ❯ Socket._writeGeneric node:net:971:11
       ❯ Socket._write node:net:983:8
       ❯ writeOrBuffer node:internal/streams/writable:572:12
       ❯ _write node:internal/streams/writable:501:10
       ❯ Socket.Writable.end node:internal/streams/writable:823:17
       ❯ Socket.end node:net:742:31
       ❯ src/core/git-pr/pr-lookup.ts:317:17
          315|     );
          316|     proc.on('error', (err) => resolve({ delivered: false, body: err.me…
          317|     proc.stdin?.end(JSON.stringify(payload));
             |                 ^
          318|   });
          319| }
      
      ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
      Serialized Error: { errno: -32, code: 'EPIPE', syscall: 'write' }
      This error originated in "src/core/git-pr/pr.test.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
      The latest test that might've caused the error is "resolves not-delivered with the response body when gh fails — no Actions, a fork, or offline". It might mean one of the following:
      - The error was thrown, while Vitest was running this test.
      - If the error occurred after the test had been completed, this was the last documented test before it was thrown.
      
      

### Thread
- [x] 2026-08-14 [review] [agent] Comments · 2 findings — The diff delivers all four phases: the Stack-panel subtitle reads the PR number off a new `prReviewUrl` task field (plumbed through `agent.ts` and the `AgentTaskState` type), `pr-badge.tsx` gains a spinner reviewing state, and the trail surfaces the landed signal via `latestReviewNote` and `ReviewSignalBadge`. The core behavior matches the spec and the tests are solid. The main issue is that the landed-review badge is now rendered in two places on the same entity view, producing a visible duplicate.
- [x] 2026-08-14 [review] [agent] Comments · 2 findings — The UI wiring is clean and delivers the badge reviewing state, the landed-review signal, and the Stack subtitle case, with solid helper tests. The main gap is that the new `prReviewUrl` field is read in two places but never populated anywhere in the diff, so the PR number that phase 1 promises to carry into the Stack subtitle will never actually render — it always degrades to the numberless fallback. Detection and the badge itself work regardless since they key off `taskKind`/`planId`, so the feature is largely functional.
- [x] 2026-08-14 [review] [agent] Comments · 2 findings — The UI wiring is clean and delivers the badge reviewing state, the landed-review signal, and the Stack subtitle case, with solid helper tests. The main gap is that the new `prReviewUrl` field is read in two places but never populated anywhere in the diff, so the PR number that phase 1 promises to carry into the Stack subtitle will never actually render — it always degrades to the numberless fallback. Detection and the badge itself work regardless since they key off `taskKind`/`planId`, so the feature is largely functional.
- [x] 2026-08-14 [review] [agent] Approves · 0 findings — The diff cleanly delivers all five phases: the Stack subtitle reads the PR number off prReviewUrl (which is already populated server-side by startPrReview, contrary to the earlier review threads that saw only the diff), pr-badge gains a spinner reviewing state, and the landed-review signal is deduped by removing ReviewSignalBadge from BranchRow and rendering it once in the provenance trail. Detection keys off taskKind/planId and correctly suppresses the landed badge while a review is in flight. Logic and tests are solid and spec-conformant.
- [x] 2026-08-14 [review] [agent] Approves · 0 findings — The diff cleanly delivers all five phases: the Stack subtitle reads the PR number off prReviewUrl (which is already populated server-side by startPrReview, contrary to the earlier review threads that saw only the diff), pr-badge gains a spinner reviewing state, and the landed-review signal is deduped by removing ReviewSignalBadge from BranchRow and rendering it once in the provenance trail. Detection keys off taskKind/planId and correctly suppresses the landed badge while a review is in flight. Logic and tests are solid and spec-conformant.
- [x] 2026-08-14 [question] [agent] Run-all parked on fix 1 ("Guard `startPrReview` with `admit()`") — the agent needs a decision: `startPrReview` already goes through `launch()`, which unconditionally calls `admit()` before spawning (src/app/server/agent.ts:781), and there's already a passing test for exactly this collision (`agent.test.ts:1571`, "blocks a second launch while one is running"). I can't find any code path where `startPrReview` bypasses the gate. Should I mark this fix's checkbox as done since the guard is already in place, or is there a different bypass you have in mind that I'm missing?
- [x] 2026-08-14 [clarification] You are right and the fix was wrong — dropped. `launch()` calls `admit(scope.taskKind, planId)` unconditionally at agent.ts:781, so `startPrReview` is gated like every other launcher; the explicit `admit()` calls in `startBatchReconcile`/`startSuggest` are redundant belt-and-braces, not the only gate. The three reviews on PR #156 were not concurrent: tasks.log shows 14:31:38→14:33:16 then 14:33:22→14:34:42, so the gate had nothing to block. The poll simply relaunched after each task finished, because the reviewed-SHA ledger only records once a posted Scout review is observed. The remaining two fixes cover it.
- [x] 2026-08-14 [review] [agent] Comments · 1 finding — The diff cleanly delivers all five phases plus the two settled fixes: the Stack subtitle reads the PR number off the now-surfaced prReviewUrl task field, pr-badge gains a spinner reviewing state, the landed-review signal is deduped down to a single ReviewSignalBadge in the provenance trail, and the auto-poll trigger is replaced by a manual Review PR button with the ledger demoted to an advisory label — matching the idea's amended Fixes section and not contradicting any settled decision. Logic and helper tests are solid and the prReviewUrl population the earlier threads worried about is real (agent.ts:859). One behavioral side-effect and a couple of now-stale references are worth a human glance but nothing blocks merge.
- [x] 2026-08-14 [review] [agent] Comments · 1 finding — The diff delivers all five phases plus both settled fixes: the Stack subtitle reads the PR number off the now-populated prReviewUrl task field, pr-badge gains a spinner reviewing state, the landed-review signal is deduped to a single ReviewSignalBadge in the provenance trail, and the auto-poll trigger is replaced by a manual Review PR button with the reviewed-SHA ledger demoted to an advisory label — none of which contradicts the settled decision that the admit() gate was already sufficient. The logic and helper tests are solid and the earlier threads' worry about prReviewUrl never being populated is resolved in the final state. One behavioral side-effect of the dedup is worth a human glance but nothing blocks merge.
