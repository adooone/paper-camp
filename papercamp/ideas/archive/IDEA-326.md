---
id: IDEA-326
title: Signed-out Claude pauses every run
status: done
created: 2026-11-03
updated: 2026-11-14
---

On 2026-11-03 a batch in paper-camp-mobile ran seven ideas in a row while
Claude's OAuth session had expired. Every run failed with "Failed to
authenticate: OAuth session expired and could not be refreshed", each wrote
its own "run all failed" notification, and the batch reported "queue
complete — 7 idea(s) run". The batch already paused on an `auth` outcome, but
a run was only classified as `auth` when `claude auth status` said
`loggedIn: false`, and that command only checks that credentials exist: it
reported `loggedIn: true` for the expired session.

**Detection.** A failed claude-code run is `auth` when its failure reason
matches the CLI's auth errors ("Failed to authenticate", an expired OAuth
session or token, "Invalid API key", "Please run /login",
`authentication_error`, a 401 Unauthorized) or when `claude auth status`
reports signed out (`src/app/server/agent-signin.ts`).

**One machine-wide state.** The first `auth` failure records "Claude needs
you to sign in again" for the whole daemon process, so every mounted project
sees it. While it holds: phase, run-all, batch and read-only launches are
refused with that error and `kind: 'auth'`; a running batch pauses before its
next idea with the rest still queued; one `agent-signed-out` notification
(push on by default) replaces the per-run failure notices and the
`batch-paused` notice; `/api/agent/auth-status` reports `loggedIn: false`
with the CLI's reason, so the status bar shows "Agent not signed in".

**Confirming sign-in.** `POST /api/agent/auth-check` sends one short prompt
through the CLI and settles on the first reply (signed in), an auth failure
(still signed out) or anything else (unknown, state kept). The login relay's
confirmation also marks sign-in. Marking sign-in wakes every project, which
relaunches its auth-parked runs and resumes a batch paused on `auth` with the
interrupted idea requeued.

**In the app.** The Stack panel's Agent section shows a "Claude needs you to
sign in again" card with *Sign in* (Settings → Connections) and *I've signed
in* (the check above).

Done when a batch run with an expired session pauses after its first idea,
writes one notification, refuses new launches until the sign-in check
passes, and then resumes with the interrupted idea first.

### Phases
- [x] Detect auth failures and keep one machine-wide state
      Failure-text patterns plus the probe, the shared state module,
      refusal at launch, the batch pause before the next idea, one
      notification.
- [x] Sign-in check and resume
      `POST /api/agent/auth-check` on a real request, the login relay marking
      sign-in, per-project resume of parked runs and the auth-paused batch.
- [x] Signed-out card in the Stack panel
      The card with *Sign in* and *I've signed in*, and the status refresh on
      the daemon's `agent-auth` event.

### Thread
- [ ] 2026-11-03 [decision] [agent] Settled with the user on 2026-11-03: detect sign-out from the CLI's failure text plus the `auth status` probe; one machine-wide signed-out state that refuses launches and pauses the batch; confirm sign-in with a real one-prompt request from an "I've signed in" button and from the login relay; built directly in this checkout rather than run from the app.
- [x] 2026-11-03 [log] [agent] The first version missed the real failure path. A run's failure on the CLI's final result line also set `task.blocker`, so `escalateToLog` parked the sign-in error as a question (`errorKind: 'question'`), which skipped the auth classification; the batch read that as `needs-you` and moved on. That is how paper-camp-mobile got seven "questions" on 2026-11-03. A reason on the final result line no longer becomes a blocker: only a reason streamed mid-run (a permission denial) parks. The fake agent in `agent.test.ts` now reports a failed result the way the CLI does (`RESULT-ERROR:`); with the old line restored, four of the sign-in tests fail.
- [x] 2026-11-14 [log] [agent] Restored on 2026-11-14 from a stranded `papercamp-reconcile` stash dated 2026-11-06 (see IDEA-331). Its code (`agent-signin.ts`, the signed-out card, the login relay) reached main on 2026-11-04 in `165744cf` and shipped in 0.46.0; the idea stays in review for approval.
