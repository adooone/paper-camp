---
id: IDEA-142
title: Faster phase runs
type: refactor
status: idea
created: 2026-08-07
tags:
  - agent
  - server
  - performance
subject: Run & monitor
---

Measured (2026-08-07, transcript timestamps of the three latest phase
runs): model generation is 63–80% of phase wall time; check loops are
0–18%; everything else is noise. Phases go out as opus at high effort
with 40–56 turns. So the checks aren't the bottleneck — but they do cost
prompt text and agent turns they don't deserve. Three changes, aimed
where the time actually goes:

1. **Biome leaves the prompts — the harness owns it.** Style fixing is
   deterministic, so no agent should spend turns on it: the server runs
   `biome check --write` itself before each per-phase commit. The phase
   prompt loses the biome instruction entirely.

2. **Type checks stay per phase, but get cheap.** Type errors compound —
   a phase that commits broken types makes every later phase pay
   generation time debugging inherited rubble, and per-phase commits stop
   being bisectable. Keep `check-types` in the prompt and switch the
   config to `tsc --incremental` so re-checks inside a chained run take
   seconds, not tens of seconds.

3. **Run-all defaults to medium effort.** The only knob aimed at the
   63–80% slice. The project default in Settings becomes `medium`; high
   stays available there for projects or stretches that need it.

Resume chaining is verified working (all five IDEA-139 phases in one
508K session) and stays — it's what spares agents re-exploring the repo
each phase. Its cost is context that grows along the chain; once
[[IDEA-135]]'s per-phase records exist, check whether late-chain phases
run slower per turn, and only then consider restarting the chain every
few phases. [[IDEA-141]]'s milestone detector reads the same prompt
stages this idea edits — keep the two in sync.

### Thread
- [x] 2026-08-07 [decision] A single final "lint and fix" phase per idea was rejected: biome needs no agent at all (harness autofix pre-commit), and deferring type checks makes later phases build on broken types — the expensive generation time would grow, not shrink. Effort default drops to medium as the lever actually pointed at generation.

### Phases
- [x] Make type checks incremental
      Switch the check-types config to `tsc --incremental` so chained re-checks take seconds.
- [x] Run biome autofix in the server pre-commit
      Server runs `biome check --write` before each per-phase commit.
- [ ] Drop the biome instruction from the phase prompt
- [ ] Default run-all effort to medium in Settings
      Keep high selectable there for projects or stretches that need it.
- [ ] Keep IDEA-141's milestone detector in sync with the edited prompt stages
