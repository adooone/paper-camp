---
id: IDEA-86
title: Surface agent sign-in state in the app
type: feat
status: idea
created: 2026-07-25
updated: 2026-07-26
tags:
  - agent
  - server
  - ui
subject: Packaging
order: 1
---

When the headless `claude` CLI the agent uses isn't authenticated, every agent task (draft, extend, run-all, fix-review, ...) fails with a generic "error" — the real cause (`Not logged in · Please run /login`) is buried in the task output. The app should make agent auth state legible and recoverable instead of silently cryptic.

First cut — detect + surface + guide:
- **Probe:** a server route (e.g. `GET /api/agent/auth-status`) runs `claude auth status` (clean JSON: `{loggedIn, authMethod, apiProvider}`) for the configured agent and returns it; degrade gracefully when the CLI is absent. Fits the existing `probeCapabilities` pattern and the [[IDEA-76]] first-run-access area.
- **Surface:** a Status-panel indicator / banner showing "Agent not signed in" *before* a task is attempted, so an auth failure is anticipated, not mysterious.
- **Actionable errors:** when an agent task's output contains `Not logged in · Please run /login`, tag it as an auth error and render the exact fix (`claude auth login` / `claude setup-token`) with a copy button, instead of a generic "error".

Possible follow-ups (out of scope for the first cut): a Settings field to store an `ANTHROPIC_API_KEY` / long-lived token for the agent env; a full in-app OAuth relay that spawns `claude auth login` server-side and relays the browser URL + code through the UI.

Provenance: surfaced 2026-07-25 when a lapsed CLI login made Draft and Extend fail with an opaque error.

### Phases
- [x] Add the `GET /api/agent/auth-status` probe route
      Run `claude auth status` for the configured agent and return `{loggedIn, authMethod, apiProvider}`; reuse the `probeCapabilities` shape and degrade gracefully (missing/unrecognized CLI → an unknown state, never a 500).
- [ ] Surface the sign-in indicator in the Status panel
      Consume the probe from the client and show an "Agent not signed in" indicator/banner before a task is attempted, so an auth failure is anticipated rather than mysterious.
- [ ] Detect auth failures in agent task output
      When a task's output contains `Not logged in · Please run /login`, classify it as an auth error rather than a generic "error", so the UI can render a specific recovery instead of an opaque status.
- [ ] Render the actionable fix for auth errors
      For a tagged auth error, show the exact command (`claude auth login` / `claude setup-token`) with a copy button in place of the generic error state.
- [ ] Type-check and full pass
      `pnpm run check-types`, `npx biome check . --write`, and `pnpm test` clean across the repo.
