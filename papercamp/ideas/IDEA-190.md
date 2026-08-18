---
id: IDEA-190
title: Agents commit only what they wrote
type: fix
status: idea
created: 2026-08-18
updated: 2026-08-18
tags:
  - agent
  - git
  - server
subject: Run & monitor
---

A phase commit contains the files that phase edited. Whatever else is sitting
uncommitted in the working tree stays there.

### What happens today

`runPhaseCommit` stages the entire repository and commits it without a
pathspec:

```
await git.stageAll();                              // git add -A
await git.commit([], title, refs, { noVerify: true });
```

`stageAll()` is a bare `git add -A`, and `commit([])`'s empty `files` array is
the "no pathspec restriction" case, so the commit takes everything staged. The
hook has no idea which files the agent authored, so it claims all of them.

Observed on `fix/idea-178-rate-limits-must-not-rewrite-status`: the commit
`fix(core): Treat archive location as closed in status derivation` carries six
files. Three of them — `agent-section.tsx`, `router.tsx`, `utilities.css` — are
unrelated UI edits that happened to be open in the working tree when the phase
finished. They now ride into IDEA-178's PR under a message that describes
status derivation, and a reviewer reading that commit will not expect to find
`MAX_VISIBLE_TASKS` in it.

This is not an edge case. Any human edit in progress when a phase completes is
absorbed, silently, into that phase's commit.

### Snapshot the tree around the phase

The hook records `git status` when a phase starts and again when it ends, and
commits only the paths that differ between the two. That is provider-agnostic —
Claude Code and opencode produce the same signal — and needs no cooperation
from the agent itself.

The pathspec-restricted commit path already exists and already handles the
awkward parts: it skips fully-staged files that `git add` would reject, and it
carries a rename's source path alongside its destination so a staged rename
doesn't leave half of itself behind. It is simply never given a file list.

A human editing a file *during* the run still gets swept in, because that edit
is indistinguishable from the agent's by this signal. That is accepted: it is a
narrow window, and closing it means either per-file mtime bookkeeping or
parsing each backend's tool log, neither of which is worth its cost against a
race this small.

### `--no-verify` stays

Machine-generated commits remain unblockable by lint hooks. Narrowing what a
commit contains makes a hook failure more meaningful, but an unattended
`run-all` halting on a hook is worse than an agent commit skipping one. The
commit-scope fix and the hook question are independent, and only the first is
in scope here.

### Relation to neighbouring ideas

[[IDEA-188]] settled *when* a commit happens — phases commit, fixes accumulate.
This settles *what* goes into one. They compose: a fix pass that accumulates
several items into one commit should still only stage what those items touched.

[[IDEA-171]] concerns the base a run starts from, not its commit contents. No
overlap.

### Out of scope

The `--no-verify` decision above. Manual commits from the Deliver form and the
git page, which already take an explicit file list from the user. Retroactively
splitting commits that already absorbed unrelated files.

### Phases
- [x] Snapshot the working tree before each phase runs
      Record `git status --porcelain` before `runPhaseProcess` and thread that
      start snapshot to the phase-commit hook.
- [ ] Reduce the two snapshots to the phase's changed paths
      In `commitPhase`, take only the paths added or changed since the start
      snapshot, carrying each staged rename's source alongside its destination.
- [ ] Commit only those paths through the existing pathspec path
      Replace `stageAll()` + `commit([])` with a scoped stage and the file-list
      commit that already skips fully-staged files.
- [ ] Cover the scoping with tests
      Assert an unrelated edit sitting in the tree before a phase stays
      uncommitted while the phase's own edits land.
