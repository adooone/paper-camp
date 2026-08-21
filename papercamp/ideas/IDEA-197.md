---
id: IDEA-197
title: Break up entity-detail.tsx
type: refactor
status: idea
created: 2026-08-21
tags:
  - app
  - code-health
  - plans
subject: Code health
---

`src/app/features/plans/views/entity-detail.tsx` is 876 lines holding **twelve
components** and two loose helpers. It is the idea/plan page — the most-edited
screen in the app — and every change to any section means opening the same file.

The feature folder around it is in good shape: `hooks/`, `helpers/`, `views/`,
`actions/`, `components/` all exist and are populated, no component calls
`fetch()` directly, and tests are colocated. This file is the outlier, so the
fix is to finish sorting it into the structure that already exists rather than
invent anything new.

### What is in there

`RunCostSummary`, `PhasesSection`, `BranchRow`, `PlanProgressRow`,
`PlanBodySection`, `ClarificationsSection`, `ParentLinkRow`, `FixesSection`,
`DeliverSection`, `TrailSection`, `FeedbackSection`, and `EntityDetail` itself.

Two are far past the point of being sections:

- **`PhasesSection`** (~219 lines) renders a `Table` whose `columns` array
  defines three cell renderers inline, plus `expandable`, `rowTexture` and
  `rowClassName` callbacks. It takes 11 props.
- **`FeedbackSection`** (~129 lines) holds 3 `useState`, 2 `useEffect` and 3
  async handlers — the chat draft, the promote flow, and the send path.

### The split

Each section becomes its own file under `views/`, one component per file, and
`entity-detail.tsx` is left as the composition: fetch the entity, own the
page-level handlers, render the sections in order.

The `Table` configuration inside `PhasesSection` moves out with it — the column
definitions become named cell components in `components/`, not object literals
nested four levels into JSX. `WorkRow` construction (merging `plan.phases` and
`plan.fixes` into one row list) and `isRunningRow` are pure functions and belong
in `helpers/`.

`FeedbackSection`'s state moves into a `hooks/use-feedback-composer.ts` next to
the five feedback hooks already there, leaving the component to render what the
hook returns. `feedbackDraftKeyFor` belongs with `@/app/utils/local-draft-store`,
whose read/write/remove trio it builds keys for.

`formatRunSummary` joins `formatDuration` and `formatTokens` in
`@/core/phase-run`, which is where the other run formatters already live.
`branchEntityId` parses an entity id out of a branch name and is not
plans-specific — it moves to `@/app/utils`.

### Two fixes to make while the file is open

`entity-detail.tsx` imports from `../actions` twice and `../components` twice;
merge each into one statement.

The row highlight for review-sourced phases is
`className="bg-[rgba(155,122,181,0.08)]"` — a raw rgba, which §2 forbids. The
same purple is already named in `constants.ts` as `STATUS_STAMP.review`. Use the
named value. The wider literal problem is [[IDEA-198]]'s, not this plan's.

### Out of scope

Behaviour. This is a pure move: no prop renamed, no render output changed, no
new feature. `pnpm check-types`, `pnpm lint` and `npx vitest run` pass unchanged,
and the page looks identical. Cross-cutting convention fixes are [[IDEA-198]].
