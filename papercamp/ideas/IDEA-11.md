---
id: IDEA-11
title: Phase convergence audit
---

## IDEA-11: Phase convergence audit

The companion to "The Stack" panel's existing phase-progress view and to "Plan clarification pass" above: once a plan has phases and work is underway, nothing currently re-checks whether the phase list still matches what the code actually needs. A phase written before implementation started can easily miss something that only became obvious once the work began.

`spec-kit`'s `/converge` command's mechanism is exactly the missing piece, and it's a particularly cheap one to borrow because its core discipline is a write constraint, not new logic: compare the plan's intent against the current code, and **append** any newly-discovered remaining work as new phase items at the bottom of `### Phases` — never reorder, check, uncheck, or rewrite an existing phase. If nothing's missing, it changes nothing at all, not even an empty heading.

**This needs zero parser or schema changes.** `parsePhaseEntries` (`src/core/parser.ts:46-77`) already round-trips an arbitrary list of `- [ ]`/`- [x]` lines with optional indented descriptions; appending new unchecked items to that list is just... writing more lines in the same format a human already writes by hand. The entire feature is a UI affordance plus a prompt:

- A button on `plan-detail.tsx`, next to the existing phase list — "Audit phases against code" — alongside `PhaseCopyButton`.
- A fixed prompt (same `prompts.ts` home suggested in the clarification idea above) instructing the agent: read this plan's phases and body, inspect the current repo state, and append any phase that's clearly required but missing — each as a normal `- [ ]` line, optionally with the existing indented-description format `parsePhaseEntries` already supports — at the end of the list. Explicitly never touch existing lines, checked or not. Finish by appending one line to `### Log` (the field IDEA-9 already added) summarizing what was found, e.g. `- 2026-06-25: Convergence audit — appended 2 phases (missing error-state handling, missing test coverage).` — for free, since the Stack panel's "Live" feed already narrates diffs against `plans.md`, including `### Log` additions (per IDEA-3's design).
- If the audit finds nothing missing, the prompt should say so and write nothing — matching `/converge`'s "byte-for-byte unchanged" guarantee, which is what makes the audit safe to re-run anytime without it becoming log spam.

**Decisions worth making explicit:**

- **Append-only is the entire safety property.** The value of this idea over just asking the AI "what's left?" in chat is specifically that it can never silently mark something done or reorder a phase someone's relying on the position of — that constraint belongs in the prompt text itself, stated explicitly, not left implicit.
- **No new UI for reviewing what got appended beyond the existing phase list and Log entry.** The appended phases show up exactly where any other phase would, in `plan-detail.tsx`'s normal list; this isn't a diff viewer, just a disciplined writer.
