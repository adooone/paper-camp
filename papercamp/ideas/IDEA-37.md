---
id: IDEA-37
title: Fable capability-window tasks
status: done
---

## IDEA-37: Fable capability-window tasks

**Closed 2026-07-03 without a plan** — this is a usage pattern, not a feature: the tasks are one-off prompts fired from the existing agent plumbing, so there is nothing to build and nothing for a plan to track. Tasks 5 and 6 ran (see their notes); the remaining prompts stay below as ready-to-fire templates for however much of the window is left.

Claude Fable 5 (`claude-fable-5`) is available to us for a limited window. It's the most capable model we can run, and it's differentiated at **long-horizon autonomous execution** (minutes-long single turns, one-shot builds against a spec), **open-ended judgment** (architecture, UX taste), **repo-wide reasoning** (1M context holds the whole codebase + all plans at once), and **bug-finding** (higher recall *and* precision). It's also 2× Opus pricing — so routing it by cost is the wrong frame for a closing window.

**Organizing principle: spend the window minting durable assets that outlive Fable — especially ones that make our cheaper models (Opus/Sonnet/Haiku) better afterward.** Fable disappears; a reconciled plan set, a test suite, a reshaped design language, or an upgraded agent prompt *stays* and keeps paying off. Ephemeral or low-stakes work (commit messages, sync) is the wrong use of the window.

**How we run it.** Fable is the existing `claude-code` agent with `model: 'fable'` (already in `AGENT_OPTIONS['claude-code']`, `src/types/index.ts`) — no new plumbing. These are one-off runs kicked off from the settings model select or per-task, each on **its own branch**, gated by CI + human review. Prompt guidance baked into the prompts below (from Fable's behavior profile): run at `effort: high`; give the **full spec up front** in the first turn (Fable's autonomy comes from a clear up-front goal, not drip-fed context); **state the boundary explicitly** (assess-and-propose vs. implement — Fable over-builds and takes unrequested-but-adjacent actions at high effort); expect quiet multi-minute turns; and **de-prescribe** — state the goal and constraints, don't enumerate steps (over-prescription lowers Fable's output quality).

Ranked by durability. Each has a ready-to-fire prompt.

### 1. Write the missing test suite (highest durability)

We have 173 tests (62 when this was drafted), and the original best targets now have suites — `git.test.ts` (branch hygiene), `agent.test.ts` (run loop), and the parser/readers/frontmatter round-trips. Tests are the ultimate durable asset — they guard the code after Fable is gone and let cheaper models safely touch it later. Before firing, re-scope the prompt at the coverage that's still thin (e.g. the route handlers in `src/app/server/routes/` and the CLI commands) rather than the targets below, which are largely covered.

> Read the whole codebase. Your job is to raise real test coverage, not to hit a number. Focus on the logic most likely to break silently: `src/app/server/git.ts` (branch hygiene, merged-into-main, ahead/behind counts), `src/app/server/agent.ts` (the run loop and per-phase commit flow), and `src/core/parser.ts` (plan/idea file round-trips). Write tests that would have caught the class of bug where a fresh feature branch was wrongly reported as stale. Use the existing test style and runner (vitest). Do not refactor the code under test to make it testable unless a change is genuinely required — if it is, propose it separately first. Report which behaviors you chose to cover and which you deliberately left out, and why.

### 2. Reconcile & rewrite the plan set

The reconcile half of [[IDEA-26]] — the correction pass our append-only audit can't do. Fable holds every plan + the real code at once and fixes what's drifted.

> Read every file under `papercamp/plans/` and the actual codebase they describe. For each plan, reconcile it against current reality: fix stale file/path references, correct renamed or removed code symbols, update approaches that `papercamp/decisions.md` has since superseded, and resequence phases where the dependency order is now wrong. Improve the architecture described in the phase steps where you can see a clearly better approach. Hard boundaries: never change a plan's `id` or frontmatter identity, never un-check or delete a completed `[x]` phase, and preserve each plan's original intent — you are updating accuracy, not redesigning scope. Produce your changes as edits I review before they land; for anything beyond a mechanical reference fix, note what you changed and why.

### 3. Upgrade our own agent prompts (meta-leverage)

Paper-camp generates prompts (`buildPhasePrompt`, `buildIdeaExtendPrompt`, audit prompts in `src/app/features/plans/prompts.ts`). Use the expensive model to rewrite the instructions the *cheap* models will run on after the window closes.

> Read `src/app/features/plans/prompts.ts` and every prompt-builder in it, plus enough of the surrounding code (`src/app/server/agent.ts`, the adapters in `src/app/server/agents/`) to understand how each prompt is used and what model runs it. These prompts will mostly run on Opus/Sonnet/Haiku, which follow instructions literally. Rewrite them for clarity and reliability on those models: remove over-prescription, tighten the task/constraints, and make the "when to do X" conditions explicit. Don't change the code that assembles the prompts unless a wording change requires it. Show before/after for each prompt and explain the behavioral reason for each change.

### 4. Repo-wide correctness & bug sweep

Fable's bug-finding is its differentiated strength. Aim it at the code that keeps biting us: `src/app/server/api.ts`, `git.ts`, `agent.ts`, and the CLI. (Same class as the hygiene false-positive, the settings-page crash, and the swallowed 409s.)

> Read the server (`src/app/server/`) and CLI (`src/cli/`) end to end and hunt for real bugs — logic errors, mishandled edge cases, swallowed errors, race conditions, and incorrect git assumptions. Report every finding with the concrete input/state that triggers it, the wrong result, and your confidence. Don't filter for severity — list everything and let me rank. When the fix is small and unambiguous, apply it; when it's a judgment call or touches behavior, describe it and leave it for me. Before claiming anything is fixed, point to the test or code path that proves it.

### 5. Free-flight UI reshape (propose, then build)

**Ran.** The critique produced four directions; the responsive-layout/Stack direction landed as FEAT-33 ([[IDEA-34]], done), and the remaining three are captured as [[IDEA-38]] (dense worklist), [[IDEA-39]] (focus cockpit), and [[IDEA-40]] (routes), plus [[IDEA-41]] for the polish loose ends. The prompt stays below as the template for future propose-then-build UX runs — Fable has a *persistent* default frontend house-style that generic nudges won't dislodge, and it over-reaches at high effort, so the boundary matters.

> Explore the running dashboard's UI — the plans views, Stack panel, settings, and docs pages under `src/app/` — using the paper-ui component library (`~/dev/paper-ui`) that this app is built on. Don't ask me to enumerate the problems: form your own critique of the current UX. Then propose 3–4 distinct directions for reshaping it to serve users better — each as a short rationale plus the concrete component/layout changes it implies, grounded in paper-ui's existing components (don't invent a new visual language). Stop there and let me pick one; do not implement yet. When I choose, implement only that direction, only within `src/app/`, and keep changes scoped to the UI.

### 6. Actualize the internal docs

**Ran.** Shipped as DOCS-3 ("Actualize about.md for per-file plan/idea storage", PR #11) — `about.md` was rewritten against the verified codebase, with the genuinely ambiguous spots (the `port` config-schema drift, the `idea-status.ts` barrel omission) noted in the doc rather than guessed at. Original framing: [[IDEA-25]] as a Fable knowledge-work task — hold the whole system in context and rewrite `papercamp/about.md` to match per-file storage reality.

> Read `papercamp/about.md` and the actual codebase it documents. The doc is internally contradictory after the per-file plan/idea storage migration ([[IDEA-20]]): parts describe the old monolithic `plans.md`/`ideas.md`, parts the new per-file layout. Rewrite it so every section matches how the system actually works now — file layout, CLI commands, parser/serializer paths, and the storage model. Change only what's inaccurate; keep the doc's structure and voice. Note anything you found ambiguous in the code rather than guessing.

**Touchpoints:** no code changes to enable this — it's a usage pattern. Relies on the existing `model: 'fable'` option (`src/types/index.ts`, `AGENT_OPTIONS`). Tasks 5 and 6 have run (see their notes); tasks 1–4 remain, with task 1 re-scoped now that the original targets have suites. Task 2 is the Fable-run version of [[IDEA-26]] — its narrower mechanical half shipped as FEAT-28's reconcile pass, so what's left here is the broader judgment pass FEAT-28 deliberately excludes. If we want these to be repeatable rather than one-off, that reconcile prompt is the natural thing to land as the `'reconcile'` TaskKind [[IDEA-26]] proposed.
