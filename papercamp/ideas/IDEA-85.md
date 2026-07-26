---
id: IDEA-85
title: Apply the merge policy from Settings
type: feat
status: idea
created: 2026-07-25
updated: 2026-07-26
tags:
  - app
  - settings
  - github
  - git
subject: Packaging
order: 1
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

### Phases
- [x] Read the connected repo's current merge config on the server
      Add a server helper that runs `gh api repos/{owner}/{repo}` (resolving
      the repo the way `capabilities.ts` already does) and returns the five
      merge fields — `allow_squash_merge`, `allow_merge_commit`,
      `allow_rebase_merge`, `squash_merge_commit_title`,
      `squash_merge_commit_message` — degrading cleanly when `gh` is missing or
      unauthenticated.
- [ ] Apply the canonical squash policy from the server
      Add the write side: a `PATCH repos/{owner}/{repo}` through `gh`/API that
      sets the exact IDEA-83 values (`allow_squash_merge=true`,
      `allow_merge_commit=false`, `allow_rebase_merge=false`,
      `squash_merge_commit_title=PR_TITLE`,
      `squash_merge_commit_message=PR_BODY`) and returns the resulting config so
      the UI can show what changed.
- [ ] Expose read + apply as server routes
      Wire both into the routes layer (e.g. `GET`/`POST` under the content or
      system routes) with typed payloads, mirroring the existing endpoint shapes.
- [ ] Add the merge-policy control to Settings
      A section in `src/app/features/settings` that shows the current values
      first (legible, not a black box), then a single "Apply recommended policy"
      action — settling the open question toward Paper Camp's opinionated
      one-shot default rather than per-field toggles — and reports the result.
- [ ] Type-check and full pass
      `pnpm run check-types`, `npx biome check . --write`, and `pnpm test`
      clean across the repo.
