---
id: IDEA-119
title: Run & monitor on the desk
type: feat
status: idea
created: 2026-08-04
tags:
  - app
  - monitoring
subject: Run & monitor
---

A new desk section for the developer loop, declared per project in `papercamp/config.json`:

- **Services** — `{ name, cmd, port, healthcheck }` (dev server, showcase, watchers): start/stop, status dot, log tail. node-pty is already a dependency; this is its natural home.
- **Checks** — typecheck/lint/test/build as one-click runs, rendered with the same Quality/Tests stamps the Stack panel already uses — including the existing failing-check → suggested-fix → launch-agent loop, generalized to any registered project.
- **CI & release mirror** — main's Actions status, the open release-please PR, released version vs. what's queued for the next one.

Scope guard: dev-loop-sized on purpose. No metrics/APM/alerting — link out to real observability rather than rebuilding it. The declarative manifest is also what makes this stack-agnostic: a Rust or Python project just declares different `cmd`s.

Adjacent to Horizon 2's **Insight from the task log** (that bullet is about past runs; this one is about live processes) — proposed as its own Horizon 2 item.

### Phases
- [x] Define the desk manifest schema in config.json
      Declare services, checks, and CI/release sources per project; validate on load.
      run: 4m29s · 8.6k in · 12.7k out · opus-4-8
- [x] Add the desk section shell to the app
      New collapsible section that reads the manifest and renders empty Services/Checks/CI groups.
      run: 3m57s · 660 in · 12.1k out · opus-4-8
- [ ] Wire Services to node-pty
      Start/stop, status dot, healthcheck polling, and log tail per declared service.
- [ ] Render Checks as one-click runs
      Reuse the Quality/Tests stamps and the failing-check → suggested-fix → launch-agent loop for any registered check.
- [ ] Mirror CI & release state
      Show main's Actions status, the open release-please PR, and released vs. queued version.
