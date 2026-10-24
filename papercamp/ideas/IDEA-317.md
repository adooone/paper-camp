---
id: IDEA-317
title: One release line per idea, enforced
type: feat
status: planned
created: 2026-10-24
tags:
  - server
  - agent
  - git
  - ci
subject: Infrastructure
---

The v0.44.0 release PR listed about a hundred and ten lines: every phase
commit of every idea, plus *lint*, *test*, *mark IDEA-306 review* and
*knip clean*. IDEA-83 designed one line per idea, but it rests on phases
committing to a feature branch that squash-merges under a conventional PR
title, and nothing enforces that. *Create branch* is a sidebar click; a run
started on `main` commits its phases straight to `main`, and release-please
then lists them all. The whole 0.44.0 cycle ran that way, and the
description had to be rewritten by hand.

**A run branches before its first phase.** `start` and `startRunAllPhases`
in `src/app/server/agent.ts` call `git.ensureBranch(plan)` before
`startOrchestrated` whenever the current branch is `main` or `master`.
`ensureBranch` already names the branch
(`<type>/<lowercase-id>-<kebab-title>`), checks it out if it exists, and
otherwise cuts it from the freshest `origin/main`. When it throws (a dirty
tree, an unreachable checkout) the run does not start: the result is
`{ ok: false, error }` with git's message, shown where the Stack shows any
refused run. A run started on any other branch keeps it, as today. The
run-order queue reaches `startRunAllPhases`, so queued ideas branch too.
`runBatch` kinds (reconcile, suggest) write only the corpus and stay on the
current branch.

**Phase commits never land on main.** `commitPhase` and `commitVerifyFix`
in `src/app/server/agent-hooks.ts` throw when `git.getCurrentBranch()` is
`main` or `master`; the orchestrator's existing catch turns that into a
`[fail]` line, *phase commits never land on main*, and the run stops. This
is a guard behind the first item, not a path a user sees. Corpus-only
commits (`commitCorpus`, the plan doc) stay allowed on `main`, as
`AGENTS.md` permits.

**The review stamp is a docs commit.** `setRunReview` commits
`<type>(<scope>): mark IDEA-N review`, so every finished idea adds a
*Features* or *Bug Fixes* line that says nothing. It commits
`docs(ideas): mark IDEA-N review` instead; `docs` is hidden from the
changelog.

**The release PR is grouped by idea anyway.** Tiny fixes and config commits
are still allowed on `main`, so the release PR can still carry stray lines.
`paper-camp release-notes <version>` already prints a release grouped one
row per idea from the `Refs:` trailers and branch names; it gains
`--write`, which replaces that version's section in `CHANGELOG.md` in place
and prints the section. `release.yml` adds a step after release-please,
run only when `steps.release.outputs.pr` is set: check out the release PR's
branch with the Scout token, run `pnpm cli release-notes <version> --write`,
commit `chore(release): Group the notes by idea` when the file changed, push,
and `gh pr edit --body` with the printed section under release-please's own
header and footer. The step is idempotent, so release-please regenerating
the section on its next run is simply regrouped again. Commits without an
idea keep their own line under the section they came from.

Done when a phase run started on `main` lands its first commit on the
idea's branch, a run that cannot branch refuses with git's message, a phase
commit attempted on `main` fails the run, a finished idea adds no changelog
line for its review stamp, and the next release PR's description and
`CHANGELOG.md` section read one line per idea with the idea's title.

### Out of scope

Merging the PR: *Complete idea* on the Deliver bar already squash-merges.
Rewriting past CHANGELOG sections.

### Phases
- [ ] Branch before the first phase
      `start` and `startRunAllPhases` call `ensureBranch` when on main or
      master; a throw refuses the run with git's message; tests for the
      branch cut, the existing branch, the dirty tree and the non-main
      start.
- [ ] Phase commits refuse main and the review stamp is docs
      Guard in `commitPhase` and `commitVerifyFix` with the `[fail]` line;
      `setRunReview` commits as `docs(ideas)`; tests.
- [ ] Release notes grouped by idea in the release PR
      `release-notes --write` replaces the version's CHANGELOG section;
      the `release.yml` step checks out the release branch, rewrites,
      commits, pushes and edits the PR body; a test for the in-place
      rewrite.
