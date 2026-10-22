---
id: IDEA-309
title: Smaller orchestrator and routes
type: refactor
status: planned
created: 2026-10-19
tags:
  - server
  - agents
  - api
needs:
  - IDEA-307
  - IDEA-308
subject: Code health
---

`createApiMiddleware` takes nine positional parameters and both callers pass
four `undefined`s to reach the sixth. `createAgentManager` takes eight
positional callbacks that `createAgentHooks` already returns as one object,
which `api.ts` then spreads back out. The `AgentManager` interface exposes
fourteen `start*` and six `run*` functions, each a thin wrapper around
`launch()` or `runReadOnlyPrompt()` with a task kind filled in;
`startBatchReconcile` and `startBatchDraft` are the same 150-line loop twice.
An orchestrated task spawns `sh -c 'exit 0'` only so `task.proc` has a
`ChildProcess` to hold. `runReadOnlyPrompt` builds claude and opencode flags
itself instead of asking the adapter. `PHASE_TIMEOUT_MS` is a 30-minute
wall-clock cap, but the log line says "no progress for 30min" and
`lastStreamAt` is tracked and never used for it. `killCurrent` and
`killWithEscalation` are two escalation implementations with different grace
periods. `readDefaultAgentIds` reads `config.json` synchronously on every
launch and duplicates the coercion the `/api/config` route performs. About
forty routes call `JSON.parse(await readBody(req))` with no guard, so a
malformed body is a 500; the legacy `ReadRoute` table matches on pathname for
any method, so `POST /api/plans` returns the plan list; `startSuggest` runs
`admit()` twice.

**Options objects.** `createApiMiddleware(root, options)` takes
`{ agentState, statusState, serviceState, checkState, pairingState,
activityState, onPaired, isMachineBusy, pairCode }`. `createAgentManager(root,
hooks, options)` takes the object `createAgentHooks` returns and
`{ onCorpusChanged, isMachineBusy, state }`.

**Three primitives.** The manager exposes `launch(kind, identity, prompt,
scope)`, `start` and `startRunAllPhases` for orchestrated phases, `runBatch(kind,
ids)` parameterised by candidate filter, prompt builder and progress check for
reconcile-all and draft-all, and `runReadOnlyPrompt(kind, prompt, title)`. The
fourteen `start*` and six `run*` wrappers go; `routes/agent.ts`,
`routes/chat.ts`, `routes/content/ideas.ts` and `desk-discovery.ts` call the
primitives. `task.proc` becomes optional and the stub shell is gone. Each
adapter gains `buildReadOnlyArgs(opts)` and `runReadOnlyPrompt` uses it.
`startSuggest` admits once.

**An idle timeout.** `runProcessWithTimeout` takes an idle limit: a phase is
killed when `lastStreamAt` is older than 30 minutes, with a two-hour wall-clock
cap. `killCurrent` uses `killWithEscalation`.

**One config reader.** `readProjectConfig(root)` in `src/core` parses and
coerces `config.json` once (default agents, desk, subjects from the roadmap);
`readDefaultAgentIds` and the `/api/config` route's coercion are replaced by
it.

**Route hygiene.** `readJson(req)` in `http.ts` answers 400 on a malformed
body and every route uses it. The `ReadRoute` table becomes `GET` routes in
the same `Route` shape, matched by method, and `api.ts` has one lookup.

Done when `api.ts` passes no `undefined` positionals, `AgentManager` has under
fifteen members, `grep -n "spawn('sh'" src/app/server` is empty, a phase that
streams a line every minute survives past 30 minutes, and `POST /api/plans`
answers 404.

### Phases
- [x] Options objects for the middleware and the manager
      `createApiMiddleware(root, options)` and `createAgentManager(root,
      hooks, options)`; `api.ts`, `dev-server.ts`, `daemon-server.ts` and
      `vite.app.config.ts` updated; tests.
      run: 8m10s · 164 in · 25.6k out · sonnet-5 · sess:bc8c8ede-2542-41f8-8575-cf49590b86e6
- [x] Three primitives replace the wrappers
      `launch`, `runBatch` and `runReadOnlyPrompt` exposed; wrappers removed;
      callers moved; optional `proc`; `buildReadOnlyArgs` on each adapter;
      tests.
      run: 26m37s · 336 in · 83.1k out · sonnet-5 · sess:87b92f74-a046-4b9a-b82d-c6c221c2d7d3
- [x] Idle timeout and one escalation
      `runProcessWithTimeout` on `lastStreamAt` with the wall-clock cap;
      `killCurrent` through `killWithEscalation`; tests.
      run: 12m14s · 136 in · 31k out · sonnet-5 · sess:549a891e-b445-41ff-be31-d2474f39238c
- [ ] One config reader and route hygiene
      `readProjectConfig` in core; `readJson` with 400; read routes as
      method-matched `GET` routes; tests.

### Thread
- [x] 2026-10-21 [log] [agent] Run order: A large standalone refactor of orchestrator/routes that doesn't depend on the others but should land before further corpus/capacity work touches the same api.ts/agent manager surface it is simplifying.
