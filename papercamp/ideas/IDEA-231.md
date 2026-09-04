---
id: IDEA-231
title: Probe the origin that serves the app
type: fix
status: review
created: 2026-09-04
updated: 2026-09-04
tags:
  - app
subject: Multi-project
order: 1
---

`paper-camp dev` renders its shell with real data — branch, counts, the Stack
panel — and then puts "This needs the runtime or a GitHub token" in the main
pane, offering a fine-grained-token form as the way out. The runtime is right
there, answering on the same origin.

`runtime-slice.ts` recognises two ways to have a runtime and no third:

```ts
if (hasEmbeddedRuntime) return true;              // data-paper-camp-mount
if (hasDetachedRuntime) return probeReachable();  // ?runtime=
return false;                                     // dev lands here, unprobed
```

The mount attribute is injected only by `daemon-server.ts` (as `/p/<slug>`) and
by the `paper-camp/vite` embed plugin. Nothing injects it for `paper-camp dev`,
which also carries no `?runtime=`, because it *is* the runtime — bundle and API
served from one origin. So both flags are false and the check returns
unreachable without ever asking. Verified against the running dev server:
`#root` carries no mount attribute, `location.search` is empty, and
`/api/package-name` — the exact endpoint `probeReachable` would call — answers
200 OK.

The missing branch already exists elsewhere. `servesOwnRuntime` in `hub.ts` is
what `main.tsx` uses to decide the same question for routing, and it is the
right probe here for a reason `probeReachable` cannot satisfy: it parses the
response as JSON rather than trusting `response.ok`. A static host answers an
unknown path with its SPA fallback — 200, but HTML — so an ok-only check would
tell the hosted client it has a runtime it does not have. The reachability
check falls through to that probe when neither flag is set.

`runtimeChecking` starts true whenever a probe will run, not only for a dialled
runtime. It gated on `hasDetachedRuntime`, so the self-served case began at
`checking: false, reachable: false` and painted the plan-only path for a frame
before the probe could answer.

This is not new. `runtime-slice.ts` last changed in `db340ce7`, the hub rebuild
([[IDEA-221]]), released in 0.24.0 — every `paper-camp dev` user has had this
since, wherever a view is gated on runtime reachability.

### Out of scope

`probeReachable` and its retry behaviour, which stay as they are for the
detached case. The GitHub plan-only path, which remains the correct answer when
there genuinely is no runtime. The dev server's IPv4-only bind, a separate
defect found in the same session and fixed alongside it — that one is
`vite.app.config.ts` listening on `0.0.0.0` while a MagicDNS name resolves to
IPv6, and it has nothing to do with this check.

### Phases
- [x] Probe the origin when nothing else claims a runtime
      Fall through to `servesOwnRuntime` rather than returning false, so a bundle served by its own API is recognised; its JSON parse is what keeps a static host's SPA fallback from reading as a runtime.
- [x] Hold the shell in checking while the probe runs
      Start `runtimeChecking` from `!hasEmbeddedRuntime` so the self-served case stops painting the plan-only path before the answer arrives.
- [x] Cover the self-served origin in tests
      Three cases against a mocked mount/runtime-connection pair: a real API reads reachable, an SPA fallback stays unreachable, and the slice starts out checking.

### Thread
- [x] 2026-09-04 [log] [agent] Found while diagnosing a report of the token form appearing in the local dev app. Two independent causes: `vite.app.config.ts` bound `host: '0.0.0.0'` while `deimos` resolves to IPv6 only, so the browser got ERR_CONNECTION_REFUSED (measured: IPv6 connect 000, IPv4 loopback 200) — fixed separately with `host: '::'`. With the origin reachable again the token form persisted, which is what isolated this check as the second, older cause.
- [x] 2026-09-04 [log] [agent] Phases carry no `run:` stamps because the work was done directly in the session that diagnosed it, not by agent runs. Reverting the fix fails two of the three new tests; the third passes either way by design, guarding against a naive `response.ok`-only fix that would break the hosted client. Gate at completion: check-types, lint with no warnings, 1508 tests, consistency across 645 modules.
