---
id: IDEA-330
title: Scout's status rides the activity stream
type: feat
status: review
created: 2026-11-08
updated: 2026-11-08
tags:
  - server
  - chat
subject: Infrastructure
---

Clients can only infer what Scout is doing. The web toolbar shows
"Scout replying…" because it posted a message and nothing came back
yet; the phone now does the same. The activity hub
(`src/app/server/activity.ts`) already carries typed events through
`publish()` — the tests exercise `service`, `check` and `agent` types —
but the feedback pipeline never publishes a stage, so the one honest
signal clients get is the debounced `changed` bell.

**The feedback pipeline narrates itself.** At the points
`applyFeedbackMessage` (`src/app/server/routes/agent.ts`) already
passes through, publish a scout-stage event with the entity id: the
message filed ("reading"), the Scout call started ("thinking"), the
reply being written ("replying"), and done. Clients subscribed to
`/api/activity/stream` render the stage under the newest bubble within
a second of it changing; clients that ignore the new event type lose
nothing.

**Then the reply itself streams.** A second step feeds Scout's partial
reply text through the same hub as it generates, so the web and the
phone can type the answer word by word before the thread write lands.
Chunk events are additive — the thread write stays the source of truth
and late or dropped chunks only degrade back to today's behavior.

**Acceptance.** Subscribing to `/api/activity/stream` while a feedback
message is processed shows the stage events in order for the right
entity; a client can show "Scout is thinking…" from the event alone, no
polling; with streaming on, partial reply text arrives before the
thread carries the full message, and a client that ignores chunks still
ends with the identical thread.

### Phases
- [x] Publish feedback stages from the pipeline
      `runFeedbackPipeline` emits `reading`/`thinking`/`replying` on the existing `type: 'feedback'` event (beside today's `done`/`failed`), with a test asserting order and entity id on the stream.
      run: 1m35s · 18 in · 3.5k out · sonnet-5-5 · sess:fdfbd2e1-c2d0-4b8a-9db0-53050afe657c
- [x] Show the live stage under the newest bubble
      Toolbar `scout-thread.tsx` and the feedback view read the stage from `subscribeToActivityStream` instead of the local `sending` flag.
      run: 49s · 32 in · 6k out · sonnet-5-5 · sess:fdfbd2e1-c2d0-4b8a-9db0-53050afe657c
- [x] Stream partial reply text from read-only runs
      `runReadOnlyPrompt` takes an `onText` callback (stream-json for claude-code, text parts for opencode); `replyToFeedback` extracts the growing `reply` string and publishes `feedback` chunk events.
      run: 1m5s · 46 in · 11k out · sonnet-5-5 · sess:fdfbd2e1-c2d0-4b8a-9db0-53050afe657c
- [x] Type the streamed reply into the thread
      Clients render chunk text as a provisional bubble that the thread write replaces, falling back cleanly when chunks never arrive.
      run: 53s · 60 in · 14.1k out · sonnet-5-5 · sess:fdfbd2e1-c2d0-4b8a-9db0-53050afe657c
