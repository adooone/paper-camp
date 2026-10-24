---
id: IDEA-317
title: Release notes grouped by idea
type: feat
status: planned
created: 2026-10-24
tags:
  - ci
  - cli
  - agent
subject: Infrastructure
---

The v0.44.0 release PR listed about a hundred and ten lines: every phase
commit of every idea, plus *lint*, *test*, *mark IDEA-306 review* and
*knip clean*. Work here happens directly on `main`, so release-please sees
one commit per phase and lists them all; the description had to be
rewritten by hand into one line per idea. That rewrite is what
`paper-camp release-notes <version>` already computes: one row per idea,
titled by the idea, joined to its commits through `Refs:` trailers, in the
same sections as the CHANGELOG. Nothing runs it.

**The release PR carries the grouped notes.** `release-notes <version>`
gains `--write`, which replaces that version's section in `CHANGELOG.md` in
place and prints the section. `release.yml` adds a step after
release-please, run only when `steps.release.outputs.pr` is set: check out
the release PR's branch with the Scout token, run
`pnpm cli release-notes <version> --write`, commit
`chore(release): Group the notes by idea` when the file changed, push, and
`gh pr edit --body` with the printed section under release-please's own
header and footer. The GitHub release takes its notes from that body, and
`stamp-release` keeps resolving the range from the section's compare link.
The step is idempotent: when release-please regenerates the section on a
later push, the step regroups it again.

**One line per idea.** Each idea becomes one bullet, its title in bold and
its id at the end, under the section its type maps to (`feat` →
*Features*, `fix` → *Bug Fixes*). A phase, lint, test or review-stamp
commit adds nothing of its own. A commit with no idea reference keeps its
own line in the section its type maps to, so a hand-made fix on `main` is
still listed.

**The review stamp stops making a line.** `setRunReview` in
`src/app/server/agent-hooks.ts` commits `<type>(<scope>): mark IDEA-N
review`, so every finished idea adds a *Features* or *Bug Fixes* entry that
says nothing. It commits `docs(ideas): mark IDEA-N review`; `docs` is hidden
from the changelog. Phase commits keep their types, since they are the
release's real content and the grouping folds them.

Done when the next release PR's description and `CHANGELOG.md` section read
one bullet per idea with the idea's title, a hand-made fix on `main` still
has its line, a finished idea's review stamp adds none, and a second
release-please run on the same PR leaves the grouped section in place.

### Out of scope

Branching per idea: work stays on `main`. Rewriting past CHANGELOG sections.

### Phases
- [x] Write the grouped section in place
      `release-notes <version> --write` replaces the version's section in
      `CHANGELOG.md` and prints it; commits without an idea keep their
      line; tests for the rewrite and the idempotent second run.
      run: 6m12s · 114 in · 25.6k out · sonnet-5 · sess:b7c47609-d845-4a6a-b4b7-b1fe5e908b90
- [ ] Regroup the release PR from the workflow
      The `release.yml` step on the release branch: rewrite, commit, push,
      `gh pr edit --body`.
- [ ] The review stamp as a docs commit
      `setRunReview` commits `docs(ideas): mark IDEA-N review`; test.
