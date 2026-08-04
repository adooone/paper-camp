---
id: IDEA-127
title: Settings port is a dead field — dev never reads it
type: fix
status: idea
created: 2026-08-04
tags:
  - cli
  - settings
---

The Settings page writes `port` into `papercamp/config.json`, but the `dev` command resolved its port exclusively from the `-p` flag with a hardcoded `3333` default — the setting was written by the UI and consumed by nothing. (Second half of the confusion: a running server never re-reads its port, so even a wired-up setting needs a restart notice in the UI.)

Fix implemented in the working tree (src/cli/index.ts): precedence is explicit `-p` flag > `config.port` > 3333. Verified against a consumer repo: config `port: 3041`, bare `dev` serves on 3041.

### Phases
- [x] Land the port precedence in `dev`
      Resolve as explicit `-p` flag > `config.port` > 3333 (already in the working tree).
- [x] Cover port precedence with a test
- [ ] Add a "restart required" hint by the Settings port field
      Running server never re-reads its port, so a changed setting needs a manual restart.
- [ ] Verify bare `dev` honours `config.port` in a fresh consumer repo

### Log
- 2026-08-04 — Fix implemented and verified; awaiting owner review/commit. Consider a "restart required" hint next to the port field in Settings.
