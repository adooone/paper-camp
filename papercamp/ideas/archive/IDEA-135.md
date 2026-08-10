---
id: IDEA-135
title: Run analytics
type: feat
status: done
created: 2026-08-06
updated: 2026-08-10
tags:
  - agent
  - stats
  - server
  - ui
subject: Run & monitor
---

Every agent run already reports exactly what it cost — the app just throws
it away. The stream-json `result` event carries `duration_ms`, `num_turns`,
full token buckets (input, output, cache creation, cache read), a per-model
breakdown, and `total_cost_usd`; the stream also emits `rate_limit_event`
messages (`status`, `rateLimitType`, `resetsAt`, overage flags) that the
parser currently swallows. Both shapes verified live on subscription auth
(2026-08-06). The known token-undercount bug affects only Claude Code's
on-disk transcripts, never the live stream — so the stream is the one
source we trust, and disk transcripts are never read.

1. **Capture at the source.** The parser keeps usage, duration, and model
   from each run's `result` event and the latest `rate_limit_event`
   snapshot. Each `tasks.log` entry ([[IDEA-65]]) grows the usage record —
   the log is git-tracked, so run history is durable corpus data. Run-all
   ([[IDEA-29]]) records each phase separately at its existing per-phase
   seam.

2. **Post info on the phase, in the file.** When a phase completes, a
   compact annotation line lands under it in the idea file:
   `run: 6m40s · 1.2M in · 38k out · fable-5` — cumulative across
   attempts, with an attempt count when more than one. The entity detail
   renders Time / Tokens / Model columns for done phases straight from the
   entity. The `run:` line is a phase-grammar addition, mirrored in
   about.md's format reference.

3. **Post info on the idea.** The idea detail shows a derived rollup —
   total time, tokens, and run count including overhead runs (draft,
   reconcile, fix-review) attributed through the log. Derived at read
   time; no frontmatter counters.

4. **Stats insights.** New cards on the Stats page ([[IDEA-99]]): tokens
   and agent-minutes per week, median phase duration, most expensive
   ideas. Time trends are retroactive (timestamps already in the log);
   token trends start from landing — no backfill.

5. **Tokens are the currency.** In/out headline, full cache buckets on
   hover; USD is recorded in the log but never displayed — it's notional
   under a subscription.

6. **Claude capacity card.** Stats shows the latest rate-limit snapshot —
   status (allowed / warning / rejected), window, reset time, overage
   state — labeled "as of last agent run, Xm ago"; it refreshes only when
   agents run. The StatusBar gets a warning pill only when status leaves
   "allowed". No percent gauge: there is no official programmatic access
   to the interactive `/usage` bars (open feature request,
   anthropics/claude-code#44328), and unofficial endpoints are out. If a
   usage API ships later, the card upgrades to a real gauge.

### Phases
- [x] Capture usage and capacity from the stream
      Parser retains the `result` event's usage, duration, and model plus the latest `rate_limit_event` snapshot; run-all records each phase at its per-phase seam.
- [x] Persist the usage record into tasks.log
      Grow each git-tracked log entry with the captured usage so run history is durable.
- [x] Write the `run:` line under done phases
      Land the compact annotation in the idea file, cumulative across attempts, and mirror the grammar in about.md.
- [x] Render phase columns and the idea rollup
      Entity detail shows Time / Tokens / Model per done phase and a derived idea-level rollup, computed at read time.
- [x] Add Stats analytics cards
      Tokens and agent-minutes per week, median phase duration, most expensive ideas.
- [x] Add the capacity card and StatusBar pill
      Latest rate-limit snapshot on Stats; a warning pill in the StatusBar only when status leaves "allowed".

### Thread
- [x] 2026-08-06 [decision] Live stream is the sole usage source (disk transcripts are known-wrong); tokens not USD in the UI; capacity is a passive per-run snapshot from `rate_limit_event` — status + reset clock, no percent — rather than anything scraped or reverse-engineered.
