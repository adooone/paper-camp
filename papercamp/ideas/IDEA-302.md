---
id: IDEA-302
title: Chat shows Scout at work
type: feat
status: planned
created: 2026-10-16
tags:
  - app
  - server
  - agent
subject: App UI
order: 9
---

Sending a message today gives twelve seconds of nothing. The draft clears,
the text appears as a bare bubble, and under it sits a 50 px card holding a
spinner whose "Agent thinking…" label is `aria-label` only, so nothing on
screen says who is working or on what. The `POST /api/chat` request blocks
until the agent CLI returns, up to the 60 s timeout. When the run fails the
user's message is already in `chat.md` with no reply after it; the client
shows one toast and nothing in the thread, there is no way to retry, and the
draft is gone. The current project's thread never updates on its own: a
question a run parks while the page is open appears only after a reload, and
the tab count follows the scope list, which recomputes only when the scope
changes. On a cold open the page is an empty column for several seconds, and
after a reply lands the composer card measures wider than the column with its
placeholder clipped. Builds on [[IDEA-301]]'s `ChatMessage` and avatar.

**Stages come from the server.** `ActivityManager` gains `publish(payload)`,
which writes any `{type, …}` object to every stream client. The chat route
publishes `type: 'chat'` events for the run it is handling: `{stage:
'reading', ideas: N}` before the prompt is built, `{stage: 'deciding'}` when
the agent process starts, `{stage: 'filing'}`, `{stage: 'posting', entityId}`
or `{stage: 'answering'}` once the move is known, and `{stage: 'done'}` or
`{stage: 'failed', error}` at the end. Every read-modify-write of `chat.md`
runs under a `withChatLock` in `helpers.ts`, the same shape as
`withRunOrderLock`, so a parked question landing mid-reply is never lost.

**The thinking bubble.** While a send is in flight, under the user's bubble a
Scout bubble (avatar and name from IDEA-301) shows three pulsing dots and the
stage line: *Reading 38 ideas…*, *Deciding…*, *Filing an idea…*,
*Posting to IDEA-42…*, *Answering…*. From 5 s the line carries the elapsed
seconds (*Deciding… 12 s*); from 30 s a second muted line reads *The agent
CLI can take a minute to start.* The bubble is replaced by the reply when the
thread refetches. The spinner card goes. A `useChatStage` hook in
`features/chat/hooks/` reduces the stream's `chat` events into the current
stage and start time.

**The user's bubble is final from the first frame.** The pending message
renders through `ChatMessage` with the local minute, so the refetch that swaps
it for the stored copy changes nothing on screen. A send to another project
keeps the optimistic bubble until that project's refetch resolves.

**Failure stays in the thread.** On a reply failure the route still answers
`{ok: true, error}`. The client shows no toast; under the user's bubble a line
reads *Didn't reach Scout — <one-line error>* with a *Retry* button. Retry
calls `POST /api/chat/retry`, which runs the reply for the thread's last
message without appending it again and publishes the same stages. The line
also shows, without the error text, whenever the stored thread ends with a
user message, so a failure survives a reload. A thrown fetch (server
unreachable) keeps today's behaviour: the *Message failed to send* toast and
the draft restored.

**The thread is live.** `query-client.ts` subscribes once to the current
runtime's activity stream and calls `refreshChat()` on every `changed`
message; `useScope` refetches its counts on the same message, so the tab count
follows. Both subscriptions resubscribe when the runtime switches, as the
others do since IDEA-300.

**The page never opens blank.** `ChatPageSkeleton` in `features/chat/views/`
renders the title row, a three-row skeleton in the thread area and the
composer; the route's Suspense fallback and the page's loading state both
render it. The composer card is `w-full` inside the column and never measures
wider than the thread.

Done when a send shows the user's message in its final shape at once, a Scout
bubble names each stage and the elapsed time, the reply replaces the bubble,
an agent failure leaves a Retry line that re-runs the reply, a question parked
by a run appears while the page is open, and opening Chat shows the frame
with a skeleton instead of an empty column.

### Out of scope

Streaming the reply text token by token. Cancelling a run. The feedback
composer on idea pages, which keeps its own states.

### Phases
- [x] Stage events from the chat route
      `publish` on `ActivityManager`; the chat route emits the six stages;
      `withChatLock` around every `chat.md` read-modify-write; tests for the
      event order and the lock.
      run: 4m54s · 104 in · 31.1k out · sonnet-5 · sess:66ec4457-e60f-46e5-90de-145238e11d81
- [x] A retry endpoint
      `POST /api/chat/retry` running the reply for the last stored message
      without a second append; the route's append and reply split into two
      functions; tests.
      run: 2m17s · 38 in · 10.1k out · sonnet-5 · sess:66ec4457-e60f-46e5-90de-145238e11d81
- [x] The thinking bubble and the final-shape pending message
      `useChatStage` reducing stream events; the Scout bubble with dots, stage
      line, elapsed seconds and the 30 s hint; the pending message through
      `ChatMessage`; the spinner card removed; a foreign send keeping its bubble
      until the refetch; tests for the reducer and the timings.
      run: 6m59s · 114 in · 51.7k out · sonnet-5 · sess:66ec4457-e60f-46e5-90de-145238e11d81
- [x] The failure line with Retry
      No toast on an agent error; the line under the user's bubble with the
      error and *Retry*; the reload case from a thread ending with a user
      message; tests.
      run: 4m25s · 94 in · 32.3k out · sonnet-5 · sess:2bdcc7d1-51d4-46d5-9279-f7aa3454e87f
- [x] Live thread and counts
      The stream subscription in `query-client.ts` calling `refreshChat`;
      `useScope` refetching counts on `changed`; both following a runtime
      switch; tests.
      run: 5m28s · 110 in · 29.3k out · sonnet-5 · sess:2bdcc7d1-51d4-46d5-9279-f7aa3454e87f
- [ ] The opening frame
      `ChatPageSkeleton` as Suspense fallback and loading state; the composer
      constrained to the column; tests.
