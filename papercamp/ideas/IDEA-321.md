---
id: IDEA-321
title: Run the queue
type: feat
status: review
created: 2026-10-29
updated: 2026-10-29
tags:
  - run
  - app
  - git
  - multi-project
needs:
  - IDEA-319
  - IDEA-320
subject: Run & monitor
---

Today an idea runs one at a time. *Run all phases* (`/api/agent/launch-run-all`,
`startRunAllPhases` in `src/app/server/agent.ts`) takes one plan through its
unchecked phases, then its Fixes, then the checks and a fix loop, and sets
`status: review`. To get through a queue of five planned ideas, the user has
to come back after each one and press the button again. The night shift
(`src/core/night-shift.ts`) runs unattended, but it only reviews code chunks.
It never builds ideas.

The pieces for a queue already exist:

- **The order.** `papercamp/run-order.md` lists every idea whose derived
  status is `planned`, `in-progress` or `review` and whose `needs:` are met
  (`normalizeRunOrder`, `runRunOrderPass`). The worklist shows the position
  as the `#` stamp (`RowMarker`). *Prioritise* reorders it, and so does
  dragging the `#` column.
- **A batch loop.** `runBatch` (`BatchKind = 'batch-reconcile' |
  'batch-draft'`) walks a list of entities with one agent at a time, counts
  done, skipped and failed, and stops on *Stop*. It never runs phases.
- **A per-idea runner.** `startRunAllPhases` already handles a baseline
  check, parked questions (`escalateToLog`), timeouts, unticked manual
  phases, the Fixes pass, `verifyAndFix` and the move to `review`.
- **Capacity gates.** `evaluateNightGate` (`src/core/night-gate.ts`) checks
  the five-hour ceiling and seven-day floor against the capacity snapshot,
  using the night settings `ceiling` and `floor`.
- **One task per machine.** `admit()` refuses a new task while
  `isMachineBusy` (`src/cli/daemon-server.ts`) sees any mounted project
  running one. A batch therefore can't race other work.

What's missing is a loop over run-all, a clear rule for which ideas it
takes, and a screen to start, watch, steer and recover it.

**Ready and prioritised.** These words already have meanings in the code.
The batch reuses them rather than adding a new field.

*Prioritised* means the idea is in `run-order.md`, and the batch runs ideas
in that file's order. No `order`, `priority` or `batch:` frontmatter is
added. Reordering the queue in the batch sheet writes `run-order.md` through
the same `normalizeRunOrder(…, moved)` path the worklist drag uses, so
there is one order and the batch can't drift from it.

*Ready* means an idea can be run unattended right now. That is a new shared
predicate, `batchReadiness(entity)` in `src/core/`, which returns `ready` or
the first reason it isn't. Every check comes from rules that already exist:

| Rule | Source today | Reason shown when it fails |
| --- | --- | --- |
| kind is not `note` or `board` | `classifyRunOrderEntries` | (never listed) |
| derived status is `planned`, `in-progress` or `review` | `ORDERED_STATUSES` | (never listed) |
| `needs:` all closed | `computeNeedsBlockedIds` | waits for IDEA-N |
| has an unchecked phase or Fix that isn't `source: manual` | `startRunAllPhases` filter | only manual steps left |
| no open question in its `### Thread` | `collectParkedQuestions` | waiting on your answer |
| base not stale | `checkStaleBaseForRunAll` | done on another branch |
| an agent is configured for `run-all` | `resolveAgent` | no agent set up |

`idea` status (no phases) is not ready. The sheet offers *Draft first* for
those, which goes through the existing `batch-draft` and doesn't run phases.
Running freshly drafted phases unreviewed is out of scope.

The one rule with no source today is "don't run this one unattended" (a
visual check, a risky migration). The batch sheet handles this with a
per-run checkbox, remembered in `papercamp/.local/batch.json`. A frontmatter
field would turn a personal choice into a committed one, so none is added.

**The queue is fixed at start, then checked again before each idea.** The
batch takes the ticked ready ideas in run order. Before each idea starts, it
re-reads the corpus and re-runs `batchReadiness`, because the last idea may
have changed things. An idea that is no longer ready is skipped with its
reason. An idea that became ready mid-run, because the idea it `needs:`
just finished, is added in its run-order slot if *Pick up newly unblocked
ideas* is on (the default).

**Sequential, in the main checkout, on the current branch.** One idea at a
time, one phase at a time, in the project's own checkout. Reasons:

- `isMachineBusy` already allows one writing task per machine. Parallel
  ideas would need that rule split per worktree, plus a second set of
  baseline checks, a second dev server and a merge step.
- Both runs draw on the same account's five-hour window, so running two at
  once finishes no sooner once capacity is the limit.
- Ideas in one project often touch the same files. Two worktrees would trade
  the IDEA-319 divergence for a merge between sibling branches.
- Run-all already resumes one agent session across phases
  (`sessionId`, `SESSION_CONTEXT_LIMIT`). The batch starts a fresh session
  for each idea so context from one plan never leaks into the next.

Branch mode follows the project. On the shared `main` (IDEA-319's model)
the batch commits there. A project that ships through PRs gets one option,
*Branch per idea*: `idea/IDEA-N` cut from freshly fetched `main`, then
switched back to `main` before the next idea. Opening the PR is left to the
existing deliver flow. Worktree-parallel runs are recorded as a later
option, not built here.

**Machine-wide runs go project by project.** From the projects page, one
batch can cover several mounted projects: all of one project's queue, then
the next. The machine-busy rule already keeps them in series, and each
project keeps its own run order, checks and git sync.

**Capacity and stopping rules.** Before each idea and between phases, the
batch evaluates a slimmed night gate (no dashboard-idle or time-window
reason, since the user started it). The capacity snapshot is read from
`~/.config/paper-camp/capacity.json` once IDEA-320 moves it there. Rules
set in the sheet, with defaults:

- **Five-hour ceiling** (default: night `ceiling`). Above it, *wait for the
  reset* (default) or *stop*. While waiting, the batch is paused and shows
  the reset time from `five_hour.resetsAt`.
- **Seven-day floor** (default: night `floor`). Above it, the batch stops.
  The weekly budget isn't worth spending on a queue.
- **Stop by** a clock time, **at most N ideas**, and **at most $X** using
  `runUsage` cost (`RunUsage`, as `maxCostUsd` does for night).
- **Stop controls while running:** *after this phase*, *after this idea*,
  *skip this idea*, *stop now* (the existing `stopping` status).

**One idea failing doesn't sink the rest, unless it leaves a mess.** The
outcome of each idea maps onto what run-all already reports:

| Idea outcome | Batch does |
| --- | --- |
| all phases and Fixes done, checks green → `review` | next idea |
| parked on a decision (`blocker`, escalated to the thread) | marks it *needs you*, skips any queued idea that `needs:` it, next idea |
| stopped on an unticked phase (manual or visual check) | marks it *needs a human*, next idea |
| phase failed or timed out, tree clean | marks it *failed*, next idea |
| failed and left the tree dirty, or checks red that weren't red at batch start | **pauses the batch**: the next idea would commit over or inherit the mess |
| auth error (`errorKind: 'auth'`) | **pauses**: resumes through the same re-login path as run-all |
| git conflict during sync (below) | **pauses** with the conflict |

The checks baseline is taken once at batch start, and that set is passed on
as `toleratedRed` to every idea. Red that a single idea introduces and
can't fix in its own `verifyAndFix` loop pauses the batch instead of
spreading to the next idea.

**Git sync between ideas uses IDEA-319, not a new path.**

1. Before each idea: fetch and fast-forward (IDEA-319 phase 1). A behind
   branch fast-forwards. A diverged branch goes through `reconcileOnto`
   with the rule-based `papercamp/` merge. If only code conflicts remain,
   the batch pauses on *Resolve conflict*. That runs the verified
   `resolve-conflict` task, and the batch resumes only when the repo check
   passes, not on the agent's word.
2. After each idea: one bookkeeping commit for the run (IDEA-319 phase 2),
   then push, if the project pushes. Pushing per idea, not at the end,
   keeps the other machine's view at most one idea behind. That is the gap
   that caused the 2026-10-28 duplicate.
3. Re-check `checkStaleBaseForRunAll` after the fetch. Another machine may
   have finished the same idea, and then it is skipped as *done elsewhere*.

**Batch state lives in `papercamp/.local/batch.json`** (IDEA-320's
self-ignoring folder). It holds the queue, the rules, each idea's outcome
and the pause reason. It is never committed, so it can't dirty the tree or
conflict. A daemon restart mid-batch leaves it `interrupted`, and the app
offers *Resume*. The finished summary is appended to `tasks.log` as one
`batch-run` entry with child entries for each idea's run-all.

**Server shape.** A third `BatchKind`, `batch-run`, with write set
`worktree`, so it is exclusive. Its loop calls a `runIdea(task, plan)`
extracted from the body of `startRunAllPhases`, so single run-all and the
batch share one code path. New routes:

- `GET /api/batch/preview`: run order with a `batchReadiness` result per
  idea, unchecked phase counts, a cost estimate from past runs
  (`run-stats`), capacity, and a git preflight (level, behind, diverged,
  dirty).
- `POST /api/batch/start` with `{ ids, rules }`.
- `POST /api/batch/control` with `stop-after-phase | stop-after-idea |
  skip | stop | resume`.
- Progress rides the existing task publish stream. The `batch-run` task
  carries `batch: { index, total, items[] }`.
- `POST /api/machine/batch` on the daemon for the cross-project run.

**Web UI.** Mockups of every screen below, web and mobile, are in
[`papercamp/assets/IDEA-321/mockups.html`](../assets/IDEA-321/mockups.html).

*Where:* the plans toolbar gets a primary *Run queue (N ready)* button,
with N from the preview. The worklist `⋯` menu, next to *Draft all*,
*Reconcile all* and *Prioritise*, gets *Run queue…*. The projects/hub page
gets *Run all queues…* for the machine.

*Batch sheet:* a modal over the worklist. It has a git and capacity header,
the run order with a tick, phase count, cost estimate and readiness stamp
on each row, a collapsed *Rules* row, and *Run N ideas · M phases · ~$X*.

Rows that aren't ready are greyed and unticked, with their reason as a link
(*waiting on you* opens the thread; *done on another branch* opens the
git card). Dragging `≡` reorders `run-order.md`. If the git preflight is
behind or diverged, the Run button turns into *Sync first* and runs the
IDEA-319 sync.

*Live view:* the stack panel's agent section shows a batch card in place of
the single-task card, and the sheet becomes the live view: each idea's outcome, the running phase and
its last log line, the 5h gauge, and the four stop controls.

Worklist rows in the batch carry a *queued* stamp with their position, and a
spinner on the running one (`RowMarker` already has the spinner case).

*Recovery:* a paused batch shows one banner with one main action, in the
same place as the progress, for example *Paused: conflict in
src/app/server/agent.ts after IDEA-320* with [Resolve with agent] [Open git]
[End batch].

The other pause cases use the same banner: *waiting for the 5h reset at
14:20* [Resume now]; *IDEA-298 needs your decision* [Answer] (opens the
chat, and an answer resumes as IDEA-125 does for run-all); *checks red after
IDEA-320* [Fix with agent] [Skip and continue]; *daemon restarted mid-run*
[Resume]; *signed out* [Sign in].

*Summary:* when the batch ends, the card turns into a report that stays
until dismissed and is kept in Activity. It shows totals (ideas run, time,
cost, commits pushed), one row per idea with its outcome and a next action,
and what's left for later.

**Mobile app** (`paper-camp-mobile`). It uses the same endpoints. The UI
work belongs in that repo, as its own idea with
`needs: paper-camp/IDEA-321`.

- **Ideas tab:** a *Run queue (N)* button above the status groups opens a
  bottom `Sheet` with the list. Tapping a row ticks it. Long-press drag, or
  up/down handles for accessibility, reorders. A *Not ready* group sits at
  the bottom with its reasons. *Rules* is a collapsed row.
- **While running:** a `KraftCard` pinned at the top of the Ideas and
  Projects tabs shows *2 of 4 · IDEA-320 phase 2/3* and the 5h gauge.
  Tapping it opens the live sheet with the stop controls. The Log tab gets a
  `batch` filter next to `run-all`.
- **Projects tab:** each machine card gets *Run all queues*, a sheet that
  orders projects and then their ideas.
- **Recovery from the phone:** pauses send a push notification
  (`pushSubscription`), for example *Queue paused: conflict in agent.ts*.
  The notification opens the banner with the same actions. *Resolve with
  agent* runs the verified resolve-conflict, *Open git* goes to the Git tab,
  and *Answer* goes to Chat. Nothing needs a terminal.
- **Summary:** a push on finish, and the report as a Log entry.

Out of scope: worktree-parallel runs, auto-drafting and then running ideas
in one pass, running ideas in `review` again, and coordination between two
machines beyond fetch, push and the stale-base check. If the projects
later need two machines draining one queue, that needs a lease, which
would be a separate idea.

Done when, in a project with four planned ideas where one `needs:` another,
one has an open question and one has a manual visual phase, one tap on
*Run queue* runs the two ready ideas in run order, adds the unblocked one
when its dependency finishes, and skips the other two with their reasons.
It pushes after each idea, and ends with a summary on web and a push on the
phone. The same run with a diverged `origin/main` midway pauses on the
conflict and resumes from the app after *Resolve with agent*. A daemon
restart mid-run leaves a *Resume* that picks up at the next unfinished
phase.

### Phases
- [x] Readiness predicate and preview route
      `batchReadiness` in `src/core/` combining needs, manual-only, open question, stale base and agent checks; `GET /api/batch/preview` with reasons, phase counts, cost estimate, capacity and git preflight; tests per reason.
      run: 8m44s · 172 in · 33.2k out · sonnet-5 · sess:c5f24bae-3d1f-4acd-be5d-2962018c40d9
- [x] Extract `runIdea` from run-all
      Move the body of `startRunAllPhases` into a `runIdea(task, plan, opts)` that returns a typed outcome (review, needs-you, needs-human, failed-clean, failed-dirty, red-checks, auth); single run-all calls it unchanged.
      run: 5m13s · 74 in · 27k out · sonnet-5 · sess:9ee0026b-2fd4-4b30-9e5f-50ec4db8c986
- [x] `batch-run` task with stop rules and persisted state
      New `BatchKind` with exclusive write set; sequential loop over the queue with re-check before each idea, pick-up of newly unblocked ideas, capacity gate (wait for reset or stop), clock, count and cost limits, stop/skip controls, and `papercamp/.local/batch.json` with resume after restart.
      run: 15m48s · 202 in · 75.2k out · sonnet-5 · sess:9ee0026b-2fd4-4b30-9e5f-50ec4db8c986
- [x] Git sync between ideas
      Fetch, fast-forward or reconcile before each idea, one bookkeeping commit and push after; pause on code conflict and resume only after a verified resolve-conflict; optional branch-per-idea mode.
      run: 25m47s · 370 in · 92.6k out · sonnet-5 · sess:b821ef43-037e-43a1-8e07-ccacbb67e3d2
- [x] Web batch sheet, live card, recovery banner and summary
      Toolbar button and worklist menu entry, the sheet with ticks, reasons, drag reorder through run-order, rules and preflight; the stack-panel batch card with stop controls; pause banners with one action each; summary kept in Activity.
      run: 24m25s · 458 in · 107.7k out · sonnet-5 · sess:9ff98940-3241-489c-94ab-fb36d21b420c
- [x] Machine-wide queue and the mobile contract
      `POST /api/machine/batch` running projects in series from the hub page; push notifications on pause and finish; document the endpoints and task shape for the paper-camp-mobile idea.
      run: 18m16s · 294 in · 73.5k out · sonnet-5 · sess:9ff98940-3241-489c-94ab-fb36d21b420c
