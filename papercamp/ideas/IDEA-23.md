---
id: IDEA-23
title: Per-agent model and effort settings
---

## IDEA-23: Per-agent model and effort settings

Today the agent config is a single choice per task: `DefaultAgentsMap` (`src/types/index.ts`) maps each task kind — `phase`, `planDraft`, `ideaExtend`, `commitSuggest` — to one `AgentId` (`claude-code` or `opencode`), and the Settings page surfaces exactly that as four agent-picker dropdowns (`settings-page.tsx` — "Phase execution", "Plan drafting", "Idea extension", "Commit suggestion"). What's missing is everything *below* the agent choice: neither adapter's `buildArgs` passes a model or a reasoning-effort level. `claude-code` hardcodes `-p … --output-format stream-json --verbose --permission-mode auto` and `opencode` hardcodes `run … --format json`, so every task always runs on each CLI's default model at its default effort. The goal is to let each per-task config also carry a **model** and an **effort** level.

**Both CLIs support it (verified against the installed binaries):**
- `claude-code`: `--model <alias|full-name>` (alias `opus` / `sonnet` / `fable` / `haiku`, or a full name like `claude-opus-4-8`) and `--effort <low|medium|high|xhigh|max>` — a fixed enum.
- `opencode`: `-m <provider/model>` (free-form string) and `--variant <reasoning effort>` (provider-specific, e.g. `minimal`/`high`/`max` — no fixed, enumerable list).

**Each agent declares its own options.** The model/effort values are agent-specific, so the option sets must live with the agent adapter, not in shared UI. Give each adapter an options descriptor — for every configurable field, either a known value list (→ render a `Select`) or nothing (→ the UI hides that control, or falls back to a free-text input). Start by fully defining `claude-code`'s options:
- model: select of the known aliases (`opus`, `sonnet`, `fable`, `haiku`), plus a way to type a full `claude-*` name.
- effort: select of `low | medium | high | xhigh | max`.

For `opencode`, model is an open-ended `provider/model` string (free-text, no select) and `--variant` has no enumerable value set — so per the rule above, **don't render an effort select for it** until/unless we know the valid values. The UI should be driven entirely by what the adapter declares, so adding options for an agent later is a data change, not a new special case.

**Wiring:** widen each `DefaultAgentsMap` entry from a bare `AgentId` to `{ agent: AgentId; model?: string; effort?: string }`. Thread it through `resolveAgent` (`agents/index.ts`) into `buildArgs(prompt, opts)` so the spawn in `agent.ts` (`spawnAgent(adapter, adapter.buildArgs(prompt))`) appends `--model`/`--effort` (claude) or `-m`/`--variant` (opencode) only when set. Unset = omit the flag = use the CLI's own default, so existing setups don't change behaviour.

**UI — also a compaction pass.** Today each of the four task types is a full-width row holding a single narrow `Select` plus a "Saved" span (`settings-page.tsx`), so most of the horizontal space sits empty and the section is taller than it needs to be. The redesign puts each type's controls — agent + model + effort — inline on **one row per task type**: a row label/heading for the type ("Phase execution", etc.) and the selects laid out horizontally in the existing `display:flex` container, which both fills the dead space and shortens the section. Controls are rendered from the selected agent's options descriptor (so opencode shows agent + free-text model and no effort select, while claude shows all three), reusing the same `handleSaveAgent`/`saveConfig` save-and-confirm pattern. Switching the agent re-renders the available controls and clears values that don't apply to the new agent. Keep the divider rhythm between rows; consider tightening `paddingTop`/`paddingBottom` and moving the per-type description from a `helperText` under one select to a single short label for the whole row so the three controls align.

**Config back-compat:** this is a `config.json` shape change. `paperCampConfigSchema` and the read path must still accept the old bare-string form (`"phase": "opencode"`) and treat it as `{ agent: "opencode" }`, so existing projects don't break on upgrade.

**Open questions / out of scope:**
- Whether to also let a per-plan override carry model/effort — `PlanEntry.agent` already exists and is honoured by `start`/`startForPlan` — or keep this project-level only for now.
- No validation of typed model names: a typo would surface as a raw agent spawn failure. Probably acceptable to pass through and let the agent's own error bubble up, rather than maintaining an allowlist that goes stale as new models ship.
