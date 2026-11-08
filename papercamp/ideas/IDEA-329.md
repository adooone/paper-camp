---
id: IDEA-329
title: The chat ack comes before the work
type: fix
status: review
created: 2026-11-08
updated: 2026-11-08
tags:
  - server
  - chat
subject: Infrastructure
---

`POST /api/agent/feedback-message` (`src/app/server/routes/agent.ts`)
awaits the whole of `applyFeedbackMessage` — filing the message on the
thread, running Scout, sometimes checks and a commit — before it answers
200. A send therefore acks in however long Scout takes, seconds to
minutes. The phone used to abort at six seconds and stamp every working
send "failed — tap to retry", inviting double-sends; paper-camp-mobile
now waits a minute and, on timeout, guesses the message arrived and
reconciles against the refetched thread. That guess papers over a server
shape problem: the client cannot tell "delivered, Scout is working" from
"never arrived".

**The route acks as soon as the message is safe.** Validate, resolve the
entity, append the user's message to the thread, `notifyChanged()`, and
answer 200 — then run the rest of the pipeline detached, the way the
launch routes already hand work to the agent manager. Anything the
response carries today that depends on the pipeline's outcome (`error`,
`undo`) moves to where late results already live: the thread, a
notification, or an activity event — that relocation is the one design
decision the plan needs to settle.

**Acceptance.** With a mounted project and Scout configured, a
feedback-message POST answers in under 300 ms warm; the posted message
is in the thread on the first refetch after the ack; Scout's reply still
lands as before; a pipeline failure is visible on the thread or as a
notification rather than only in an HTTP response nobody is waiting on.
The phone's timed-out-equals-sent heuristic becomes dead code.

### Phases
- [x] Ack feedback-message once the message is filed
      Split `applyFeedbackMessage` into a filing step the route awaits and a detached pipeline serialized per entity that re-reads the thread before each write; the 200 body becomes `{ ok: true }`, and outcomes publish as a `feedback` activity event (`done` with `undo`, `failed` with `error`, the type IDEA-330's stages extend) with failures also appended to the thread as an agent message — `chat.ts` keeps awaiting the full result.
      run: 2m16s · 28 in · 8.9k out · sonnet-5-5 · sess:66be5558-08c9-4412-a10e-a174db65c221
- [x] Move the web send hook onto the feedback event
      `useSendFeedbackMessage` and `postFeedbackMessage` stop reading `error`/`undo` from the response and take them from `feedback` events for `plan.id`, on both the desk and the toolbar mount.
      run: 46s · 42 in · 11.9k out · sonnet-5-5 · sess:66be5558-08c9-4412-a10e-a174db65c221
- [ ] [manual] Delete the phone's timed-out-equals-sent heuristic in paper-camp-mobile
