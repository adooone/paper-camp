---
id: IDEA-86
title: Surface agent sign-in state in the app
status: idea
created: 2026-07-25
updated: 2026-07-26
subject: Packaging
---

When the headless `claude` CLI the agent uses isn't authenticated, every agent task (draft, extend, run-all, fix-review, ...) fails with a generic "error" — the real cause (`Not logged in · Please run /login`) is buried in the task output. The app should make agent auth state legible and recoverable instead of silently cryptic.

First cut — detect + surface + guide:
- **Probe:** a server route (e.g. `GET /api/agent/auth-status`) runs `claude auth status` (clean JSON: `{loggedIn, authMethod, apiProvider}`) for the configured agent and returns it; degrade gracefully when the CLI is absent. Fits the existing `probeCapabilities` pattern and the [[IDEA-76]] first-run-access area.
- **Surface:** a Status-panel indicator / banner showing "Agent not signed in" *before* a task is attempted, so an auth failure is anticipated, not mysterious.
- **Actionable errors:** when an agent task's output contains `Not logged in · Please run /login`, tag it as an auth error and render the exact fix (`claude auth login` / `claude setup-token`) with a copy button, instead of a generic "error".

Possible follow-ups (out of scope for the first cut): a Settings field to store an `ANTHROPIC_API_KEY` / long-lived token for the agent env; a full in-app OAuth relay that spawns `claude auth login` server-side and relays the browser URL + code through the UI.

Provenance: surfaced 2026-07-25 when a lapsed CLI login made Draft and Extend fail with an opaque error.
