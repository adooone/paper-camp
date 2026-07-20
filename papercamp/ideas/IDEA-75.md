---
id: IDEA-75
title: Error surfacing consistency
status: idea
created: 2026-07-20
subject: Workflow
type: fix
tags: [errors, ui, toast]
---

every failure path reads as a one-line toast (git errors do now; agent-launch and config errors should match).

From the roadmap: Horizon 1 — Ready for daily use.

### Phases
- [x] Generalize the git one-line summary into a shared error formatter
      `gitErrorSummary` (stack-panel/shared.ts) already reduces multi-line output to the line that states the problem; lift that logic into a reusable helper that also handles spawned-CLI stderr, and keep git routed through it.
- [x] Route agent-launch failures through the one-line summary
      `agent-start-button.tsx` and `agent-section.tsx` currently dump raw `(err as Error).message`; run agent-launch/stop errors through the shared summary so multi-line CLI stderr reads as one line.
- [x] Surface config-save failures with their cause
      `settings-page.tsx`'s "Failed to save" toast shows no description; add the one-line reason so config errors match the git and agent toasts.
- [x] Sweep remaining failure toasts for consistency
      Check the other `toast(... variant: 'error')` call sites for raw multi-line messages or missing descriptions and align them with the shared formatter.
- [ ] Type-check and full pass
