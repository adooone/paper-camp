---
id: IDEA-39
title: Focus cockpit and ambient status
---

## IDEA-39: Focus cockpit and ambient status

During a work session the questions that matter are "what is the agent doing, are checks green, what's next" — and today all three answers live only inside the 480px Stack panel, which is closed (or crushing the layout) most of the time, while the Plans landing gives 37 closed plans the same weight as the one plan being worked.

- **Plans landing leads with the focus plan.** `findFocusPlan` (`helpers.ts`) already picks it for the Stack's commit suggestion; render it as a hero card — phases, progress, run/audit controls inline — with everything else demoted to compact lists below.
- **Agent and checks become ambient.** A persistent status cluster in the header ([[IDEA-34]] moves navigation there): `Spinner` while an agent runs, colored check `Stamp`s, `Tooltip` + `Menu` for actions (run tests, fix quality, view findings — after [[IDEA-32]]). Closing the Stack should never mean flying blind; this supersedes [[IDEA-34]]'s collapsed-rail signal as the primary surface.
- **Review folds into the flow.** A "needs review" queue under the hero with inline Approve / Needs-changes replaces most trips to the almost-always-empty `/review` page (see [[IDEA-40]] for the route-level merge — pick one owner).
- **Commit becomes summonable.** The commit form (title, message, file list) opens as a `Modal` from the header cluster; the Stack panel slims down to a git/activity drawer.

Depends on [[IDEA-34]]'s header; the Tooltip/Menu/Toast pieces need [[IDEA-32]]/[[IDEA-33]].
