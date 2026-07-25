---
id: IDEA-85
title: Apply the merge policy from Settings
type: feat
status: idea
created: 2026-07-25
tags:
  - app
  - settings
  - github
  - git
subject: Workflow
---

[[IDEA-83]] gave us one release line per idea, but the mechanism that actually
enforces it — the repo's GitHub merge settings — still has to be set by hand, per
repo, via the API: disable merge and rebase merges, allow only squash, and set the
squash commit `title` to the PR title and `body` to the PR description. That's a
manual checklist that has to be repeated for every repository Paper Camp runs
against, and nothing in the tool records or applies it — the convention lives only
in `decisions.md` and a human's memory.

Paper Camp already owns the connection to a project's repo, so the merge policy
should travel with the tool. Add a Settings control that reads the connected repo's
current merge configuration and, with one action, applies the canonical squash
policy (the exact settings IDEA-83 settled: `allow_squash_merge=true`,
`allow_merge_commit=false`, `allow_rebase_merge=false`,
`squash_merge_commit_title=PR_TITLE`, `squash_merge_commit_message=PR_BODY`). It
shows the current values first (so the action is legible, not a black box), applies
via the existing GitHub integration (`gh`/API through the server), and reports the
result. Reusable across every repo the user opens in Paper Camp, so the
release-hygiene convention stops being a per-repo chore.

Open question for the plan: whether this is a one-shot "apply recommended policy"
button or a set of individual toggles mirroring GitHub's own merge-settings UI —
the former matches Paper Camp's opinionated-defaults stance, the latter is more
flexible. Not in scope: branch-protection rules or required checks (separate
concern from the squash-merge policy).
