---
id: IDEA-334
title: Parked questions need a real marker
type: fix
status: planned
created: 2026-11-15
updated: 2026-11-15
tags:
  - server
  - agent
subject: Run & monitor
---

IDEA-325's run parked on a question that was never asked. `extractDecision`
(`src/app/server/agent.ts`) scans every text line the adapter emits for
`NEEDS-DECISION:` with `indexOf`, and the claude-code adapter
(`agents/claude-code.ts`) emits tool-result bodies as text too. The run
had executed `pgrep -af claude` while hunting leaked processes, which
printed the daemon's own `claude -p "<prompt>" …` command line, and the
prompt embeds `NEEDS_DECISION_PROTOCOL` from `prompts.ts`. The flattened
line matched, the single-line branch accepted it with no length check,
and a `[question]` whose text was the literal template ("<one question,
at most 140 characters, ending in ?> OPTION: …") landed on the thread,
the task was marked `question` and the idea sat in `in-progress` with its
only phase done.

**A decision comes from the assistant, at the start of a line.** The
adapters tag each text event with its source, `assistant` or `tool`, and
`extractDecision` only reads `assistant` text. The marker must start a
line (`^NEEDS-DECISION:`). Both forms, multi-line and single-line, apply
the same limits: the question at most 140 characters and ending in `?`,
two to four `OPTION:` entries each at most 80 characters, and no `<` `>`
placeholder brackets. Text that fails any check is ordinary output and is
ignored.

**Acceptance.** The leaked `pgrep` line, saved as a fixture, produces no
decision. A real `NEEDS-DECISION:` block from assistant text still parks
the run with its options.

### Phases
- [ ] Decision marker only from assistant text
      Adapters mark text events `source: 'assistant' | 'tool'` (`agents/claude-code.ts`, `agents/opencode.ts`); `extractDecision` in `agent.ts` ignores tool text, anchors the marker to a line start and validates both forms (question length and `?`, 2–4 options of at most 80 characters, no angle-bracket placeholders); tests with the leaked command line as a fixture and a valid block.
