---
id: FEAT-26
title: Per-agent model and effort
kind: feat
status: done
created: 2026-06-30
idea: IDEA-23
updated: 2026-07-01
audited: 2026-07-01
tags:
  - agents
  - settings
  - config
  - model
  - effort
  - ui
---

Today every task runs on its CLI's default model at default effort — `claude-code` and `opencode` adapters both hardcode their `buildArgs` flags with no way to pass a model or reasoning-effort level. This feature widens each `DefaultAgentsMap` entry from a bare `AgentId` to `{ agent: AgentId; model?: string; effort?: string }`, threads those values through `resolveAgent` and `buildArgs`, and redesigns the Settings page so each task type's controls — agent, model, and effort — sit inline on a single compact row. The adapter itself declares which controls exist and what values they accept (a known enum → `Select`; free-text or unknown → text input or hidden), so adding options to a new agent later is a data change, not a code branch. Back-compat: `paperCampConfigSchema` must still accept the existing bare-string form and coerce it to the object shape, so existing projects don't break on upgrade.

### Phases
- [x] Widen DefaultAgentsMap type and update config schema
      Change the entry type from `AgentId` to `{ agent: AgentId; model?: string; effort?: string }` in `src/types/index.ts`. Update `paperCampConfigSchema` (and its read/write path) to accept both the old bare-string form and the new object form, coercing bare strings to `{ agent: id }` on read so existing `config.json` files are not broken.
- [x] Add options descriptors to each adapter
      Define an `AgentOptionsDescriptor` type: a record of option names to either a fixed value list (renders a `Select`) or `null` (free-text or hidden). Implement for `claude-code`: model as `['opus','sonnet','fable','haiku']` plus a free-text path for full `claude-*` names, effort as `['low','medium','high','xhigh','max']`. Implement for `opencode`: model as `null` (free-text), no effort entry.
- [x] Thread model/effort through resolveAgent and buildArgs
      Update `resolveAgent` in `agents/index.ts` to extract `model` and `effort` from the widened config entry. Update each adapter's `buildArgs(prompt, opts?)` to accept those fields and append `--model`/`--effort` (claude-code) or `-m`/`--variant` (opencode) only when set — omitting the flag when unset so the CLI's own default applies.
- [x] Redesign Settings page agent section
      Replace the current one-row-per-task wide layout (agent picker + "Saved" span, most space empty) with compact inline rows: one row per task type, containing a short row label and the agent, model, and effort controls side-by-side in the existing flex container. Render controls from the selected agent's options descriptor — `claude-code` shows all three, `opencode` shows agent + free-text model with no effort select. Switching the agent re-renders available controls and clears values that don't apply. Keep the divider rhythm; tighten vertical padding and move the per-type description from a `helperText` under one select to a single short row label so the controls align.
- [x] Apply model/effort to commit-suggest spawn
      In `agent.ts`, `resolveAgent` for `commit-suggest` (around line 486) discards `model` and `effort`. The custom args on the next line are hardcoded without using `adapter.buildArgs`, so `--model`/`--effort` (claude-code) or `-m`/`--variant` (opencode) are never appended even when the user has configured them for the `commitSuggest` task type. Destructure `model` and `effort` from the `resolveAgent` return value and append the appropriate flags to the hardcoded args when set.

### Log
- 2026-07-01: Audit found commit-suggest spawn ignores model/effort — added phase to thread them into the hardcoded args.
