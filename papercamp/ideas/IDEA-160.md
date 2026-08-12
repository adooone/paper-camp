---
id: IDEA-160
title: One activity stream for the whole app
type: fix
status: idea
created: 2026-08-12
tags:
  - app
  - ux
  - performance
subject: Infrastructure
---

On the Git page with the Stack panel open, every action silently does
nothing: "Suggest commit message" starts no agent and fills nothing in,
Sync spins forever, and no error is ever shown — while the very same
endpoints answer in full over `curl` from the same box.

The cause is transport, not any of those features. Every hook that wants
change notifications constructs its own `EventSource` to
`/api/activity/stream`. There are nine such call sites, and six of them
mount together on the Git page: the router's notification push, the
Stack panel itself, its services / checks / CI groups, and the page's
own. Browsers cap HTTP/1.1 at six connections per origin and an
`EventSource` holds its connection open for life — so all six sockets
are streams, and every later `fetch()` queues inside the browser and
never reaches the server. That is why nothing appears in Stack (the
request never arrives), why no error shows (it is queued, not failed),
and why the server looks perfectly healthy when probed directly.

1. **One stream for the whole app.** A single module-level `EventSource`
   to `/api/activity/stream` with a `subscribe(listener)` API. Every
   hook that constructs its own today subscribes to that instead — one
   socket, not six.

2. **Ref-counted, not lifecycle-bound.** It opens on the first
   subscriber and closes when the last one unsubscribes, so navigating
   away still tears it down and an idle tab holds nothing open.

3. **Each consumer keeps its own filter.** The hooks that care only
   about a specific message (`changed`, notification pushes, service
   logs) keep filtering client-side. The stream is shared; the
   interpretation is not.

4. **Reconnect once, for everyone.** Reconnect and backoff live in the
   shared stream, so a dev-server restart re-establishes one connection
   instead of six racing ones.

5. **Transport only.** No endpoint, payload or SSE semantics change, and
   no hook changes what it does with a message — only where it gets it.

The timeouts in [[IDEA-159]] are the companion fix, not a substitute:
they would turn this silence into a visible "timed out" error, but the
socket exhaustion is what has to be removed for the actions to work.

### Thread
- [x] 2026-08-12 [decision] A single ref-counted module-level stream rather than a React context provider — the consumers mount at unrelated points in the tree (router, Stack panel groups, page bodies), so a provider would force an artificial common ancestor.
- [x] 2026-08-12 [log] Measured while the page was wedged: seven established TCP connections from the browser to the dev server on consecutive source ports (63170-63177) — six HTTP sockets plus Vite's HMR WebSocket, which is exempt from the per-origin cap. `POST /api/git/suggest-commit-message` with the Git page's exact seven-file payload returned HTTP 200 in 7.8s over `curl` at the same moment, agent spawned and visible in `/api/agent/status`.
- [x] 2026-08-12 [log] Reproduced after [[IDEA-159]] landed, which confirms the two are independent: sync still hung with nothing in flight server-side (`/api/git/status` answered in 135ms, no git or agent process running). Two separate client machines were connected, each pinned at exactly six established connections — the per-origin cap, fully consumed by streams on both. A saturated pool also blocks Vite from fetching updated modules, so a wedged tab keeps running the pre-fix bundle and cannot even pick up the timeouts.
