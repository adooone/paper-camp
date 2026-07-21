---
id: IDEA-76
title: First-run access setup
type: feat
status: idea
created: 2026-07-20
tags:
  - app
  - settings
  - agent
  - git
  - ux
subject: Workflow
---

Installing Paper Camp into a fresh project works (`npx @dendelion/paper-camp init && … dev`), but the moment the user touches a PR feature or launches an agent, the app assumes an authenticated `gh` and a `claude`/`opencode` CLI on PATH — and fails uglily when they're missing. USAGE.md papers over this with a prerequisites sentence; the app itself should own it. This is the access half of the roadmap's "First-run experience" item (the teaching-empty-states half stays on the map).

The right posture is **detect, instruct, verify — never collect**. The app spawns CLIs that manage their own credentials (`gh auth login`, the agent CLIs' own auth); it must not grow token inputs or store secrets. What it can do is probe each capability, show exactly one command to fix a gap, and re-check on demand — a doctor, not a vault. That also keeps the app generic: nothing about this repo's setup is assumed, everything is discovered.

- **Capability probe.** A server endpoint reporting structured status for each dependency: git (repo present, user.name/email set), GitHub (`gh` installed → authenticated → repo has an origin it can reach), and each agent adapter (`claude`/`opencode` on PATH, version). Probes are the same checks the features already implicitly depend on, made explicit and inspectable.
- **Setup surface.** A Settings section (and the first thing a fresh install sees): one row per capability — ✓ / ✗ / warning stamp, what it unlocks ("PR badges, review flow"), and the exact terminal command to fix it, with a per-row re-check button. No browser OAuth theater — the commands run in the user's terminal where those CLIs put them.
- **Graceful gating.** Features whose capability is missing disable with a pointer to Setup instead of erroring: PR badges/fix-review hidden without an authenticated `gh`, agent-launch buttons disabled with "no agent CLI found" hint, commit/push untouched (git-only). The StatusBar carries a quiet indicator while anything is missing.
- **First-run routing.** On open, if the corpus is fresh or any capability is missing and setup wasn't dismissed, land on Setup first; a `setupDismissed` flag in `papercamp/config.json` keeps it from nagging.

### Phases
- [ ] Probe capabilities server-side
      `/api/capabilities`: git repo + identity, `gh` installed/authenticated/origin-reachable, each agent adapter's presence and version — structured `{ id, status, detail }` rows with a re-check (no caching staleness; probes are cheap spawns). Tests over the probe parsing.
- [ ] Build the Setup surface
      Settings section listing capability rows — status stamp, what it unlocks, the exact fix command, per-row re-check; surfaced prominently (or routed to) when anything is missing on a fresh install, with `setupDismissed` in config to opt out.
- [ ] Gate features on capabilities
      PR features and agent launches read the capability report: disabled-with-hint instead of runtime errors; StatusBar indicator while gaps exist. No behavior change when everything is present.
- [ ] Gate the pass
      `tsc --noEmit`, `biome check`, tests green; verify in a scratch `init` project with no `gh` auth and no agent CLI that the app opens clean, points at Setup, and every gated feature explains itself instead of erroring.
