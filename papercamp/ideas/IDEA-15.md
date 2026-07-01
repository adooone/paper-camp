---
id: IDEA-15
title: Agent-drafted plans
---

## IDEA-15: Agent-drafted plans

Turning an idea into an actual plan is the one step in this whole pipeline still done entirely by hand — write a title, break it into phases, fill in descriptions. Everything downstream of that (executing a phase, reviewing the result) already has a "Start agent" button per [[IDEA-4]]. This idea closes the gap on the front end: a button on an `IdeaEntry` that launches an agent whose job is to read the idea and draft a real, phased plan from it.

**Why this is a different shape of agent task, not just a new button.** [[IDEA-4]]'s agent is scoped to *executing* one phase of an existing plan — the prompt says "do this, then check it off." This agent's job is the opposite end of the pipeline: read `ideas.md`'s prose for one `IDEA-N`, plus whatever `about.md`/`decisions.md` context is relevant, and produce a new `plans.md` entry — title, phases, descriptions, `idea: IDEA-N` backlink — with nothing yet built. `src/app/server/agent.ts`'s current `AgentTask` is implicitly phase-shaped (`planId` + `phaseIndex`); a planning task has neither, since the plan doesn't exist until the agent writes it. The two task shapes likely share the spawn/stream/stop machinery in `agent.ts` but need a second prompt-builder and a different "what does success look like" check than [[IDEA-4]]'s phase-checkbox verification — probably "did a new `## Heading` with `idea: IDEA-N` actually appear in `plans.md`."

**Where the button lives:** the `IdeasBoard` row (`about.md`'s description: lightbulb/check icon, title, expand-to-linked-plans) gets a "Draft plan" action, available while the idea has no linked plan yet — once a plan exists for an idea, this button's job is done and the existing per-phase buttons take over.

**Priority and ordering are decided, not open:** `plans.md` has no `Priority:` field, and doesn't need one — `ideas.md` already establishes "priority = file order" for ideas (`about.md`/the Ideas-board plan's "Order ideas by file position" phase). This agent follows the same convention for plans: the prompt includes every other non-`done` plan as context, and the agent's job is to insert the new plan at the file position that reflects where it belongs in implementation order, not append it at the end. If reviewing the open set shows the new plan should jump ahead of (or behind) existing open plans, the agent **may reorder those existing entries' position too** — but only moves headings, never edits another plan's title, phases, or body text. This keeps the blast radius to "where things sit in the file," matching the read-only-content guarantee the rest of this pipeline already relies on.

**Make that order visible, not just inferable.** Unlike the Ideas board (which actually renders `ideaEntries` top-to-bottom in file order, so position doubles as a visible ranking), the Plans page's "Backlog" section is the wrong shape for this today — per `about.md`, plans render grouped by status with no indication that file order means anything. A user staring at the Backlog list has no way to tell the agent's chosen order from an arbitrary one. This idea should also add a small ordinal marker (e.g. "1.", "2." or a numbered `Stamp`) to each `PlanCard` within the Backlog section, reflecting its file position — read-only for v1, same as the Ideas board's ordering is read-only with no drag-and-drop. Without this, the whole priority-setting half of this idea produces an effect nobody can see.

**Resolved:** the agent writes `plans.md` directly, no separate approval step — same as [[IDEA-4]]'s phase-execution agent. The new entry lands at `Status: idea` in the Backlog, where the existing CRUD (edit, delete, promote) is the review surface. See `decisions.md`'s "Plan-drafting agent writes plans.md directly, same as phase execution".

**Open questions, not yet decided:**

- **How much of `papercamp/` does the prompt need as context** to draft a plan that fits this project's actual conventions (phase granularity, the `kind`/`id` scheme, linking back via `idea`) instead of generic boilerplate — the whole of `about.md`, or something smaller and more targeted?
- **Relationship to [[IDEA-14]]:** both are "agent produces a planning artifact, not a code change" — if [[IDEA-14]]'s phase-marking generalizes into a real non-execution task type in `agent.ts`, this idea is the second consumer of that same generalization rather than its own special case.
