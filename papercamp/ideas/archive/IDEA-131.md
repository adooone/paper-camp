---
id: IDEA-131
title: Faster agent runs and chat replies
type: refactor
status: done
created: 2026-08-05
updated: 2026-08-05
tags:
  - agent
  - server
  - performance
subject: Run & monitor
---

Phases run far slower than the same work done directly in chat. The gap is structural overhead in the agent pipeline, not model speed — seven settled fixes, ranked by impact:

1. **One verification owner per layer.** Today every phase is verified 2–3 times: the phase prompt (`buildAgentPrompt` / `buildFixItemPrompt` in `src/app/server/agent.ts`) orders the agent to leave the whole repo green (tsc + biome, and points at `pnpm test`), then `runQueue` re-runs the full harness gate (`runChecksAndWait` in `src/app/server/status.ts`: biome --write + lint + format + full vitest) after the agent exits — plus a full baseline gate before phase 1. Change: the agent runs only fast targeted checks (`pnpm run check-types` + `npx biome check . --write`); the harness gate is the sole owner of the full test suite. Remove `pnpm test` from `buildAgentPrompt` / `buildFixItemPrompt` entirely (point 4 covers the coverage tax in prompt text elsewhere), and drop the "fix anything red, including pre-existing failures elsewhere" clause — it contradicts the tolerated-red note and sends agents on mid-phase side quests; tolerated-red already handles pre-existing breakage honestly.

2. **Session continuity across a run-all.** Each phase spawns a fresh `claude -p` with cold context and re-explores the repo the previous phase already understood — the single biggest fixed cost, and exactly why chat (warm context) feels quicker. The claude CLI's stream-json `result` event carries a `session_id`; capture it in `parseLine` (`src/app/server/agents/claude-code.ts`), and have `runQueue` pass `--resume <session-id>` on subsequent phases and fix passes of the same run-all, so phase N starts already knowing the codebase and benefits from prompt caching. First phase of a run starts fresh; opencode (no resume support) keeps today's behavior.

3. **Slim the Scout chat path.** `TASK_KIND_TO_DEFAULT_KEY` (`src/app/server/agents/index.ts`) maps `feedback → planDraft` = opus at high effort for a conversational reply, and `buildFeedbackReplyPrompt` (`src/app/features/plans/prompts/prompts.ts`) inlines the full body of every other idea (~117, mostly done) on every message. Change: give `feedback` its own `defaultAgents` bucket (sonnet, medium effort) surfaced in Settings like the existing buckets, and send done/dropped ideas as one-line index entries (id + title + status) — full bodies only for open ideas. Same for `buildFeedbackSummaryPrompt`'s routing.

4. **No coverage tax in agent test runs.** `pnpm test` is `vitest run --coverage`; anywhere agent-facing prompt text still tells an agent to run tests, it says `npx vitest run` instead.

5. **Cache-friendly prompt ordering in the Scout chat.** Anthropic prompt caching hits on the exact stable prefix, and `buildFeedbackReplyPrompt` puts the thread (changes every message) before the corpus index (stable) — every turn invalidates the whole cache. Reorder to stable-first: persona → corpus index → idea body/phases → thread → latest message. No content change; consecutive replies reuse the cached bulk for faster first token and lower cost.

6. **Thread compaction in the reply prompt.** The reply prompt inlines the full thread history forever, while `buildFeedbackSummaryPrompt` already distills quiet sessions into one-line summaries. Send the prior session summaries plus only the last 10 thread messages instead of the whole history — the full thread stays in the entity file untouched; only the prompt is compacted.

7. **Corpus compression in `buildSuggestIdeasPrompt`.** Same full-corpus problem as feedback: it inlines every idea's body on every suggest run, but "don't duplicate this" only needs titles for finished work. Done/dropped ideas become one-line entries (id + title + status); full bodies only for open ideas — mirroring point 3's treatment.

### Phases
- [x] Make the harness gate the sole owner of the full test suite
      Trim `buildAgentPrompt`/`buildFixItemPrompt` to fast targeted checks (`check-types` + `biome check --write`), drop `pnpm test` and the pre-existing-failure clause, and replace any remaining agent-facing `pnpm test` with `npx vitest run`.
- [x] Resume the claude session across a run-all
      Capture `session_id` from the stream-json `result` event in `parseLine`, and have `runQueue` pass `--resume` on later phases and fix passes of the same run; opencode keeps today's cold-start behavior.
- [x] Give the Scout feedback path its own agent bucket
      Add a `feedback` `defaultAgents` bucket (sonnet, medium) surfaced in Settings, route `buildFeedbackReplyPrompt`/`buildFeedbackSummaryPrompt` through it, and send done/dropped ideas as one-line index entries.
- [x] Reorder and compact the Scout reply prompt
      Move to a stable-first prefix (persona → corpus index → idea → thread → latest) and inline only the prior session summaries plus the last 10 thread messages instead of the whole history.
- [x] Compress the corpus in `buildSuggestIdeasPrompt`
      Reduce done/dropped ideas to one-line entries, full bodies only for open ideas, mirroring the feedback treatment.
