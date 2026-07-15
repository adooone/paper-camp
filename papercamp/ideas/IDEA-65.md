---
id: IDEA-65
title: Parallel agents and a task log
type: feat
status: idea
created: 2026-07-15
tags:
  - app
  - agent
  - stack
  - ui
---

`agent.ts` holds exactly one task: `let current: AgentTask | null`. Every launch path guards on `isBusy()` and rejects with "An agent task is already running", so starting a suggest sweep blocks a reconcile, and a commit-suggest — a read-only, no-tools prompt — blocks everything. That single slot is also the only place task state lives, so it's ephemeral: restart the dev server and the record of what ran is gone. Both the parallelism and the log below are the same change: teach the manager to hold many tasks instead of one.

**Not everything can be parallel, and `TaskKind` alone doesn't say which.** The real constraint isn't the kind, it's that all agents share one git working tree and one entity corpus. Partition by what a task *writes*:

- **Always safe:** `commit-suggest`, `overlap-check` — read-only prompts, no tools, deny-by-default args. These should never have been blocked.
- **Disjoint writers, safe together:** `suggest` only appends to `papercamp/suggestions.md`; `reconcile`/`batch-reconcile`/`draft`/`extend` rewrite entity files under `papercamp/ideas/`. Two of these can overlap if they don't touch the same entity.
- **Exclusive:** `phase`, `run-all`, `fix-review`, `sync` — they edit source, commit, checkout or push. One at a time, full stop. Two phases can't run even on different plans: one working tree, one HEAD.

So the gate becomes "does this task's write-set collide with a running one", not a global busy flag.

- **Fan `current` into a registry.** ~50 references read off `current`, including `getStatus`, `getReconcileQueue`, `getFixReviewResult`, `stop`, `killCurrent` — each needs a task id. `AgentTaskState` is a single object today and the client's `agentStatus` mirrors it; both become lists. The SSE `type: 'agent'` tick already exists (see the routing in `stack-panel.tsx`) but must carry which task moved.
- **Stack's Agent card becomes a real stack.** Show the 3 most recent tasks, newest on top, each with its own status and stop control — so a finished run stays visible instead of being overwritten by the next launch.
- **A tasks page for the log.** Needs persistence: today's state dies with the process. Append finished tasks to a file (`papercamp/` is the corpus, so this likely belongs next to it or under a dotfile) with kind, plan, agent, start/end, outcome. Distinct from `progress.md`, which is the *plan's* narrative written by agents; this is the *machine's* record of what ran.
- **Keep `killCurrent` honest.** The config plugin registers it on SIGINT/SIGTERM to avoid orphaning a child; with many tasks it must kill all of them.

The prize is that the cheap read-only prompts stop queueing behind long ones — today a commit-suggest can't run while a phase is going, which is most of why the app feels blocked. Start there: allowing the always-safe kinds through is a small, self-contained slice that doesn't need the registry.
