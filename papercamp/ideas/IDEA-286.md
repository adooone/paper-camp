---
id: IDEA-286
title: Manual steps are not phases
type: feat
status: in-progress
created: 2026-09-27
updated: 2026-09-28
tags:
  - core
  - app
  - server
subject: Planning surface
order: 2
---

A phase is a unit an agent runs. Twice this month an idea carried a
phase no agent could do — a browser comparison against a baseline, a
build installed on a phone — and each time run-all reached it, failed,
and left the idea looking broken. The mobile repository's IDEA-2 has
five such phases, every one of them tagged `[manual]` by hand, and the
tag means nothing: the parser ignores it and run-all tries them anyway.
Work that belongs to a person needs a place that is not the run queue.

**`[manual]` is one thing: a person's phase.** The marker already exists
— `PHASE_SOURCE_RE` parses a leading `[manual]` into `source: 'manual'`,
written after the fact by `appendManualPhase` when a person lands work
with their own commit, always done. That is the same idea, seen from the
other end: a phase whose work is a person's. So there is no new field.
An open `[manual]` phase is a person's task not yet done; a done one is a
person's task recorded. Run-all skips any phase with `source: 'manual'`
and moves to the next agent phase; a run that reaches the end with only
manual phases open reports done rather than failing. The phase row keeps
the existing *manual* stamp for both states and shows no run control;
its checkbox is the person's to tick, in the row or through the existing
status route, which accepts a done flip on a manual phase without an
agent task behind it.

**Status reads it right.** An idea whose agent phases are all done and
whose manual phases are not is `review` — the agent work is finished,
the person's is not — and doctor warns when an open idea has no agent
phase at all, since that is a note wearing an idea's clothes.

**The drafters stop writing them.** The plan-draft and idea-extend
prompts say that anything needing a browser, a device, a human account
or a judgment call goes under a `[manual]` marker or into the body as
acceptance, never as a bare phase; the guide's phase rules say the same.

### Out of scope

Reminders or notifications for open manual steps. Any change to what a
phase run does once it starts.

### Phases
- [x] Parse and serialize the `[manual]` marker
      A leading `[manual]` on a phase or fix line sets `manual: true` on the item and survives a write-back round trip.
      run: 1m31s · 50 in · 6.5k out · sonnet-5 · sess:621277ba-0578-414a-a890-913a2e3402df
- [x] Skip manual items in run-all
      The loop steps past them to the next agent item and finishes done when only manual items remain open.
      run: 2m28s · 54 in · 10.5k out · sonnet-5 · sess:621277ba-0578-414a-a890-913a2e3402df
- [x] Derive review status and add the doctor warning
      All agent phases done with manual ones open reads `review`; an open idea with no agent phase is a finding.
      run: 3m14s · 68 in · 14.2k out · sonnet-5 · sess:621277ba-0578-414a-a890-913a2e3402df
- [x] Hide the run control on manual phase rows
      No run control, and the checkbox flips through the status route without an agent task behind it.
      run: 41s · 22 in · 1.9k out · sonnet-5 · sess:fa098354-8edd-41cf-8eed-476ca86d7821
- [ ] Teach the drafters and the guide the rule

### Thread
- [x] 2026-09-28 [question] [agent] Run-all parked on phase 1 ("Parse and serialize the `[manual]` marker") — the agent needs a decision: The `[manual]` marker text is already in use. `PHASE_SOURCE_RE` in `src/core/sections.ts` already parses a leading `[manual]` into `source: 'manual'` — an existing, different concept (`appendManualPhase` in `src/app/features/plans/helpers/manual-commit.ts` tags phases that were completed via a manual git commit outside the agent flow, always `done: true`, rendered with a "manual" stamp in `phase-row-cells.tsx`). IDEA-286 phase 1 asks for a leading `[manual]` to set a new `manual: true` field meaning "this phase is human-only work, not runnable by an agent" — a distinct concept (any done state, skips run-all, renders a "you" stamp instead of the existing "manual" stamp). Both would parse the identical bracket text via the same regex, so I can't add this without either colliding with or overloading the existing `source: 'manual'` marker. How should these coexist — rename/repurpose the existing commit-provenance marker to free up `[manual]`, reuse `source: 'manual'` for both purposes, or use different bracket text for the new human-task marker?
- [x] 2026-09-28 [chat] Decision: reuse source: 'manual' for both — they are the same concept from two ends. A [manual] phase is a person's phase: open means the person has not done it yet, done means it was recorded after their own commit as appendManualPhase already does. No new field, no second marker, no 'you' stamp: keep the existing 'manual' stamp for both states. Run-all skips any phase with source 'manual'; a run that ends with only manual phases open reports done. The idea body and phase 4 are updated to say this. Continue phase 1 on that basis: the only parser change is that an open [manual] phase is valid, not only a done one.
- [x] 2026-09-28 [chat] [agent] Good, continuing phase 1 on that basis: open [manual] phases parse as valid, source: 'manual' either way, same stamp for both states.
- [x] 2026-09-28 [log] [agent] Manual phases reuse source: 'manual' for both open/done states, no new field; run-all skips manual phases and treats manual-only remainders as done.
