---
id: IDEA-9
title: Review status
---

### IDEA-9: Review status

Two real gaps found while reading `plan-detail.tsx` and `closed-section.tsx` just now, both pointing at the same underlying problem: once a plan is marked complete, you lose visibility into it.

- `plan-detail.tsx`'s `handleMarkDone` jumps straight from "all phases checked" to `Status: done` — there's no human checkpoint in between. The "Mark complete" button fires the instant `allDone` is true.
- `closed-section.tsx` renders closed/dropped plans with `<PlanCard plan={p} />` and **no `onOpen` prop** — `PlanCard` only renders its "Open" button `if (onOpen)`, and the card's outer `div` has no click handler either (unlike `IdeaCard`, which does). So a closed plan in list view is genuinely unopenable today — confirmed by reading the component, not a guess.

**A new `review` status closes the first gap:** `PlanStatus` gains `review`, sitting between `in-progress` and `done`. The transition into it is automatic, not a button: `handleTogglePhase` already recomputes `allDone` on every toggle — when checking a phase makes it true, the same call sets `status: 'review'` instead of leaving it `in-progress`, no separate "Submit for review" click required. The "Mark complete" button disappears entirely; completing the last phase *is* the submission. A plan in `review` gets two manual outcomes: **"Approve & close"** (`status: 'done'`) or **"Needs changes"** (`status: 'in-progress'`, sent back — and since phases are already all checked at that point, reopening one of them is what naturally drops `allDone` back to `false`, so there's no separate "uncheck everything" step). Phase checkmarks otherwise survive every transition untouched — whatever's wrong belongs in the Log (below), not in mass-unchecking boxes.

**Where it lives in the layout — a dedicated Review page, not a new column or section.** Board view and List view keep their current shape: `KANBAN_COLUMNS` stays `planned` / `in-progress` (no third column), and `list-view.tsx`'s section filters stay as they are (no new "Review" section between "In progress" and "Backlog"). A plan that flips to `review` simply stays wherever it already renders — bucketed with `in-progress` for board/list purposes — and gets called out with a small `Stamp` reading "Review" next to its `PlanIdStamp` on `KanbanCard` and `PlanCard`, reusing the same `Stamp`/`STATUS_STAMP` pattern already used for tags and IDs. That's the only change to the existing board/list components.

The actual review workflow — "Approve & close" / "Needs changes", and the Log below — lives on a **new top-level Review page**, structured like the Plans page: its own route (`/review`) and nav item in `router.tsx`'s `navItems`, its own sidebar branch in `RootLayout`, and a list filtered to `status === 'review'` across all plans, each opening into the same plan-detail view used elsewhere. This gives review a dedicated place to work from — a "what's waiting on me" queue — without retrofitting the Board/List filters to carry a status they don't otherwise need to display as a column.

**Fix `closed-section.tsx`:** pass the same `onOpen` prop `list-view.tsx` already wires up for the active/backlog `PlanCard`s. This alone restores the ability to open a closed or dropped plan and read what's in it — independent of everything else in this idea, and worth doing regardless.

**A per-plan Log, available on every plan, not just ones in review:** a new `### Log` sub-section in the plan's markdown block, parsed the same way `### Phases` already is — extending `src/core/parser.ts`'s existing heading-block extraction rather than writing a second one-off parser for it — formatted as dated bullets that deliberately mirror `progress.md`'s own `## YYYY-MM-DD` / `- item` shape, just scoped to one plan instead of the whole project:
```
### Log
- 2026-06-21: Implemented the persistent ID counter in `.paper-camp/config.json`.
- 2026-06-22: Review — counter logic looks solid; one missing migration note, fixed.
```
Rendered in `plan-detail.tsx` below the phases list, with a small `Textarea` + "Add entry" button appending a new dated line via a `PATCH /api/plans` extension. No second write target needed for the Stack panel's "Live" feed either — it already narrates diffs between the previous and current parsed `plans.md`, so a new Log line shows up there automatically the same way a checked-off phase already does, with zero new plumbing.

**Decisions worth making explicit:**

- **Phase checkmarks survive "Needs changes."** Reopening a plan doesn't reset progress — what needs fixing gets written as a new Log entry, not represented by un-ticking a box that was honestly completed.
- **Log entries are manual-only for v1.** An AI agent appending its own checkpoints there instead of (or alongside) `progress.md` is a natural extension once the "Agent orchestration" idea's "write checkpoints as you go" convention exists, but isn't required to ship this.
