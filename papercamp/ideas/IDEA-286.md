---
id: IDEA-286
title: Manual steps are not phases
type: feat
status: idea
created: 2026-09-27
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

**`[manual]` becomes real.** A phase or fix whose text starts with
`[manual]` parses with `manual: true`. Run-all skips it and moves to the
next agent phase; a run that reaches the end with only manual phases
open reports done rather than failing. The phase row shows a *you*
stamp and no run control; its checkbox is the person's to tick, in the
row or through the existing status route, which accepts a done flip on a
manual phase without an agent task behind it.

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
