---
id: IDEA-199
title: Style pass as a phase action
type: feat
status: idea
created: 2026-08-21
tags:
  - app
  - agent
  - code-health
subject: Run & monitor
order: 6
---

An agent implementing a phase optimises for making it work. Nothing afterwards
reads the result back against `docs/CODE_STYLE.md`, so every plan lands slightly
heavier than it needed to be — a component that grew a fourth responsibility, a
five-line comment explaining the run, a helper that should have been shared.
[[IDEA-197]] and [[IDEA-198]] exist because that drift accumulated in one folder
until it needed its own plan.

Make the correction routine instead: a **Style pass** action in the phases list
that appends a phase the normal run-all flow then executes.

### How it behaves

It sits with the other phase-list actions — next to Add review phases, Audit and
Reconcile — and is enabled once a plan has at least one completed phase.
Pressing it appends a single phase to the plan and nothing more; the agent runs
it through run-all like any other phase, and the work lands as an ordinary
commit a human reviews.

Appending a phase rather than running an agent immediately is the point. The
pass is visible in the plan before it runs, it is checkable afterwards, its cost
shows in the phase's run line next to every other phase, and a plan's record
says plainly whether its code was ever reviewed against the guide.

### What the phase tells the agent to do

The prompt is scoped to **the files this plan changed**, never the whole
codebase — a style pass that wanders is how a refactor becomes a rewrite. It
reads `docs/CODE_STYLE.md` and applies it:

- Delete comments that fail §7. Deleting is the expected outcome; the cap is
  two lines and the default count is zero.
- Move complex logic out of components into `hooks/`, leaving components
  rendering what a hook returns.
- Sort files into the by-role folders of §4, and split a file holding more than
  one component.
- Replace a literal with its token (§2) and a hand-rolled element with its
  paper-ui component (§1).
- Extract anything now written three times (§3) — into the feature's `helpers/`
  if it is feature logic, into `@/app/utils` or `@/app/hooks` if it is not.

**Behaviour may not change.** The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` all passing, with no test edited to accommodate a change.
A test that has to change means the pass altered behaviour and went too far.

The prompt joins the others in
`src/app/features/plans/prompts/prompts.ts` and is read-write like the phase
runner, committing its own work the same way.

### Why not automatic

A style-pass phase appended at draft time would run on plans that do not need
one and would be the first thing dropped when a plan is urgent. Leaving it as an
explicit action keeps the decision with the person who just read the diff.

### Out of scope

Running it over files outside the plan's diff. Enforcing the guide — that is a
check's job, and the comment half of it is [[IDEA-196]]. Any change to what the
guide says.

### Phases
- [ ] Add a style-pass phase builder to `prompts.ts`
      Returns the appended phase (title + description) that scopes the agent to the plan's changed files, reads `docs/CODE_STYLE.md`, and ends with the three checks green and no test edited.
- [ ] Add a `StylePassButton` action that appends the phase
      Gated on the plan having at least one completed phase; append via `patchByTitle` like the review-phases path, and export it from `actions/index.ts`.
- [ ] Wire the button into the Phases toolbar next to Audit, Reconcile and Add review phases
- [ ] Test the builder output and the one-completed-phase enablement

### Thread
- [x] 2026-08-21 [log] [agent] Explicitly meant to enforce the guide state that IDEA-196/197/198 establish, so it only makes sense once those conventions and the comment gate exist.
- [x] 2026-08-21 [log] [agent] Depends on IDEA-197 and IDEA-198 having established the conventions (hooks/, helpers/, code style) that its style-pass prompt is meant to enforce going forward.
