---
id: IDEA-306
title: Changed ticks that always arrive
type: fix
status: planned
created: 2026-10-19
tags:
  - server
  - app
  - refresh
  - sse
subject: Infrastructure
---

The dashboard learns about a change through one SSE stream,
`/api/activity/stream`, and its `changed` message. Four things make that
message unreliable.

Under `pnpm dev`, editing any file in `src/app/server`, `src/core` or
`src/types` hot-swaps the API middleware (`vite.app.config.ts`). The swap
carries the agent, status, service, check and pairing state across, but
`createActivityManager` keeps its client set in a closure, so the new instance
starts with no clients. The open EventSource connections stay attached to the
old manager and never reconnect, and from then on every `notifyChanged()`
broadcasts to nobody until the page is reloaded. Agent, service and check lines
still arrive because their client sets live in shared state, which is why the
failure looks intermittent.

The stream has no heartbeat. Through cloudflared, `tailscale serve` or any
proxy an idle connection drops half-open, the browser fires no error, and the
tab goes deaf. The hello message on connect carries no `changed`, so a
reconnect does not resync either.

`notifyChanged()` broadcasts only after `runRunOrderPass` resolves, which is a
full corpus read plus a `git log` plus cross-project needs reads. If the pass
throws, `changed` is never sent and `rerunQueued` reschedules the same failing
pass every 300 ms.

Several writers never signal. No route in `routes/git.ts` calls the activity
manager, so a checkout or sync that rewrites `papercamp/ideas/` produces no
tick; `/api/refresh` re-fetches PRs and broadcasts nothing; the throttled
background `fetch origin main` in `git.ts` finishes silently. On the client,
`changed` is handled in nine hooks with nine different lists: the stack panel
refreshes plans, suggestions and the night report plus seven store loaders, but
nothing refreshes ideas, parked questions, capabilities or CI.

**One client set, in shared state.** `ActivityManagerState { clients }` is
created by `createApiMiddleware` when none is passed and handed to a hot-swapped
replacement the same way the other states are (`g.__paperCampActivityState`
in `vite.app.config.ts`, a `getActivityState` on the middleware). The service
and check managers lose their own client sets and `subscribe` functions and
receive a `publish` callback from `api.ts` instead; the agent manager's
`clients` leaves `AgentManagerState` and its `broadcast` goes through the same
callback. `/api/activity/stream` subscribes a response to the activity manager
only. Every stream message, whatever its `type`, is written by one function.

**Heartbeat and resync.** The activity manager writes `: ping\n\n` to every
client every 25 seconds, with the timer cleared on close. The hello message on
connect becomes `{ message: 'changed', type: 'activity' }`, so a connection
that was dropped and redialled refetches what it missed.

**Broadcast first, reflow second.** `notifyChanged()` invalidates the corpus
cache for its own root (`invalidateCorpusCache(root)`; the cache keys already
carry the root) and broadcasts `changed` after a 100 ms debounce. The run-order
pass still runs on its own 300 ms debounce and broadcasts a second `changed`
only when it wrote `run-order.md`. A pass that throws logs the error once and
does not reschedule itself; only a `notifyChanged()` that arrives mid-pass
queues a rerun.

**Every writer signals.** Each mutating route in `routes/git.ts` (stage,
unstage, commit, push, pull, sync, fix-divergence, checkout, branch create and
delete, stash apply and drop, complete-idea, revert) calls
`activity.notifyChanged()` after success. `/api/refresh` calls it at the end.
`createGitManager` takes an `onRemoteChanged` callback that the background
fetch invokes when `origin/main` moved, and `api.ts` wires it to
`notifyChanged`.

**One subscriber on the client.** `query-client.ts` gains
`subscribeProjectToActivityStream()`, called once from `main.tsx` next to the
chat subscriber. On `changed` it invalidates every query under
`['project', runtimeUrl]` (plans, ideas, package-name, suggestions, night
report, capabilities, agent auth status, parked questions, notifications, chat,
services, CI) and calls one `refreshProjectState()` on the store, which runs
the loaders that are not queries yet (status, consistency, doctor, git status,
agent status, archivable ideas, task log). The `changed` branches in
`use-stack-panel`, `use-notification-push`, `use-focus-client`,
`use-scout-client`, `use-pr-review-status`, `use-git-page` and
`subscribeChatToActivityStream` are removed; those hooks keep only their
`agent`, `check` and `service` handling. The stack panel's window-focus handler
stays.

Done when a server-file edit under `pnpm dev` is followed by a corpus write
that updates an open idea view without a reload, `curl -N` on the stream shows
a ping within 25 seconds of idling, a checkout from the Git page updates the
Ideas list in another tab, and the stack panel's effect contains no `changed`
branch.

### Phases
- [x] One client set shared across the hot-swap
      `ActivityManagerState`, the Vite global and `getActivityState`; services,
      checks and the agent manager publish through the activity manager; the
      stream route subscribes once. Tests for the swap and the fan-out.
      run: 7m49s · 172 in · 30.3k out · sonnet-5 · sess:a447bf15-941a-43e0-91ad-f037555d7a65
- [x] Heartbeat and hello-as-changed
      25 s `: ping`, cleared on close; hello carries `changed`;
      `activity-stream.test.ts` covers the resync.
      run: 1m40s · 40 in · 8k out · sonnet-5 · sess:32415fb6-0a8c-4988-91b5-2a37918713e4
- [ ] Broadcast before the run-order pass
      Immediate debounced `changed`, per-root cache invalidation, a second
      tick only when `run-order.md` changed, no self-rescheduling on failure.
- [ ] Every writer signals
      Git routes, `/api/refresh` and the background fetch call
      `notifyChanged`; route tests assert the broadcast.
- [ ] One subscriber on the client
      `subscribeProjectToActivityStream` and `refreshProjectState`; the
      per-hook `changed` branches removed; hook tests updated.
