---
id: IDEA-225
title: Capacity indicator in the Stack panel
type: feat
status: idea
created: 2026-09-01
tags:
  - app
  - stack
subject: Run & monitor
---

Capacity is built and has never once displayed. The pipeline is complete —
`claude-code.ts` parses a `rate_limit_event` into a `RateLimitSnapshot`,
`agent.ts` stores it on the task, it reaches `tasks.log`, `latestCapacity()`
finds the newest, and `ClaudeCapacityCard` renders it on Stats. Measured in
this repo's log: 9 entries, every one carrying token usage, **zero carrying
a rate limit**. Nothing is broken. The CLI emits `rate_limit_event` only
when there is a limit worth reporting, so under normal use the card
truthfully says no run has reported capacity, forever.

**A true percentage is not available, and the feature should stop implying
one.** `RateLimitSnapshot` is `{status, rateLimitType?, resetsAt?,
overage?}` — a status string, a reset timestamp, a boolean. There is no
numerator and no denominator anywhere in it, and the CLI exposes no way to
ask: `claude --help` on 2.1.250 has no usage, limit, or quota flag. Any bar
claiming "73% left" would be invented.

What *is* real, and what the indicator shows:

- **The window draining.** When `resetsAt` is known, time elapsed against
  time remaining is a genuine fraction and makes a genuine bar. This is the
  only honest progress bar available, and it answers the question that
  actually matters when limited: how long until it clears.
- **Spend since the window opened.** Every run already records
  `inputTokens`, `outputTokens`, and `costUsd` — `usagePerWeek` and
  `mostExpensiveIdeas` are built from them. Summing the runs inside the
  current window is a measured number shown as a number, with no fake
  denominator.
- **Status, with its age.** `allowed` / `warning` / `rejected` via
  `capacityLevel`, the overage flag, and how long ago it was captured.

It lives in the Stack panel, next to the agent it constrains, as a single
compact row — not a card, and not only on Stats, which is the one place a
user monitoring a run is not looking. Stats keeps its detailed card.

Three fixes to what exists:

1. The live task's `rateLimit` is only read back out of `tasks.log` after
   the run ends, so a limit hit mid-run stays invisible until it is over.
   The indicator reads the in-flight task too.
2. A snapshot whose `resetsAt` has passed is spent, not current.
   `latestCapacity` returns it forever regardless; expired snapshots read
   as unknown.
3. "No agent run has reported capacity yet" describes the mechanism as a
   gap. It says instead that Claude reports capacity only near a limit, so
   silence is the healthy state.

### Out of scope

Inventing a percentage, or a config field for the user to type their plan's
limit into so one can be computed. Polling Anthropic for quota — the runtime
drives the `claude` CLI and holds no API credentials of its own. opencode
capacity, which reports nothing comparable today.

### Phases
- [x] Read capacity from the in-flight task
      Expose the running task's `rateLimit` on the agent status route so a limit hit shows during the run, not after it.
      run: 7m43s · 92 in · 23.4k out · sonnet-5
- [x] Expire spent snapshots
      `latestCapacity` treats a snapshot whose `resetsAt` has passed as unknown rather than current.
      run: 4m36s · 42 in · 7.9k out · sonnet-5
- [x] Sum window spend from the task log
      Tokens and cost across runs since the current window opened, exposed beside the snapshot.
- [ ] Add the compact indicator to the Stack panel
      One row: the reset-window bar when known, window spend, status stamp and overage, with `null` rendering as a quiet resting state.
- [ ] Reword the empty state on both surfaces
      Silence means healthy, not missing — the Stats card and the new indicator both say so.
- [ ] Cover it in tests and run the quality checks
      Expiry, window summing, and the absent-snapshot path covered; check-types, lint, vitest, consistency green.
