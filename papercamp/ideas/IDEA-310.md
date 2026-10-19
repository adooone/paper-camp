---
id: IDEA-310
title: Capacity card with a weekly bar
type: feat
status: review
created: 2026-10-19
tags:
  - app
  - stack-panel
  - capacity
  - server
subject: Run & monitor
---

The Stack panel's capacity card shows a reading that refresh cannot replace.
`capacity-row.tsx` merges three sources: a "live" snapshot taken from the
first task in `agentStatus` that carries a `rateLimit`, the probe stored in the
capacity slice, and the newest `tasks.log` entry. The live one always wins and
is treated as current by definition, but `agentStatus` keeps the last twenty
finished tasks and a dev hot-swap carries them across server edits, so a
run-all that ended yesterday at 99% still outranks every probe clicked today.
The live path also skips the reset check `latestCapacity` applies, which is
why the card reads "Resets in 0m · 99%". A probe that fails (the route answers
503) is swallowed by `refreshCapacity`, so the spinner stops and nothing says
why. The probe's result reaches only this card: `/api/stats`, the night gate in
`daemon-server.ts` and `POST /api/night/pause` all read `latestCapacity` over
`tasks.log`, which the probe never writes to. And the card shows only the
five-hour window although every snapshot the CLI emits carries `seven_day`
too (the Stats page already lists both).

**One capacity file.** `papercamp/capacity.json` holds
`{ snapshot, capturedAt, source }` with `source` either `run` or `probe`.
`src/core/capacity.ts` exposes `writeCapacity(root, snapshot, source)` and
`readCapacity(root)`. `agent.ts` writes it at the two places that set
`task.rateLimit` from a stream line; the probe route writes it on success.
`readCapacity` returns the file as stored; a window whose `resetsAt` has
passed is the consumer's business, not dropped. `latestCapacity` and
`mergeLiveCapacity` are removed from `rate-limit.ts`; `rateLimit` stays on
`tasks.log` entries as history. `computeProjectStats`, `buildNightGateResponse`
and the night pause route read `readCapacity` instead of the task log.

**One route and one query.** `GET /api/capacity` returns the file (or null).
`POST /api/capacity/refresh` probes, writes, publishes `{ type: 'capacity' }`
on the activity stream and returns the new reading; on a failed probe it keeps
answering 503 with its message. The client reads capacity through
`useCapacity()` on a `['project', runtimeUrl, 'capacity']` query;
`refreshCapacity()` in `query-client.ts` invalidates it, the stream's
`capacity` event invalidates it, and the capacity slice goes. The row overlays
the snapshot of a task whose status is `starting`, `running` or `stopping`
only, since that one is current while it streams.

**Refresh tells the truth.** A failed refresh shows a toast with the route's
error ("Claude reported no capacity — is the CLI signed in?") and leaves the
last reading in place. The card probes on mount only when there is no reading
or the five-hour window has reset; otherwise it waits for the button.

**A window that has reset says so.** When a window's `resetsAt` is in the past
its bar is empty and its stamp reads `reset`, with the tooltip "window reset at
<time> — refresh for a reading". The other window keeps its figures until its
own reset.

**Two bars.** The card shows two rows under the header: `5h` and `wk` labels
on the left, a sketch `Progress` bar, and the percentage stamp on the right.
The header keeps "Resets in <gap>" for the five-hour window; the `wk` stamp's
tooltip names the weekly reset ("Weekly window: 50%, resets Tue 14:00"). Both
bars take the snapshot's level colour. The capacity card gets its own height
class one line taller than `TASK_CARD_HEIGHT_CLASS`; the task cards and the
stack's reserved minimum height are unchanged.

Done when a refresh click after a finished run replaces the card's figures with
the probe's within a few seconds, a probe with the CLI signed out shows a toast
and keeps the old reading, the Stats page and the card show the same numbers,
and the card shows the weekly utilisation under the five-hour one.

### Phases
- [x] One capacity file
      `src/core/capacity.ts` with `writeCapacity`/`readCapacity`; writes from
      `agent.ts` and the probe; stats, night gate and night pause read it;
      `latestCapacity` and `mergeLiveCapacity` removed; tests.
      run: 6m42s · 172 in · 33.1k out · sonnet-5 · sess:6828e320-8459-44a1-b152-886312ce1955
- [x] One route and one query
      `GET /api/capacity`, the `capacity` stream event, `useCapacity()` and
      `refreshCapacity()`; the slice removed; live overlay from running tasks
      only; the failure toast and the mount rule; tests.
      run: 7m32s · 156 in · 51.9k out · sonnet-5 · sess:1af93c6a-df08-41f3-9475-20ebe8f77b20
- [x] Two bars with reset states
      `5h` and `wk` rows, the `reset` stamp, the taller card class;
      `agent-section.test.ts` and a `capacity-row.test.ts` cover both.
      run: 4m37s · 60 in · 19.6k out · sonnet-5 · sess:d3a582d8-c491-4e1f-811a-6fd03d6e734a
