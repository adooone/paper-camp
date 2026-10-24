---
id: IDEA-318
title: Capacity keeps its last reading
type: fix
status: planned
idea: IDEA-310
created: 2026-10-24
tags:
  - app
  - stack
  - ui
subject: Run & monitor
---

The capacity card reads *no report* on both rows whenever the request for
the reading fails, even when a reading was on screen a moment ago.
`fetchCapacity` (`src/app/services/system/capacity-api.ts`) answers any
non-OK response with `null`, so the query's data, persisted across reloads
since IDEA-299, is replaced by nothing. An old daemon without
`/api/capacity` (a 0.43 daemon under a 0.44 client), a daemon asleep behind
the tunnel, or a probe that cannot reach the CLI all end in two empty bars.
A card that says *no report* tells the reader nothing about whether it ever
had one or why it stopped.

**A failed fetch keeps the last reading.** `fetchCapacity` throws on a
non-OK response with the server's message (or `<status> <statusText>`), so
TanStack keeps the previous data and the error beside it. `useCapacity`
returns `error` (the fetch's or the last probe's, whichever is newer) and
clears it on the next success. A probe failure no longer only toasts; it is
also held as that error.

**An old reading reads as outdated.** A reading is *outdated* when the
latest fetch or probe failed, or when its `capturedAt` is more than 24 h
old. Both stamps keep their percentage but switch to the neutral chalk
variant, and the tooltip reads *Last reading <relative time>* followed by
*— refresh failed: <message>* when there is an error. The bars keep their
fill. The header keeps *Resets in …* from the reading; when the five-hour
window has passed, the existing *reset* state applies as today.

**No reading says why.** When there has never been a reading, the stamps
read *no reading*, and the tooltip carries the error when there is one
(*refresh failed: Not Found* for an old daemon, the CLI's sign-in message
for a probe) or *click refresh for a reading* when there is none. The mount
probe still runs once, as IDEA-314 set.

`formatRelative` in `capacity-row.tsx` renders *just now*, *N min ago*,
*N h ago*, *N d ago*.

Done when a reading stays on the card with neutral stamps and a *Last
reading 3 h ago — refresh failed: Not Found* tooltip after the daemon
answers 404, a reading older than a day shows neutral stamps with its age,
a card that never had a reading says *no reading* with the cause, and a
successful refresh returns the stamps to their level colour.

### Out of scope

Serving `/api/capacity` from a 0.43 daemon: that is the 0.44.0 release and
`paper-camp update`.

### Phases
- [x] Keep the reading on failure
      `fetchCapacity` throws on non-OK; `useCapacity` exposes the newest
      fetch or probe error and clears it on success; tests for the kept
      data and the error.
      run: 3m2s · 60 in · 12.3k out · sonnet-5 · sess:aca75948-9057-4286-9589-6b87c56ce9b4
- [ ] Outdated and no-reading states
      Neutral stamps with the *Last reading …* tooltip when the fetch
      failed or the reading is over 24 h old; *no reading* with the cause
      when there never was one; `formatRelative`; component tests for the
      three states.
