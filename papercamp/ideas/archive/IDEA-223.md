---
id: IDEA-223
title: Desk discovery for new projects
type: feat
status: done
created: 2026-09-01
updated: 2026-09-03
tags:
  - app
  - server
  - settings
subject: Run & monitor
order: 2
---

The Stack panel is already config-driven and nothing fills the config. The
schema exists (`deskConfigSchema`: `services[{name, cmd, port, healthcheck}]`,
`checks[{name, cmd}]`, `ci{repo, branch, releasePlease}`) and four consumers
read it — `desk-services.ts`, `desk-checks.ts`, `routes/ci.ts`,
`use-desk-manifest.ts`. But `paper-camp init` writes no `desk` block, and
Settings has no desk UI at all (only General and the agent task rows). So
every project except this one opens with an empty Stack panel, and the only
way out is hand-editing `config.json` — which nothing in the app tells you
is possible.

Discovery closes that: a job that reads the project and proposes its desk
block.

**Evidence is gathered deterministically.** A core module collects facts,
never guesses: the package manager from the lockfile, every `package.json`
script with its command, the dev server's port from the script's `--port`
flag or the framework config, the git `origin` slug and whether
`.github/workflows/` and a release-please config exist, and the presence of
non-JS manifests (`Cargo.toml`, `pyproject.toml`, `go.mod`, `Makefile`)
with their declared targets. Facts only, no interpretation.

**The agent turns evidence into the block.** A `deskDiscovery` task joins
`defaultAgents` beside `phase` and `planDraft`, receives the evidence, and
returns a desk block conforming to the schema — deciding which scripts are
checks and which are long-running services, naming them for the panel, and
filling `ci` from the remote. Evidence keeps it grounded; judgment handles
what a script map cannot settle on its own, including non-JS and monorepo
stacks.

**Nothing is written without review.** The proposal lands in a Settings
desk section showing what it will add against what is configured now; the
user edits, then applies. That section is also the manual desk editor the
app currently lacks, so it earns its place whether or not discovery ever
runs. Re-running on a configured project proposes a diff and never
silently overwrites.

**It is offered, not forced.** A project whose config has no `desk` block
gets the offer once, from the Stack panel's empty state — that is the "new
project" trigger — and Settings can re-run it at any time.

This scans the *project*: its commands. It does not duplicate
`capabilities.ts` and `external-services.ts`, which probe the *machine* for
`gh` and the agent CLIs. The two answer different questions and stay
separate.

### Out of scope

Running the discovered commands as part of discovery — proposing a check
does not execute it. Changing the desk schema. Changing the check
vocabulary. Guessing config for a project paper-camp was never initialized
in.

### Phases
- [x] Gather project evidence
      A core module returning package manager, scripts, detected dev port, git origin slug, CI and release-please presence, and non-JS manifest targets — facts only, absent files simply absent.
      run: 9m15s · 88 in · 26.4k out · sonnet-5
- [x] Add the deskDiscovery agent task
      New task type in `defaultAgents` with a prompt that takes the evidence and returns a schema-valid desk block; invalid output is rejected, not written.
      run: 9m13s · 154 in · 30.5k out · sonnet-5
- [x] Build the Settings desk section
      Read and edit `desk.services`, `desk.checks`, and `desk.ci` by hand, the surface the app lacks today.
- [x] Review and apply a proposal
      Show the proposed block against current config, let the user edit before applying, and diff rather than overwrite on a re-run.
- [x] Offer discovery from the empty Stack panel
      A project with no `desk` block offers the scan once from the panel's empty state; Settings can re-run it any time.
- [x] Cover discovery in tests and run the quality checks
      Evidence gathering covered per stack fixture, schema rejection covered; check-types, lint, vitest, consistency green.
- [x] [manual] Add Desk settings section and discovery API
- [x] [manual] Let kept proposal rows be restored and fix desk save issues
- [x] [manual] Fix desk row saves and let CI be restored in proposals
- [x] [manual] Tighten reconcileRows comment for clarity

### Thread
- [x] 2026-09-01 [log] [agent] Run order: Fills the Stack panel's empty desk config with no dependency on the other three, and is a foundation the daemon's per-project serving in IDEA-224 benefits from having in place first.
- [ ] 2026-09-01 [question] [agent] Run-all parked on phase 3 ("Build the Settings desk section") — the agent needs a decision: You've hit your session limit · resets 1:40pm (UTC)
- [ ] 2026-09-01 [question] [agent] Run-all parked on phase 3 ("Build the Settings desk section") — the agent needs a decision: read outside workspace: /home/croco/dev/paper-ui/src/components/page/page.tsx
- [ ] 2026-09-01 [question] [agent] Run-all parked on phase 4 ("Review and apply a proposal") — the agent needs a decision: read outside workspace: /home/croco/dev/paper-ui/src/components/modal/modal.tsx
- [x] 2026-09-02 [review] [agent] Requests changes · 7 findings — The feature is substantively there: deterministic evidence gathering, a schema-validated deskDiscovery agent task wired into defaultAgents and the task registry, a POST /api/desk/discover route, a manual Desk settings section, and the Stack panel empty-state offer — and check-types, lint, knip/depcruise and the new tests all pass locally. Two things in the review-and-apply path fall short of what phase 4 claims: the proposal modal gives the user no way to keep an existing entry the agent dropped, and the Settings CI fields write config.json (with a toast) on every keystroke. The PR also carries unrelated work — a new IDEA-226 with its phase 1 applied, an AGENTS.md/knip/script change, and a switch of this project's phase agent to opencode — and leaves three open [question] entries on IDEA-223 while marking it review.
- [x] 2026-09-02 [review] [agent] Comments · 6 findings — The feature is delivered end to end and matches the idea's shape: deterministic evidence gathering in core, a deskDiscovery task wired through defaultAgents and the read-only agent path, schema-rejecting parse of the agent output, a Settings desk editor, and an offer from the Stack panel's empty state. I ran check-types and the four new test files locally and they pass, so phase 6's claim holds. What I'd fix before merge is the CI editor writing config.json on every keystroke, the empty desk block that permanently hides the discovery offer, and the fact that a proposal's "will remove" rows can't actually be kept.
- [x] 2026-09-02 [review] [agent] Requests changes · 6 findings — The feature is genuinely delivered end to end — deterministic evidence gathering in core, a schema-validated deskDiscovery task wired through defaultAgents and the read-only agent path, a POST /api/desk/discover route, a manual Desk settings section, and the Stack panel empty-state offer; I ran the four new test files and all 30 tests pass, so phase 6's claim holds. What does not hold up is phase 3's manual editor: because every field blur saves the whole desk through a server that silently ignores an all-empty desk and because incomplete rows are filtered out before saving, adding a service loses the row mid-typing and deleting the last entry reports "Saved" while the entry comes back. The PR also carries a fair amount of work unrelated to IDEA-223 (a whole new IDEA-226 with its phase applied, AGENTS.md/knip/scripts changes, an app-shell texture tweak, and a switch of this project's own phase agent to opencode).
