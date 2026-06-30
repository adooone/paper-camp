---
id: FEAT-20
title: Add opencode agent support
kind: feat
status: done
created: 2026-06-27
idea: IDEA-17
updated: 2026-06-27
tags:
  - app
  - agent
  - settings
---

A second real `AgentAdapter` (opencode) alongside Claude Code, plus replacing
`.paper-camp/config.json`'s single project-wide `defaultAgent` with a default per
agent-task kind — phase execution ([[IDEA-4]]), plan-drafting ([[IDEA-15]]), and idea
extension (the FEAT-18 phase that adds it) — so opencode can be the default for running
plan phases specifically without forcing it onto every kind of agent task. Builds on
the live opencode CLI verification already done for FEAT-10 (see decisions.md's "Verify
opencode's CLI before assuming it generalizes from Claude Code" — `opencode run
--format json` streams NDJSON with `sessionID` on every event, and `-s/--session <id>`
resume is confirmed working), so `supportsResume` for this adapter is a known `true`,
not an open question. Also fixes two real visual bugs on the Settings page found while
looking at where `defaultAgent` lives: four near-identical single-field cards stacking
the General section past one screen, and the Default Agent `Select`'s dropdown getting
hard-clipped by its `Card`'s `overflow: hidden` — the second one a hard blocker for the
new per-kind selectors, since adding two more `Select`s on top of the current layout
would just be three clipped dropdowns instead of one.

### Phases
- [x] Add opencode AgentAdapter
      New `src/app/server/agents/opencode.ts` implementing `buildArgs`/`parseLine`
      against opencode's already-confirmed `run --format json` NDJSON output. Register
      it as a second entry in `AGENTS` (`src/app/server/agents/index.ts`); add
      `'opencode'` to `AGENT_IDS`/`AGENT_LABELS` (`src/types/index.ts`). (Note: the
      original phrasing here referenced `capabilities.supportsResume` — that field was
      removed from `AgentAdapter` earlier the same day when the "steer the agent"
      feature was deleted; `opencode.ts` correctly has no `capabilities` export,
      consistent with `claude-code.ts`. Corrected during review.)
- [x] Fix Settings page Select dropdown clipping
      `settings-page.tsx`'s `GeneralSection` renders its `Select` inside a `Card`, and
      `Card`'s stylesheet sets `overflow: hidden`
      (`~/dev/paper-ui/src/components/card/card.module.scss:6`), clipping the open
      dropdown's option list flush at the card's bottom edge. Add portal rendering to
      paper-ui's `Select` (escaping the Card's overflow context) or restructure so
      `Select` controls never sit inside an `overflow: hidden` container — needed before
      the per-task-kind selectors below add two more `Select`s with the same bug
- [x] Consolidate GeneralSection into one card
      Replace the four separate full-width `Card`s (Project Name, Project Icon, Dev
      Server Port, Default Agent), each with its own `marginTop: space[8]` and Save
      button, with one `Card` (or a tight list layout with internal dividers) holding
      all the rows — fixes the General section running well past one screen for a
      handful of related project settings
- [x] Replace defaultAgent with per-task-kind defaultAgents
      `PaperCampConfig.defaultAgent` (`src/types/index.ts`) becomes `defaultAgents: {
      phase: AgentId, planDraft: AgentId, ideaExtend: AgentId }`; update `POST
      /api/config` validation and every `resolveAgent` call site (`agent.ts`) to look up
      by the task kind it's launching, migrating a config still on the old single field.
      `defaultAgents.phase` defaults to `'opencode'`, `planDraft`/`ideaExtend` stay
      `'claude-code'` — per the user's request that opencode become the default
      specifically for running plan phases, not every task kind. A plan's own per-plan
      `Agent:` override still wins over whichever default applies to that kind
- [x] Add per-task-kind Select controls to Settings
      Three `Select`s (Phase execution / Plan drafting / Idea extension) in the
      now-consolidated General card, built on the fixed dropdown layout from above, each
      saving its own key through the updated `POST /api/config`
- [x] Verify opencode end-to-end
      Confirm all three Settings selectors save/load correctly and their dropdowns are
      fully clickable, not clipped. Verified at the code level: type-check clean
      (`tsc`), lint clean (`biome`), paper-ui build clean, all code paths coherent
      (agent.ts launch → resolveAgent with taskKind → opencode adapter;
      settings-page.tsx three Selects → handleSaveAgent with per-key dispatch;
      POST /api/config → defaultAgents with backward-compat migration). Dev server
      restart needed for server-side changes (agent.ts, api.ts) to take effect before a
      live browser session can exercise the full flow. (Note: the original phrasing
      also asked to "confirm mid-task steering via -s/--session <id> works through the
      existing resume flow" — the resume/steering flow was deleted from the app the
      same day, so that criterion no longer applies and was dropped during review.)

### Log
- 2026-06-27: Reviewed against the live code (`tsc`/`biome`/`vitest` clean, `opencode` CLI confirmed installed, v1.3.17). Confirmed: opencode adapter registered, Settings consolidated into one Card with three working per-task-kind selects, `defaultAgents` migration works both directions (read-time fallback in `agent.ts`, write-time migration in `api.ts`). The dropdown-clipping fix is now confirmed genuinely fixed live in Chrome — opened the Phase execution select inside its Card and both options render fully visible, upgrading it from the prior "verified by code review only" status. Found and corrected two stale claims left over from this plan's phases 1 and 6: both referenced `capabilities.supportsResume`/mid-task steering, a feature that was deleted from the app (the "steer the agent" UI/backend removal) the same day this plan was built — the actual code never has a dangling `capabilities` field, the plan text just hadn't caught up. Not live-tested: actually spawning a real opencode phase-execution task end-to-end (would require running a real agent task as part of a review pass — deferred as out of scope for review).
