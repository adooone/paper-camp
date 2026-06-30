---
id: IDEA-10
title: Plan clarification pass
---

### IDEA-10: Plan clarification pass

Three ideas below (this one, "Phase convergence audit", and "Plan/decision consistency check") came out of looking at how GitHub's `spec-kit` and similar spec-driven tools structure the AI's side of planning — not to adopt their per-feature folder pipeline (`about.md` already rejected that ceremony on purpose), but because a few of their individual mechanisms are genuinely portable onto the plan record shape this project already has.

Right now a plan goes from `idea` to `planned` with whatever ambiguity was in the original prose — nothing forces a pass over scope, edge cases, or non-functional constraints before phases get written. `spec-kit`'s `/clarify` command's actual algorithm (not just its existence) is worth borrowing directly: scan against a fixed taxonomy (functional scope, data model, UX flow, non-functional attributes, edge cases, terminology, completion signals), surface at most 5 of the highest-impact gaps, and ask **one question at a time**, each with a stated recommendation up front (`**Recommended:** Option A — <why>`) so the default answer is just "yes." This turns an open-ended "anything unclear?" into a bounded, low-effort loop.

**Where it lives — a new optional `### Clarifications` sub-section per plan**, parsed the same way `### Phases` and `### Log` already are. `extractLog` (`src/core/parser.ts:99-102`) and `extractPhases` (`src/core/parser.ts:79-82`) both already go through the generic `extractSection` helper (`parser.ts:22-44`); this needs the same treatment, not a new one-off parser:

- Generalize `extractLog`'s body into an `extractDatedList(body, headingRe)` helper, since a clarification entry and a `LogEntry` are the same shape (`{ date, text }`) — `LOG_ENTRY_RE`'s `^-\s+(\d{4}-\d{2}-\d{2}):\s*(.*)$` pattern works unchanged for `- 2026-06-25: Q: <question> → A: <answer>` lines.
- Add `CLARIFICATIONS_HEADING_RE = /^###\s+Clarifications\s*$/i` and call the generalized helper with it, same as `extractPhases`/`extractLog` do with their own heading regexes.
- `PlanEntry` gains `clarifications?: LogEntry[]`, reusing the existing `LogEntry` type from `src/types/index.ts` — no new type needed.

**Where the taxonomy/loop logic lives — a static prompt, not new app logic.** The existing "AI focus handoff" pattern (`PhaseCopyButton`, `src/app/features/plans/components/phase-copy-button.tsx:41`) is a one-line template (`Start phase ${phaseIndex + 1} of plan "${planTitle}"...`) copied to the clipboard. This idea needs the same mechanism — a button on `plan-detail.tsx`, e.g. "Clarify before starting" — but with a longer fixed prompt constant (the taxonomy + the "ask one at a time, lead with a recommendation, write accepted answers back under `### Clarifications`" instructions), since one line can't carry it. Worth a small `src/app/features/plans/prompts.ts` once there's more than one of these — this idea plus "Phase convergence audit" below both need a prompt constant longer than `PhaseCopyButton`'s current inline template literal.

**Rendering**: a read-only list below the plan body, above Phases, styled identically to how `### Log` entries already render in `plan-detail.tsx` (dated bullets) — this is presented context, not something edited directly in the UI; corrections happen by re-running the clarify prompt or hand-editing the markdown.

**Decisions worth making explicit:**

- **No session grouping, unlike `spec-kit`'s `### Session YYYY-MM-DD` subheadings.** Each clarification entry already carries its own date via the reused `LogEntry`/`LOG_ENTRY_RE` shape; grouping multiple same-day answers under a second heading level is ceremony this project's "no numbering scheme, no status tables" stance (`about.md`) doesn't need.
- **Trigger point is `idea`/`planned` → about to start, not enforced.** Nothing blocks moving a plan to `in-progress` without a clarification pass — it's an available tool for plans worth the 5-question overhead, not a gate every plan must pass through.
