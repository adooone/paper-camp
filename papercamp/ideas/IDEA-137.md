---
id: IDEA-137
title: Durable drafted plans
type: fix
status: idea
created: 2026-08-06
tags:
  - agents
  - plans
  - git
subject: Run & monitor
---

Incident (2026-08-06, IDEA-134's first run-all): the phase-1 agent ran
`git stash && pnpm run knip; git stash pop` to check a clean baseline. The
stash swept up the freshly drafted plan — draft-plan output lives only as
uncommitted working-tree state — plus every other pending papercamp edit.
The pop then conflicted on `run-order.md`, which the server live-writes
mid-run, so the restore failed and the run died as `error` with the plan
seemingly gone. The work survived only inside `stash@{0}`, recovered by
hand afterwards.

Three things line up to make this repeatable for every drafted plan:
draft-plan never commits its output; headless phase agents may stash a
shared dirty tree; and live-written files (`run-order.md`, `tasks.log`)
make any stash pop conflict-prone. Two fixes close it:

1. **Run-all commits the corpus before phase 1.** Right after branch
   setup, any pending `papercamp/` changes are committed as
   `docs(ideas): <plan title> — plan` with a `Refs: <plan id>` trailer
   so the drafted phases (and any last-minute edits to them) are durable
   before an agent ever touches the tree. A run can no longer erase the
   plan it is executing.

2. **Phase prompts ban destructive git on pre-existing state.** The
   headless phase prompt gets an explicit rule: never `git stash`,
   `git reset`, or `git checkout` over working-tree state the agent did
   not create; a clean-baseline comparison is done with read-only
   `git diff`/`git show HEAD:<file>` instead.

### Thread
- [x] 2026-08-06 [decision] Durability comes from run-all committing pending papercamp/ changes at branch setup, not from draft-plan committing at draft time — drafts stay editable until the run starts, and the guard also covers manual plan edits. Phase prompts additionally forbid stash/reset/checkout over pre-existing state.

### Phases
- [ ] Add a corpus-commit helper to the git manager
      Stage every pending `papercamp/` change and commit it as `docs(ideas): <title> — plan` with a `Refs: <id>` trailer, no-op when the corpus is clean.
- [ ] Commit the corpus before phase 1 of run-all
      Call the helper in `startRunAllPhases` after branch setup and before the first phase agent runs, so the drafted plan and any last-minute edits are durable.
- [ ] Ban destructive git over pre-existing state in phase prompts
      Add the rule to `buildAgentPrompt`, `buildFixPassPrompt`, and `buildFixItemPrompt`: never `git stash`/`reset`/`checkout` over working-tree state the agent did not create; compare against a clean baseline with read-only `git diff`/`git show HEAD:<file>`.
- [ ] Cover both fixes with tests
      Assert the corpus is committed before the first phase agent launches and that the phase prompt carries the destructive-git ban.
