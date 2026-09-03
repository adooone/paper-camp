---
id: IDEA-228
title: Point the registry elsewhere for tests
type: chore
status: review
created: 2026-09-03
updated: 2026-09-03
tags:
  - cli
  - testing
subject: Multi-project
---

`defaultRegistryPath()` is the only path the machine registry ever uses:
`~/.config/paper-camp/projects.json`, with the machine pairing file beside
it. `scan`, `ls`, `rm`, and `daemon` all resolve it internally with no flag
or environment override, so there is no way to run any of them against a
registry that is not the user's real one.

That was measured, not guessed: an end-to-end check of the daemon had to
register two throwaway projects in the live registry, assert against it,
and delete them afterwards. Every assertion passed, but a crash between
those steps leaves the user's own project list holding entries for
directories in `/tmp`. Any future test of `scan`, `ls`, `rm`, or the
daemon's project listing inherits that same bargain, which is why the
current suite covers the registry's pure functions and stops short of the
commands that use it.

A `PAPERCAMP_CONFIG_DIR` environment variable overrides `machineConfigDir()`,
and both `defaultRegistryPath()` and `machinePairingPath()` derive from it
as they already do — one seam, both files, no per-call plumbing. Unset, the
behaviour is unchanged. An env var rather than a flag because it also
covers a daemon spawned by a test without threading an argument through
the command surface.

It doubles as a real feature: a second registry is how a machine keeps work
and personal projects apart, or how a throwaway shell tries the daemon
without touching an existing setup.

### Out of scope

Multiple registries active at once. Registry file format. Moving the
pairing file, which follows the config dir as it already does.

### Phases
- [x] Honour `PAPERCAMP_CONFIG_DIR`
      `machineConfigDir()` reads the variable when set, so the registry and pairing files both follow it; unset behaviour is unchanged.
      run: 1m21s · 14 in · 1.3k out · sonnet-5
- [x] Cover the registry commands end to end
      `scan`, `ls`, and `rm` tested against a temp config dir, including that a directory without `papercamp/config.json` is skipped.
      run: 1m51s · 32 in · 6.8k out · sonnet-5
- [x] Cover the daemon's project listing
      Daemon started against a temp registry: `/api/machine/projects` lists them, `/p/<slug>/` mounts, an unknown slug 404s.
      run: 4m34s · 46 in · 15.7k out · sonnet-5
- [x] Document it and run the quality checks
      `USAGE.md` names the variable as the way to keep a separate set of projects; check-types, lint, vitest, consistency green.
      run: 6m34s · 30 in · 3.6k out · sonnet-5
- [x] [manual] Document PAPERCAMP_CONFIG_DIR and enable page shading
