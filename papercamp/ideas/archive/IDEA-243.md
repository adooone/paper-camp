---
id: IDEA-243
title: Auto-fix before the fix agent
type: feat
status: done
created: 2026-09-08
updated: 2026-09-08
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

### Phases
- [x] Carry `fixCmd` through config and state
      Add the optional field to `DeskCheck` and pass it through `DeskCheckState` to the client.
      run: 1m59s · 34 in · 3.4k out · sonnet-5
- [x] Seed the lint fix command in `init`
      There's no static init-template system for desk checks — `initProject` writes no `checks` at all, and the only thing that ever produces them is the AI-driven `discoverDeskConfig`. Its prompt now instructs the agent to set a check's `fixCmd` to a companion write/fix script (e.g. `lint:write`) found in the evidence, and to leave it off checks with no mechanical fix.
- [x] Add `POST /api/checks/fix`
      Run the fix command through the runner `run` uses, re-run the check, emit the `check` activity payload, and answer 400 without a `fixCmd`.
      run: 7m48s · 98 in · 18.8k out · sonnet-5
- [x] Add the *Fix command* field to the Settings check row
      run: 1m19s · 30 in · 3.8k out · sonnet-5
- [x] Offer `auto-fix` beside `fix` in the checks group
      Two stamps while a `fixCmd` exists, `fixing…` disabling both, a fixed row height in every state, and the post-fix output handed to the agent if the re-check still fails.
      run: 10m35s · 66 in · 19.3k out · sonnet-5
- [x] [manual] Pass through check-level fixCmd in desk discovery

### Thread
- [x] 2026-09-08 [question] [agent] Run-all parked on phase 2 ("Seed the lint fix command in `init`") — the agent needs a decision: Phase 2 says "`init` seeds the lint check with `fixCmd: "pnpm lint:write"` in every template that has a lint check" — but I can't find any such template mechanism. `initProject` in `src/core/scaffold/scaffold.ts` currently writes no desk config at all (no `checks` array, no lint/types/test), and `templates.ts` only holds the SKILL.md and settings.json string constants. The only place that ever produces desk `checks` is the AI-driven `discoverDeskConfig` in `src/app/server/desk-discovery.ts`, which classifies scripts dynamically per-repo rather than from static templates — and it can't safely hardcode `pnpm lint:write` since arbitrary user repos won't have that script. Should I (a) add a new static desk-config-seeding template system to `initProject` (a much bigger addition than this phase implies), (b) have `discoverDeskConfig`'s prompt instruct the AI to add `fixCmd` when it finds a lint-equivalent write/fix script in the evidence, or (c) something else you have in mind for where "init" and "templates" live?
- [x] 2026-09-08 [decision] [agent] Went with (b): `discoverDeskConfig` is the only real seeding mechanism a repo goes through, so its prompt now tells the agent to set `fixCmd` on a check when the evidence has a companion write/fix script for the same tool (e.g. `lint:write` beside `lint`), and to leave `fixCmd` off checks with no mechanical fix (types, tests, build). No new static template system.
