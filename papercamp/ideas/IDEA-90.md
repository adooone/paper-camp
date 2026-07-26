---
id: IDEA-90
title: Connections for every service
status: idea
created: 2026-07-25
updated: 2026-07-26
subject: Packaging
---

`src/app/server/capabilities.ts` already probes git, `gh`, and the agent binaries into ok/warn/missing, and Settings' Setup section already names what each one unlocks. What's missing is an action layer: a probe can tell you `gh` is installed but not authenticated, and then the app can do nothing about it. Services beyond git/gh/claude have no representation at all.

Turn capabilities into a proper Connections surface: one row per service — agent CLIs including claude, GitHub, and other model providers — each with live status, what it unlocks, and a connect/sign-in action or the exact command to run. This is what makes Paper Camp usable in a fresh project the way it was designed, instead of requiring a hand-configured machine and tribal knowledge about which tool needs which login.

[[IDEA-86]] is the first slice of this: narrow, claude-only sign-in detection plus guidance. It lands first and this idea generalizes it to every service. Worth deferring as follow-ups: storing tokens for the agent environment, and a full in-app OAuth relay.
