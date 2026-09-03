---
id: IDEA-225
title: Capacity indicator in the Stack panel
type: feat
status: in-progress
created: 2026-09-01
updated: 2026-09-03
tags:
  - app
  - stack
subject: Run & monitor
---

Capacity never displays, and the reason is a parser reading the wrong key —
not, as this idea originally claimed, an absence of data. That claim was
wrong and is corrected here.

Measured live: `claude -p ... --output-format stream-json` emits a
`rate_limit_event` on **every** run, ordinary ones included, carrying the
exact figures the `/usage` ring shows:

```
"rate_limit_info": {
  "status": "allowed", "rateLimitType": "five_hour", "isUsingOverage": false,
  "unifiedWindows": {
    "five_hour": { "utilization": 0.11, "resetsAt": 1788436800 },
    "seven_day": { "utilization": 0.06, "resetsAt": 1788768000 }
  }
}
```

So a true percentage *is* available, for both windows, with each window's
own reset time. `extractRateLimit` looks for `json.rate_limit ??
json.rateLimit ?? json`; the key is `rate_limit_info`, so it falls through
to the whole event, finds no top-level `status`, and returns `null` on
every run. That single mismatch is why the task log holds zero rate-limit
entries. `overage` is mismatched the same way — it reads
`overage`/`usingOverage`/`overageActive`, and the field is `isUsingOverage`.
`RateLimitSnapshot` then has nowhere to put `unifiedWindows` even once
parsing is fixed.

**The bar is driven by `five_hour.utilization`.** The reset-window
countdown this idea previously specified was a stand-in for a percentage
believed unavailable; the real number replaces it, with `resetsAt` shown
beside it as "resets in 4h 7m" rather than as the bar itself. `seven_day`
sits under it as a second, quieter row.

**Capacity is captured, never polled.** The event is already in the stream
of every agent run, so each completed run stores its snapshot for free —
that is the normal path, and no run is started to measure anything. For a
reading that includes usage spent outside paper-camp (an interactive Claude
Code session, the chat), a **Refresh** control fetches on demand: spawn
`claude -p`, kill the process the moment the `rate_limit_event` arrives,
and keep the payload. Measured at **~3.4s**, and free — the event is the
second line of the stream, before any model output, and utilization read
`0.11` identically across two consecutive probes. There is no timer and no
background polling; a reading is refreshed because the user asked or
because a job finished.

Stale readings say so. A snapshot carries the moment it was captured, and
the indicator shows its age rather than implying it is live.

### Out of scope

Polling on an interval. A token count — the payload carries a fraction of
each window, never tokens, and neither does the ring it mirrors. Context
window size, which is per-conversation and unrelated to plan capacity.
opencode capacity, which reports nothing comparable today.

### Phases
- [x] Read capacity from the in-flight task
      Expose the running task's `rateLimit` on the agent status route so a limit hit shows during the run, not after it.
      run: 7m43s · 92 in · 23.4k out · sonnet-5
- [x] Expire spent snapshots
      `latestCapacity` treats a snapshot whose `resetsAt` has passed as unknown rather than current.
      run: 4m36s · 42 in · 7.9k out · sonnet-5
- [x] Sum window spend from the task log
      Tokens and cost across runs since the current window opened, exposed beside the snapshot.
- [x] Add the compact indicator to the Stack panel
      One row: the reset-window bar when known, window spend, status stamp and overage, with `null` rendering as a quiet resting state.
      run: 17m15s · 166 in · 53.5k out · sonnet-5
- [x] Reword the empty state on both surfaces
      Silence means healthy, not missing — the Stats card and the new indicator both say so.
      run: 3m32s · 24 in · 3.5k out · sonnet-5
- [x] Cover it in tests and run the quality checks
      Expiry, window summing, and the absent-snapshot path covered; check-types, lint, vitest, consistency green.
      run: 4m40s · 32 in · 11k out · sonnet-5
- [x] Parse `rate_limit_info` and its real field names
      Read the `rate_limit_info` key, take `isUsingOverage` for overage, and keep the older key spellings as fallbacks.
- [x] Carry both windows on the snapshot
      `RateLimitSnapshot` gains `unifiedWindows` (`five_hour` and `seven_day`, each `utilization` + `resetsAt`).
- [x] Drive the indicator from real utilization
      The bar shows `five_hour.utilization`, `resetsAt` renders as time-to-reset beside it, `seven_day` as a quieter second row, and the reading shows its age.
- [x] Fetch on demand with a Refresh control
      Spawn `claude -p`, keep the first `rate_limit_event`, kill the process immediately; no timer, no polling.
- [x] Retire the local spend sum if the real number covers it
      Window spend was a substitute for the percentage; keep it only if it still says something utilization does not.
- [x] Cover the corrected path in tests and run the quality checks
      Real payload shape parsed, both windows surfaced, probe kills on first event; check-types, lint, vitest, consistency green.
- [x] [manual] Parse rate_limit_info and drive capacity from real utilization

### Thread
- [x] 2026-09-03 [decision] [agent] Capacity is captured from runs and refreshed on click — never polled. Every agent run already carries the event, so storing it costs nothing; a Refresh control covers usage spent outside paper-camp. Measured: the probe kills on the second stream line, ~3.4s, with utilization unchanged (0.11) across two consecutive probes.
- [x] 2026-09-03 [log] [agent] Correcting this idea's original premise: it asserted no true percentage was available and that the CLI exposed no way to ask. Both were wrong — `rate_limit_info.unifiedWindows` carries `utilization` and `resetsAt` for the five-hour and seven-day windows on every run. The six phases already marked done were built against that wrong premise, which is why the shipped indicator cannot display a percentage.
- [x] 2026-09-03 [log] [agent] Parser and type fixed and verified against the captured live payload: `parseLine` now returns both windows with real utilization where it previously returned `null` on every run. Three tests lock the live shape in, including `isUsingOverage` and a malformed window. `capturedAt` was tried on the snapshot and removed — it made the parser non-deterministic, and `CapacityStat` already stamps a captured-at at the storage layer; the refresh probe will stamp its own. check-types, lint (613 files, 0 over the comment cap), and knip/depcruise (629 modules) green.
- [x] 2026-09-03 [log] [agent] Remaining phases carried out directly. The Stack row now draws a bar per window from `unifiedWindows[key].utilization` with `resetsAt` rendered as time-to-reset beside it and the reading's age in the header; the Stats card shows the same percentages. Window spend was retired — `sumWindowSpend`, `windowStartMs`, `entryUsageTotals` and the `WindowSpend` type are gone, taking `rate-limit.ts` from 110 lines to 47, and `mergeLiveCapacity` now returns just the snapshot plus a `capturedAt` that is null while a run is in flight. Refresh is a POST `/api/capacity/refresh` spawning `claude -p` and killing on the first `rate_limit_event`; verified live at 6.2s returning real utilization. depcruise caught the probe importing the agent adapter from `core/`, so it moved to `src/app/server/capacity-probe.ts`. Full suite 1456 passed, lint 618 files 0 over the comment cap, knip/depcruise 635 modules clean.
