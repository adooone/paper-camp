---
id: IDEA-10
title: Plan clarification pass
type: feat
status: done
created: 2026-06-27
updated: 2026-06-27
tags:
  - app
  - plans
  - core
---

The plan clarification pass, borrowed from spec-kit's /clarify: taxonomy-scanned gaps surfaced one question at a time and recorded as dated clarifications.

### Phases
- [x] Generalize extractLog into extractDatedList
      `extractLog`'s body in `src/core/parser.ts` is a generic `{ date, text }` list
      parser already; factor it into `extractDatedList(body, headingRe)` reusing
      `LOG_ENTRY_RE` unchanged, with `extractLog` becoming a one-line call into it
- [x] Add Clarifications parsing and PlanEntry field
      Add `CLARIFICATIONS_HEADING_RE = /^###\s+Clarifications\s*$/i`, call
      `extractDatedList` with it the same way `extractPhases`/`extractLog` call their
      own heading regexes, and add `clarifications?: LogEntry[]` to `PlanEntry` (parser
      and serializer), reusing the existing `LogEntry` type — no new type needed
- [x] Add clarification-pass prompt constant
      New constant in `src/app/features/plans/prompts.ts`: the taxonomy above, the
      "ask one at a time, lead with `**Recommended:** Option A — <why>`" loop
      instruction, and "write accepted answers back under `### Clarifications` as
      `- YYYY-MM-DD: Q: <question> → A: <answer>`"
- [x] Add "Clarify before starting" button to plan-detail.tsx
      Same copy-to-clipboard mechanism as `PhaseCopyButton`, placed near it, using the
      new prompt constant
- [x] Render Clarifications list in plan-detail.tsx
      Read-only dated bullets below the plan body, above Phases, styled identically to
      how `### Log` entries already render
- [x] Move Clarify button above plan description
      The Clarify button currently lives in the Phases table header area; move it above
      the plan body paragraph so it's visible before scrolling past the phase list
- [x] Compact clarification prompt
      The prompt in buildClarifyPrompt is too verbose; shrink it to only provide the
      taxonomy and output format, making instructions more general and concise
- [x] Rename Clarify button to "Copy Clarifications Prompt"
      The button currently reads "Clarify before starting", which is unclear — rename
      to "Copy Clarifications Prompt" so its purpose is obvious at a glance

### Log
- 2026-06-27: Clarify before starting button should be moved above the plan description (not in the table header). And also the promt is huge we should compact the prompt and make the instructures for clarifications more general. In prompt we can only provide where to look for clarification instructuins
- 2026-06-27: Audit appended two missing phases: button placement fix (move above plan description body) and prompt compaction (shrink to taxonomy+format only)
- 2026-06-27: We should have a clear button name - currently it is not understandable what is this button about. I think it is better to rename it to - Copy Clarifications Prompt
- 2026-06-27: icon and text are not on the same row in this Clarification button
- 2026-06-27: If you in audit check latest 2 logs about button, and add phases to fix it!!! And remove this log if you got it!
- 2026-06-27: Audit appended missing rename phase (button label still says "Clarify before starting" per log #3); icon/text layout per log #4 is already correct
- 2026-06-27: but what about icon position? I dont see phase to fix icon position in this button
