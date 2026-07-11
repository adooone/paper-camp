---
id: IDEA-39
title: Build the focus cockpit
type: feat
status: review
created: 2026-07-04
updated: 2026-07-11
tags:
  - app
  - ui
  - plans
  - stack
---

During a work session the questions that matter are "what is the agent doing, are checks green, what's next" — and today all three answers live only inside the 480px Stack panel, which is closed by default since [[IDEA-34]], while the Plans landing gives 40+ closed plans the same weight as the one plan being worked.

- **Plans landing stays a uniform list.** A focus-plan hero card (phases, progress, inline run/audit controls) was tried at the top of the list but read as too heavy a block and was removed; every plan gets the same compact row, and the focus plan's controls live in its detail view and the Stack panel.
- **Agent and checks become ambient — in a full-width status bar under the header.** A thin strip below the `Layout` header shows branch/git state, colored check `Stamp`s, and an agent `Spinner`, plus a few quick actions (run tests, fix quality, commit). Closing the Stack should never mean flying blind; this is the ambient glance, superseding the collapsed-rail spinner/red-dot [[IDEA-34]] shipped. It is deliberately *not* a header cluster and *not* a replacement for the Stack.
- **The Stack panel stays the control surface.** Commit form, agent card/log, interactive check runs, and the activity feed all live in the Stack as they did. The status bar's Commit quick action fires `quickCommit()` directly (auto-suggested message, immediate commit, toast feedback) rather than opening the panel — a deliberate shortcut for the common case; the panel remains where you go for the full commit form or anything else.
- **Review folds into the flow.** A "needs review" queue under the Plans list with inline Approve / Needs-changes replaces most trips to the `/review` page, which [[IDEA-40]] has since retired by folding review into the Plans route.

[[IDEA-34]]'s header and the [[IDEA-32]] bump have landed, so nothing blocks this; coordinate with [[IDEA-33]] where its Toast/Tooltip adoption overlaps.

This plan restructures the work session around the focus plan without dismantling the Stack panel. `findFocusPlan` (`helpers.ts`) already picks the active plan for the Stack's commit suggestion, so the Plans landing renders it as a hero card (phases, progress, run/audit controls inline) above the compact lists [[FEAT-37]] densified. Ambient signal — what the agent is doing, whether checks are green — moves to a full-width status bar directly under the `Layout` header: branch and git state, colored check `Stamp`s, an agent `Spinner`, and quick-action buttons that open the Stack panel for the detail. Crucially, the Stack panel itself is unchanged as the control surface — commit form, agent log, interactive checks, and activity all still live there; the bar is a glance that links in, not a hollowed-out drawer.

Scope boundaries: a "needs review" queue under the hero with inline Approve / Needs-changes replaces most trips to the `/review` page — the route-level merge of `/review` into the Plans page is [[IDEA-40]]'s scope, now landed, and per its own note this plan owns only the inline queue. [[IDEA-33]]'s Toast/Tooltip adoption has landed ([[FEAT-35]]), so the status bar follows those established idioms. Nothing blocks this: [[IDEA-34]]'s header and the [[IDEA-32]] bump have both shipped.

### Phases
- [x] ~~Render the focus plan hero card~~ (reverted 2026-07-11)
      Built a `FocusPlanHero` (phases checklist, progress bar, inline run/audit controls) leading the Plans landing, but on seeing it in place it read as too heavy a block at the top of the list — removed. The list now shows all plans uniformly; the focus plan's controls stay in its detail view and the Stack panel. `focus-plan-hero.tsx` deleted; `plans-page.tsx` no longer filters the focus plan out of the worklist.
- [x] Build the ambient under-header status bar
      A full-width strip under the `Layout` header (`router.tsx`, above the content — not crammed into `headerActions`): branch, git-ahead, and changed-file count; a `Spinner` while an agent task runs; colored `Stamp`s for the repo-health checks; and quick-action `Button`s (run tests, fix quality, commit, findings). Reads the same stores the Stack panel does; the commit and findings actions open the Stack rather than acting inline. Retire the collapsed-rail spinner/red-dot from IDEA-34 as the primary signal.
- [x] Add the needs-review queue
      Under the hero, list plans with `status: review` with inline Approve (promote to `done` + archive, the existing review action) and Needs-changes buttons, reusing `plan-actions-column.tsx`'s handlers rather than duplicating them. The `/review` route has already been folded into the Plans page by IDEA-40's route-level scope.
- [x] Keep the Stack panel as the full control surface
      Commit form (title, message, file list, the `findFocusPlan`-driven suggestion), agent card/log, interactive check stamps, and the activity feed all stay in `stack-panel.tsx`. The status bar is an ambient glance that links into the panel, never a replacement. (Course-corrected: an earlier pass moved commit into a `Modal` and slimmed the panel to a read-only drawer — reverted, since the panel is the intended control surface.)
- [x] Type-check and visual pass
      `tsc --noEmit`, `biome check`, full test suite, and a browser pass over the hero card, the status-bar states (idle / agent running / checks failing), the review queue, and the full Stack panel at laptop and narrow widths — flag for a human if the session is headless.

### Log
- 2026-07-11: Course-corrected after review. The first implementation over-reached: it moved agent status, checks, and the commit form into a header cluster + commit `Modal` and slimmed the Stack panel to a read-only git/activity drawer — not the intent. Restored the Stack panel as the full control surface (commit / agent / checks / activity), replaced the header cluster with a full-width status bar under the header (ambient glance + quick actions that open the Stack), deleted the commit `Modal`, and kept the hero card and needs-review queue. Description and phases rewritten to match.
- 2026-07-11: Removed the focus-plan hero card too — in place it read as too large a block at the top of the list. Deleted `focus-plan-hero.tsx`, dropped the worklist filter that hid the focus plan, so the list shows every plan uniformly. Kept the status bar and the needs-review queue. The under-header status bar also gained the parchment→kraft texture treatment, 32px height, action icons, and 2xs text during this pass.
