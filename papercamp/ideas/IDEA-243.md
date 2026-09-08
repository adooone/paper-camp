---
id: IDEA-243
title: Auto-fix before the fix agent
type: feat
status: idea
created: 2026-09-08
tags:
  - app
  - server
subject: Run & monitor
order: 11
---

A red `lint` stamp in the Stack panel offers one way out: *fix*, which
launches an issue-fix agent with the check's output. Most lint failures
need no agent at all. Biome fixes its own findings with `--write`, the repo
already has `pnpm lint:write` for exactly that, and a formatter's whole
point is that the fix is mechanical. Sending an agent to reindent a file
costs minutes and tokens for work a command does in seconds — and while the
agent runs, every other action waits on the machine's queue.

A check can name its own fix command, and the panel runs that first.

**A check carries an optional fix command.** `DeskCheck` in
`papercamp/config.json` gains `fixCmd?: string`; `DeskCheckState` carries
it through to the client. `init` seeds the lint check with `fixCmd: "pnpm
lint:write"` in every template that has a lint check; `types` and `test`
get none, since nothing mechanical fixes those. The Settings → Desk check
row gains a third field, *Fix command*, beside name and command, empty by
default.

**`/api/checks/fix` runs it and re-checks.** `POST /api/checks/fix` with
`{ name }` runs the check's `fixCmd` through the same runner `run` uses,
with the same cwd and timeout, then re-runs the check itself and returns
the new `DeskCheckState`. The activity stream emits the usual `check`
payload, so every open panel refreshes. A check without a `fixCmd` answers
400.

**The panel offers auto-fix first.** In `checks-group.tsx`, when the
failing check has a `fixCmd`, the action row reads "The lint check
failed." followed by two stamps: `auto-fix`, in the check's own colour,
and `fix`, the agent launch as today. `auto-fix` reads `fixing…` and
disables both while the command runs. If the re-check passes, the row
turns to "No failing checks." like any other pass; if it still fails, the
row stays and the output the fix left behind becomes what the `fix` agent
receives, so the agent starts from the real remainder rather than the
formatter's noise. A check with no `fixCmd` shows only `fix`, as now. The
row keeps its fixed height in every state.

**Doctor and docs keep their own path.** Neither has a mechanical fix —
doctor's `--fix` rewrites corpus files and is a decision, not a format
pass — so they keep the single `fix` stamp.

### Out of scope

Running `fixCmd` automatically on save or on every failure; the user
clicks. Chaining several fix commands. Any change to the issue-fix agent
itself.
