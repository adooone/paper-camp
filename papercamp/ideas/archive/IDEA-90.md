---
id: IDEA-90
title: Connections for every service
type: feat
status: done
created: 2026-07-25
updated: 2026-07-29
released: v0.12.0
tags:
  - server
  - settings
  - github
  - agent
subject: Packaging
---

`src/app/server/capabilities.ts` already probes git, `gh`, and the agent binaries into ok/warn/missing, and Settings' Setup section already names what each one unlocks. What's missing is an action layer: a probe can tell you `gh` is installed but not authenticated, and then the app can do nothing about it. Services beyond git/gh/claude have no representation at all.

Turn capabilities into a proper Connections surface: one row per service — agent CLIs including claude, GitHub, and other model providers — each with live status, what it unlocks, and a connect/sign-in action or the exact command to run. This is what makes Paper Camp usable in a fresh project the way it was designed, instead of requiring a hand-configured machine and tribal knowledge about which tool needs which login.

[[IDEA-86]] is the first slice of this: narrow, claude-only sign-in detection plus guidance. It lands first and this idea generalizes it to every service. Worth deferring as follow-ups: storing tokens for the agent environment, and a full in-app OAuth relay.

### Phases
- [x] Define the service registry and connection model
      A declarative list of services (agent CLIs including claude, GitHub, other model providers), each with an id, what it unlocks, its probe, and its connect action or command. Generalizes the ad-hoc git/gh/claude checks in `src/app/server/capabilities.ts`.
- [x] Extend the server probes to report per-service auth state
      Beyond installed/missing, each service reports authenticated vs signed-out, building on [[IDEA-86]]'s `claude auth status` probe and adding `gh auth status` and provider checks. Expose one route returning the full connection list.
- [x] Add connect/sign-in actions per service on the server
      For each service, either run the sign-in flow or return the exact command to copy. Degrade gracefully when a CLI is absent.
- [x] Build the Connections surface in Settings
      Replace the Setup section's static naming with one row per service — live status, what it unlocks, and a connect button or copyable command. Reuse [[IDEA-86]]'s indicator pattern.
- [x] Type-check and full pass
