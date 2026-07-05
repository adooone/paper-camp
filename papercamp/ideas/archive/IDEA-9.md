---
id: IDEA-9
title: Review status
type: feat
status: done
created: 2026-06-21
updated: 2026-06-21
tags:
  - app
  - plans
---

Added the review status checkpoint between in-progress and done, surfaced as a Stamp on plan cards plus a dedicated Review page.

### Phases
- [x] Fix closed-section onOpen prop
      Pass the `onOpen` prop `list-view.tsx` already wires up for active/backlog `PlanCard`s, restoring the ability to open a closed or dropped plan
- [x] Add review PlanStatus
      New status between `in-progress` and `done`; checking the last phase in `handleTogglePhase` sets `status: 'review'` automatically instead of a separate submit click
- [x] Add Review stamp to Plan Card
      `KanbanCard` and `PlanCard` show a small "Review" `Stamp` next to `PlanIdStamp` when `plan.status === 'review'`; no new `KANBAN_COLUMNS` entry or List view section — the card stays bucketed with `in-progress` for board/list purposes
- [x] Add Review page
      New top-level route (`/review`) and nav item, structured like the Plans page: its own sidebar branch and a list filtered to `status === 'review'`, opening into the existing plan-detail view
- [x] Add Approve and Needs changes actions
      On the Review page (or plan detail opened from it): "Approve & close" (`done`) or "Needs changes" (back to `in-progress`); reopening a phase is what naturally drops `allDone` back to `false`
- [x] Add per-plan Log
      A new `### Log` sub-section parsed like `### Phases`; dated bullets appended via a `Textarea` + "Add entry" button through a `PATCH /api/plans` extension, rendered in `plan-detail.tsx` below phases

### Log
- 2026-06-21: Implemented the persistent ID counter in `.paper-camp/config.json`.
- 2026-06-22: Review — counter logic looks solid; one missing migration note, fixed.
