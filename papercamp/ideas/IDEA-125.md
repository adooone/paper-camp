---
id: IDEA-125
title: Headless runs die as bare "error" when the agent hits a permission ask
type: fix
status: idea
created: 2026-08-04
tags:
  - agents
  - tasks
---

Observed in the func-ui corpus (run-all on its IDEA-2, agent: opencode): the agent tried to read a sibling repo as an API reference (`~/dev/paper-ui/src/components/select/*`), the agent harness raised an `external_directory` permission ask, the headless runner auto-replied with a denial within milliseconds, and the run ended `outcome: "error"` — with no reason recorded in tasks.log and nothing actionable on the board. Diagnosis required digging through the agent's own log files.

Two layers to fix:

- **Record the reason**: tasks.log entries (and the task detail view) should carry the failing cause — "permission denied: read outside workspace: <path>" — not just `error`.
- **Park instead of kill**: a permission ask mid-run is a human decision, which is exactly what thread questions are for. Surface it as a parked question on the idea ([[IDEA-118]]'s inbox is the natural home) with resume-on-answer, instead of auto-denying and erroring the run.

Workaround meanwhile: pre-grant sibling-repo read access in the agent's permission config per project.

### Phases
- [x] Capture the permission-ask cause from the agent harness
      Detect the `external_directory` (and sibling permission) event and extract a human string like "read outside workspace: <path>".
- [x] Record the cause in tasks.log and task detail
      Carry the failing reason on the entry instead of a bare `error`, and surface it in the task detail view.
- [ ] Intercept the ask instead of auto-denying
      Stop the headless runner from instantly replying with a denial when a permission ask arrives mid-run.
- [ ] Park the ask as a question on the idea
      Route it into the parked-decisions inbox ([[IDEA-118]]) with the path and the requesting phase attached.
- [ ] Resume the run on answer
      Re-enter the paused run when the human grants or denies, continuing or failing cleanly with the recorded cause.
- [ ] Verify against an external-directory ask
      Reproduce the func-ui sibling-repo read and confirm the run parks, records the reason, and resumes on answer.
