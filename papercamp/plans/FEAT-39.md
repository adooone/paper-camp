---
id: FEAT-39
title: Build the focus cockpit
kind: feat
status: idea
created: 2026-07-04
idea: IDEA-39
tags:
  - app
  - ui
  - plans
  - stack
---

During a work session the questions that matter — what is the agent doing, are checks green, what's next — are all answered only inside the 480px Stack panel, which [[IDEA-34]] made closed by default, while the Plans landing gives 40+ closed plans the same weight as the one plan being worked. This plan restructures around the focus plan: `findFocusPlan` (`helpers.ts`) already picks it for the Stack's commit suggestion, so the Plans landing renders it as a hero card (phases, progress, run/audit controls inline) above the compact lists [[FEAT-37]] just densified; agent and check state move to a persistent status cluster in the header that [[IDEA-34]] established (`Spinner` while an agent runs, colored check `Stamp`s, `Tooltip` + `Menu` for actions — all in the package since the [[IDEA-32]] bump), superseding the collapsed-rail spinner/red-dot as the primary ambient signal; and the commit form becomes a `Modal` summoned from that cluster, slimming the Stack panel down to a git/activity drawer.

Scope boundaries: a "needs review" queue under the hero with inline Approve / Needs-changes replaces most trips to the almost-always-empty `/review` page, but the route itself stays — the route-level merge of `/review` into the Plans page (Tabs) is [[IDEA-40]]'s scope, and per its own note this plan owns only the inline queue. [[IDEA-33]]'s Toast/Tooltip adoption has landed ([[FEAT-35]]), so the cluster follows those established idioms rather than inventing new ones. Nothing blocks this: [[IDEA-34]]'s header and the [[IDEA-32]] bump have both shipped.

### Phases
- [ ] Render the focus plan hero card
      Lead the Plans landing with the `findFocusPlan` pick as a hero `Card`: title, status, the `### Phases` checklist with the next unchecked phase highlighted, the progress bar, and the run/audit/clarify controls inline (reusing `agent-start-button.tsx`, `audit-phases-button.tsx` & co. from `plan-detail.tsx`). The dense rows from FEAT-37 stay below, minus the hero plan so it isn't listed twice; when no plan is in flight, collapse the hero to a one-line "no active plan" strip rather than an empty box.
- [ ] Build the ambient header status cluster
      A persistent cluster in the `Layout` header (`router.tsx`'s `headerActions`, next to `ProjectIdentityHeader`): a `Spinner` while an agent task runs, colored `Stamp`s for the repo-health checks, and a `Tooltip` + `Menu` for actions (run tests, fix quality, view findings). State comes from the same stores the Stack panel reads today. Retire the collapsed-rail spinner/red-dot from IDEA-34 as the primary signal — the cluster is visible whether or not the Stack is open.
- [ ] Add the needs-review queue
      Under the hero, list plans with `status: review` with inline Approve (promote to `done` + archive, the existing review action) and Needs-changes buttons, reusing `review-page.tsx`'s handlers rather than duplicating them. The `/review` route stays untouched — folding it into the Plans page is IDEA-40's route-level scope.
- [ ] Summon commit from the header
      Move the commit form (title, message, file list, the `findFocusPlan`-driven suggestion) out of the Stack panel into a `Modal` opened from the header cluster. Same store state and `/api` git calls; only the mount point changes.
- [ ] Slim the Stack panel to a git/activity drawer
      With agent status, checks, and commit relocated, strip `stack-panel.tsx` down to the git/activity remainder (branch state, recent activity, findings detail). Remove now-dead sections and their store wiring rather than hiding them.
- [ ] Type-check and visual pass
      `tsc --noEmit`, `biome check`, full test suite, and a browser pass over the hero card, header cluster states (idle / agent running / checks failing), review queue, commit modal, and slimmed Stack at laptop and narrow widths — flag for a human if the session is headless.
