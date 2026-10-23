---
id: IDEA-314
title: Corpus and capacity that stay current
type: fix
status: in-progress
idea: IDEA-307
created: 2026-10-21
tags:
  - server
  - core
  - mcp
  - app
subject: Code health
order: 3
---

Reviews of IDEA-307 and IDEA-310 against their code found the corpus
snapshot serving stale status after a commit, entity writes that can lose
each other, MCP tools that misreport daemon failures, two readers still
parsing raw files, and a capacity card that probes on every render.

**The snapshot key ignores main.** `readCorpus` (`src/core/corpus.ts:146`)
keys the cache on the ideas fingerprint and the PR map's `fetchedAt`, but the
snapshot's derived status also depends on `resolveIdsWithMainActivity`,
which is keyed on main's sha. Edit `IDEA-X.md`, build the snapshot, then
commit it to main without touching the file: fingerprint and `fetchedAt` are
unchanged, so the idea stays `idea` instead of `in-progress` until the next
file edit. The key becomes `${fingerprint}:${fetchedAt}:${mainSha}`, with
`mainSha` the `rev-parse` result `resolveIdsWithMainActivity` already
computes. A test commits between two reads and asserts the status moved.

**Entity writes can overwrite each other.** `updateEntity`
(`corpus.ts:266`) reads, mutates and writes with nothing serialising two
callers on the same root, and the MCP `update_phase` tool does its own GET
then PATCH of the whole `phases` array (`src/mcp/tools.ts:174`), so a hook
or dashboard write landing between the two is lost. Every `updateEntity`,
`appendThread` and `createIdea` call on a root runs through one per-root
promise chain, the way `assignEntityId` already uses `idAssignmentChain`.
`PATCH /api/entities` accepts `phase: { index, done }` alongside the existing
fields and applies it inside the serialised update; `update_phase` sends
that instead of the full array. A test fires two concurrent phase toggles on
different indexes and asserts both land.

**MCP errors mislead.** `tools.ts:46` runs `JSON.parse` on every response
body, so a non-JSON 403 or proxy page surfaces as a SyntaxError, and a
`fetch` failure against a stale `daemon.json` reads "fetch failed". A
response with a non-JSON body throws `"<status> <statusText>"` with the first
200 characters of the body; a failed `fetch` throws `NO_DAEMON_ERROR`.

**Two readers still parse raw files.** `/api/parked-questions` and
`/api/notifications` (`src/app/server/routes/reads.ts:86,92`) call
`readParkedQuestions`, which re-parses the ideas directory through
`readEntities`. `readParkedQuestions` takes the snapshot's entries, and both
routes read them from `readCorpus`. The corpus test logs parses through a
counter and asserts one parse per `changed` tick across both routes.

**The capacity card probes on every load.** The mount effect in
`src/app/components/stack-panel/capacity-row.tsx:134` lists `record` as a
dependency, and `record` is `null` while the query loads, so every mount
spawns the CLI even with a fresh `capacity.json`; an expired or missing
window re-triggers it on each new `record` object, in a loop. The effect
waits for the query to settle once (a ref flips on the first non-loading
render), then probes only if there is no record or the five-hour window has
reset, and never again until remount. The explanatory comment goes with it.

**A finished run leaves the card stale.** `writeCapacity(..., 'run')` at
`src/app/server/agent.ts:771` and `:873` does not publish a `capacity`
event, so when a run ends the live overlay drops to the cached query value.
Both writes publish `capacity` through `activity.publish`, as the route
does.

**Percentages run past 100 and the header counts down to zero.** The stamp
and bar at `capacity-row.tsx:68,100` show `112%` in the overage case; the
value is clamped to 0–100 for both. With an expired five-hour window the
header reads *Resets in 0m* beside a *reset* stamp (`:160`); when
`resetsAt` is in the past it reads *Window reset*.

**Comments that restate the code** in `capacity-row.tsx:102,132`,
`capacity-api.ts:4` and `agent-section.tsx:42-48` are removed.

Done when a commit to main moves an edited idea's status without a file
edit, two concurrent phase toggles both land, an MCP call against a dead
daemon reads `NO_DAEMON_ERROR`, a `changed` tick parses the corpus once for
parked questions and notifications together, mounting the capacity card with
a fresh file spawns no probe, a run ending refreshes the card, and the stamp
never exceeds 100%.

### Out of scope

`/api/doctor` and `/api/stats`, which keep their own readers. Any new
capacity data.

### Phases
- [x] Key the snapshot on main's sha
      `mainSha` in the cache key from the sha `resolveIdsWithMainActivity`
      computes; a test commits between reads.
      run: 1m54s · 40 in · 5k out · sonnet-5 · sess:0980ec63-45e1-4f90-a265-b6357e0083e4
- [x] Serialise entity writes and send phase ops
      Per-root chain for `updateEntity`, `appendThread`, `createIdea`;
      `phase: { index, done }` on `PATCH /api/entities`; `update_phase`
      sends it; concurrent-toggle test.
      run: 5m58s · 66 in · 14.8k out · sonnet-5 · sess:0980ec63-45e1-4f90-a265-b6357e0083e4
- [x] MCP errors that name the cause
      Non-JSON bodies throw status and text; `fetch` failures throw
      `NO_DAEMON_ERROR`; tool tests for both.
      run: 1m23s · 26 in · 4.9k out · sonnet-5 · sess:0980ec63-45e1-4f90-a265-b6357e0083e4
- [ ] Parked questions and notifications from the snapshot
      `readParkedQuestions(entries)`; both routes read `readCorpus`; parse
      counter asserts one parse per tick.
- [ ] Capacity card that probes once and clamps
      Settle-once mount probe, `capacity` event on run writes, 0–100 clamp,
      *Window reset* header, comments removed; a rendering test for the
      mount rule.

### Thread
- [x] 2026-10-21 [log] [agent] Run order: Depends on correct git/check primitives from IDEA-313 (main-sha keying, serialized writes) and benefits from the slimmed manager/routes IDEA-309 produces, so it follows both.
- [ ] 2026-10-22 [question] [agent] Run-all parked on phase 1 ("Key the snapshot on main's sha") — the agent needs a decision: Failed to authenticate: OAuth session expired and could not be refreshed
- [ ] 2026-10-22 [question] [agent] Run-all parked on phase 1 ("Key the snapshot on main's sha") — the agent needs a decision: Failed to authenticate: OAuth session expired and could not be refreshed
- [ ] 2026-10-22 [question] [agent] Run-all parked on phase 1 ("Key the snapshot on main's sha") — the agent needs a decision: Failed to authenticate: OAuth session expired and could not be refreshed
- [ ] 2026-10-23 [question] [agent] Run-all parked on phase 1 ("Key the snapshot on main's sha") — the agent needs a decision: Failed to authenticate: OAuth session expired and could not be refreshed
