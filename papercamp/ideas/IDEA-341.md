---
id: IDEA-341
title: Bookkeeping commits stay in papercamp
type: fix
status: review
created: 2026-11-20
updated: 2026-11-22
tags:
  - server
  - agent
subject: Run & monitor
---

Twice this month a phase's source landed in a `docs(ideas): … run
bookkeeping` commit instead of its own: IDEA-325's pid-file work in
d4f4a1c8 and IDEA-334's decision-marker fix in 8aa1111c. Both runs
parked on a question before reaching their commit step, and
`commitBookkeeping` in `src/app/server/agent-hooks.ts` then ran
`git.stageAll()` and committed everything in the tree under a docs
subject with `--no-verify`. The catch-all was meant for corpus writes a
run's own commits did not ride on (IDEA-319); applied to source it hides
a fix behind a docs type that release-please does not list, breaks the
commit-message convention, and cannot be undone without rewriting
`main`.

**Bookkeeping is corpus only.** `commitBookkeeping` stages `papercamp/`
and nothing else; the docs subject and `Refs` trailer stay. Source a
finished run left uncommitted gets its own commit right after, `<plan
type>(<primary tag or app>): <phase title>` with the same trailer and
hooks on, which is the commit the agent should have made. A run that
parked or failed leaves its source in the working tree and the daemon
appends a log line to the thread naming the paths left behind, so the
resumed run commits them with the phase.

**Acceptance.** A run that parks with dirty `src/` produces a
bookkeeping commit touching only `papercamp/` and a thread line listing
the dirty paths; a run that finishes with dirty `src/` produces a
bookkeeping commit and a typed phase commit; `git log --format=%s` after
a run never shows source files under a `docs(ideas)` subject.

### Phases
- [x] Bookkeeping stages the corpus only
      `commitBookkeeping` stages `papercamp/` only; after a finished run, leftover source is committed as `<type>(<scope>): <phase title>` with `Refs`; after a parked or failed run the dirty paths are logged on the thread. Tests in `agent-hooks.test.ts` for the three outcomes.
      run: 2m8s · 34 in · 8.1k out · sonnet-5-5 · sess:f2f186f1-ee04-443d-917d-0543d98c897c
