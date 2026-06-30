---
id: FEAT-22
title: GitHub CI/CD automation
kind: feat
status: done
created: 2026-06-27
idea: IDEA-18
updated: 2026-06-28
tags:
  - ci
  - cd
  - github
---

This repo has zero `.github/` workflows today — no CI runs tsc/biome/vitest
on push or PR, no automated npm publish, and every commit goes straight to
`main`. One piece of groundwork already exists unused: `.commitlintrc.json`
enforces Conventional Commits but nothing runs it. Wires up real CI/CD around
what's already there: CI on push/PR, automated versioning via release-please
(with an explicit decision on whether `refactor` bumps patch), npm publish
on release, and a PR-per-feature workflow tied to this repo's own
FEAT-N/FIX-N naming scheme.

### Phases
- [x] Add CI workflow for tests, quality, and commitlint
      A `.github/workflows/ci.yml` running `pnpm install`, then
      `pnpm run check-types`/`pnpm run lint`/`pnpm test` on push and PR,
      plus `commitlint --from <base> --to <head>` against the PR's commits
      to finally give `.commitlintrc.json` a real job.
- [x] Configure release-please for automated versioning
      Decision: `refactor` bumps patch — this repo treats refactoring as a
      first-class deliverable (4 REFACTOR plans). Since release-please
      doesn't support custom type-to-bump mappings natively, `refactor`
      appears in `changelog-sections` under "Code Refactoring" and rides
      along with the next feat/fix release. To make refactor trigger
      independent patch releases, toggle `versioning` to `always-bump-patch`
      or add a custom release-please versioning plugin.
- [x] Add npm publish workflow
      Triggered on the GitHub Release created by release-please: runs
      `pnpm run build` and `npm publish` using an `NPM_TOKEN` repo secret.
- [x] Adopt per-feature branch workflow
      Define a branch-naming convention (e.g. `feat/feat-N-title`), a PR
      creation mechanism, and decide when a PR opens and whether `main`
      stays directly pushable. Resolve the open question about how
      per-branch work affects IDEA-4's agent writing directly to
      `plans.md`/`progress.md`.
- [x] Split CI into named jobs: Quality, Tests and Consistency
      Split `ci.yml`'s single `ci` job into three parallel jobs
      (`quality`: `check-types` + `lint`, `tests`: `vitest`,
      `consistency`: `commitlint`) so each appears as its own
      named check on PRs per the log entry.
- [x] Make refactor commits trigger independent patch releases
      The decision in phase 2 says `refactor` bumps patch. After
      verifying: release-please's `DefaultVersioningStrategy` already
      maps `refactor` → patch under `"versioning": "default"` — its
      `determineReleaseType` fallback returns `PatchVersionUpdate` for
      every non-breaking, non-feat commit type. The changelog section
      was already configured; only the understanding needed updating.
- [x] Add explicit job/step names and lock down `main`
      Audit found job ids (`quality`/`tests`/`consistency`) had no `name:`
      field, so GitHub showed the lowercase id rather than the intended
      "Quality"/"Tests"/"Consistency" labels; same gap on every step across
      all 4 workflows (no `name:`, just bare `run:`/`uses:`). Added explicit
      `name:` to every job and step. Live-repo audit via `gh api` also found
      `main` had zero branch protection (a broken commit could merge via PR
      with no required checks) and no `NPM_TOKEN` secret (publish.yml would
      fail on first release). Branch protection added requiring
      Quality/Tests/Consistency to pass before merge, without blocking direct
      pushes (`enforce_admins`/restrictions off) per the existing "main stays
      pushable" decision. `NPM_TOKEN` left for the user to set directly
      (secret value, not something an agent should generate or see).
- [x] Adopt `type(scope): description` commit convention
      Scope is the plan/idea number with no kind prefix (e.g. `feat(22): ...`
      for `FEAT-22`); non-plan commits use a short area name instead (e.g.
      `chore(deps): ...`). Added `scope-empty: [2, "never"]` to
      `.commitlintrc.json` to require a scope on every commit. While testing
      against this repo's real commit history, found that `subject-case`
      (inherited from `@commitlint/config-conventional`) rejects the
      capitalized subjects this repo has always used (e.g. "Settings config
      workspace") — the `consistency` CI check would have failed on every
      existing-style commit the first time it ran on a real PR. Disabled
      `subject-case` (`[2, "never", []]`) to match the established style
      instead of forcing a lowercase-first-word rewrite. Documented the full
      convention in `AGENTS.md`.
- [x] Rename release-please and create-pr workflows for clarity
      `release-please.yml`/job `release-please` tied the file name to the
      underlying tool rather than what it does — renamed to `release.yml`/job
      `release` (workflow display name "Release"). `create-pr.yml`/job
      `create-pr` was too generic (sounds like it handles any PR creation,
      not specifically the auto-draft-on-first-push behavior) — renamed to
      `draft-pr.yml`/job `draft-pr` (display name "Draft PR"). Did not merge
      the two workflows: they trigger on disjoint events (`release.yml` only
      on push to `main`; `draft-pr.yml` only on push to feature branches) and
      serve unrelated concerns, so one file per concern stays clearer.
      `.github/release-please-config.json` and
      `.github/.release-please-manifest.json` keep their tool-specific names
      — those are release-please's own expected config files, recognizable
      to anyone who knows the tool; only the workflow/job display names
      (which show up as GitHub UI labels) needed to be generic. Updated
      references in `AGENTS.md` and `decisions.md`.
- [x] Auto-create branch when a plan's first phase starts
      `agent.start(plan, phaseIndex)` in `src/app/server/agent.ts` is the
      single entry point the Stack panel's Play button calls. The trigger is
      the **first phase actually being launched** (`phaseIndex === 0`), not
      the plan's `Status` flipping to `in-progress` — a plan can sit
      `in-progress` with zero phases started and zero branch yet. When phase
      0 launches, derive the branch name from the existing
      `<kind>/<lowercase-id>-<kebab-title>` convention and create+check it
      out off `main` before spawning the agent (extend `createGitManager()`
      in `src/app/server/git.ts` with an `ensureBranch(plan)` alongside its
      existing `commit()`). No-op if already on that branch. Only covers
      phase starts launched through the agent UI — direct edits outside that
      flow still need a manual branch.
- [x] Block switching to another plan while a branch is in flight
      Once a plan has a branch (created by the phase above), the working
      tree is checked out to that branch — starting agent work on a
      *different* plan would mean switching branches mid-flight with
      uncommitted/unmerged work sitting on the first. Block launching agent
      work on any other plan while the current plan's branch exists and the
      plan hasn't reached `done`. Show the user a message naming the
      in-flight plan and telling them to finish it first (e.g. "Finish
      `FEAT-22` — GitHub CI/CD automation — before starting another plan").
      This is stricter than the existing one-task-at-a-time guard in
      `agent.ts`: that only blocks concurrent *agent processes*; this blocks
      switching plans even between agent runs, for as long as the branch is
      unfinished.
- [x] Auto-create branch and finalize commit on plan approval
      On the "Approve & close" action (the one that flips a plan's `Status`
      to `done`), check whether the plan currently has an associated branch.
      If none exists (e.g. work happened straight on `main`), create one at
      that point via the same `ensureBranch(plan)`. Commit any outstanding
      changes with a `type(scope): description` message (per the convention
      from phase 8) whose body lists every phase's title as a bullet, so the
      commit doubles as a changelog of what shipped for that plan. This is
      also the point that lifts the "block switching plans" restriction from
      the phase above, since the plan is now `done`.
- [x] Show branch name in the commit card
      The commit section at the top of the Stack panel's card
      (`src/app/components/stack-panel.tsx:689`) shows staged files and a
      commit title/message form, but never says which branch the commit
      will land on. `git.ts` already has `getCurrentBranch()` (line 142) but
      it isn't exposed via `/api/git/status` — add it to that response and
      render it (e.g. a small label/Stamp next to the "Commit" heading) so
      it's obvious at a glance which plan's branch is checked out before
      committing.
- [x] Fix approval-time branch guard and empty-scope commit
      Review found two bugs in the approval flow (`PATCH /api/plans`,
      `status: 'done'`, `src/app/server/api.ts`). (1) It called
      `git.ensureBranch()`/`git.commitAll()` without first checking
      `checkBranchConflictForPlan()` — the guard phase 11 added — so
      approving plan B while plan A's branch had uncommitted work would
      checkout/create plan B's branch carrying plan A's dirty changes along,
      then commit them under plan B's message. Added the same conflict check
      before the write, returning 409 if another plan's branch is still in
      flight. (2) `finalEntry.id?.replace(...) ?? ''` produced an empty
      commit scope (`chore(): Title`) for plans with no `Id`, violating the
      `scope-empty` rule from phase 8. Added a kebab-title fallback scope for
      that case.
- [x] Drop auto-commit on approval — branch-only
      Decided approval should only ensure the branch exists (create it if
      none, no-op if already on it); committing is left to the user via the
      Stack panel's existing manual commit flow. Removed `git.commitAll()`
      from `git.ts` (now unused) and the commit-title/body/scope generation
      from the `PATCH /api/plans` `status: 'done'` handler in `api.ts` —
      `ensureBranch()` plus the existing `checkBranchConflictForPlan()` guard
      from phase 14 are all that's left on approval. The
      `type(scope): description` convention from phase 8 still applies, just
      typed by hand rather than generated.
- [x] Fix CI failing on unpinned pnpm version
      Live pipeline failed: `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` from
      pnpm itself, then `this version of pnpm requires at least Node.js
      v22.13`. Root cause: every workflow's `pnpm/action-setup@v4` used
      `version: latest`, which resolved to pnpm 11.9 (needs Node ≥22.13's
      `node:sqlite`), while every workflow's `actions/setup-node@v4` pins
      `node-version: 20`. Locally `pnpm --version` is 10.12.1, fine on Node
      20 — only CI had drifted. Fixed by adding `"packageManager":
      "pnpm@10.12.1"` to `package.json` as the single source of truth, and
      removing the `version: latest` override from all 4 `pnpm/action-setup`
      steps (`ci.yml` ×3, `publish.yml` ×1) so the action reads the pinned
      version from `packageManager` instead.
- [x] Fix CI failing on unresolvable @dendelion/paper-ui module
      Quality check (`tsc --noEmit`) failed with `Cannot find module
      '@dendelion/paper-ui'` across every file importing it. Root cause:
      `package.json` declared `"@dendelion/paper-ui": "link:../paper-ui"` — a
      relative symlink to a sibling repo that only exists on the dev
      machine. CI has no `../paper-ui` checked out, and critically, this
      would have broken any real `npm install paper-camp` too (the planned
      `publish.yml` would have shipped a broken package). Fix, in order:
      (1) in `~/dev/paper-ui`, committed 30+ files of pending work (5 new
      components — Accordion, Icon, ListItem, Progress, Textarea — plus
      supporting changes), wrote an accurate `minor` changeset (the existing
      one was stale, marked `patch`), ran `pnpm run version` to bump
      `0.1.1` → `0.2.0`, verified `check-types`/`build`, and `pnpm publish
      --access public`. (2) In `paper-camp`, changed the dependency to
      `"^0.2.0"` (a normal registry range) and ran `pnpm install` — verified
      it resolves a real package from the npm store, not the old symlink.
      `tsc`/`biome`/`vitest` all clean. (3) Documented the new workflow in
      `AGENTS.md`: `pnpm link ../paper-ui` for local active co-development
      (invisible to git/CI), plain `pnpm install` to go back to the
      registry version, and the changeset → version → publish sequence for
      shipping a new paper-ui release.
- [x] Fix duplicate CI runs on feature branches
      `ci.yml` triggered on both `push` (to `main`/`feat/*`/`fix/*`/etc.,
      added in phase 4) and `pull_request` (to `main`). Once `draft-pr.yml`
      opens a PR on the first push, every later push to that branch fires
      both events for the same commit — two full sets of Quality/Tests/
      Consistency runs. Restricted `push` to `main` only; `pull_request`
      alone now covers every feature-branch commit, since a PR exists from
      the first push onward (created within seconds by `draft-pr.yml`), so
      there's no coverage gap.
- [x] Fix dev server breaking after the paper-ui registry switch
      User reported the app wouldn't load: `SyntaxError: The requested
      module .../react-dom/index.js does not provide an export named
      'createPortal'`. Root cause: `vite.app.config.ts` had
      `optimizeDeps: { exclude: ['@dendelion/paper-ui'] }`, set up for the
      old `link:../paper-ui` symlink workflow so Vite always read the live
      symlinked `dist/` fresh. With `@dendelion/paper-ui` now a normal
      registry-installed package, that exclude meant Vite never crawled into
      it to discover its `react-dom` import, so `react-dom`'s CJS module got
      served without ESM interop — hence the missing named export. Removed
      the `optimizeDeps.exclude` entry; restarted the dev server with a
      cleared `node_modules/.vite` cache. Verified live in the browser via
      Claude in Chrome: Plans and Settings pages render fully, zero console
      errors, branch-name `Stamp` in the Stack panel still shows correctly.
- [x] Add CodeRabbit for automated PR review
      Install the CodeRabbit GitHub App on this repo (free for public repos,
      no API key/secret needed — separate from the Claude-based local
      `/code-review` skill, giving every PR a second, independent pass).
      Add a `.coderabbit.yaml` pointing it at this repo's actual conventions
      (`AGENTS.md`, `CODE_STYLE.md`, `UX_PRINCIPLES.md`) so review comments
      check against real repo rules instead of generic defaults. Goal is a
      lightweight "does this fit the repo's style/rules" pass, not deep bug
      hunting — CodeRabbit was picked over Greptile (pricier, noisier,
      overkill for a solo project) and Qodo Merge (more configurable but
      requires self-hosting the Action and managing your own LLM key).
- [x] Open draft PRs as a named GitHub App bot, not `github-actions[bot]`
      `draft-pr.yml` ran `gh pr create` with `secrets.GITHUB_TOKEN`, so every
      auto-created draft PR showed up authored by `github-actions[bot]`. User
      created a GitHub App named **Scout** (`pull_requests: read/write`, no
      webhook) under the `adooone` org and installed it on this repo, then
      set `SCOUT_APP_ID`/`SCOUT_PRIVATE_KEY` as repo secrets themselves (`gh
      secret set`) so the private key never touched this chat. Along the
      way: `gh secret set` echoed back `croco-dendy/paper-camp` instead of
      `adooone/paper-camp` — turned out to be the same repo (same numeric
      id), a leftover redirect from when the repo was transferred from the
      personal account into the org; the secret landed correctly either way,
      but updated the local `origin` remote to the canonical
      `adooone/paper-camp` URL to stop the confusion going forward. Added a
      `Generate Scout app token` step to `draft-pr.yml` using
      `actions/create-github-app-token@v1` with those two secrets, and
      pointed the `Create draft PR` step's `GITHUB_TOKEN` env at
      `steps.app-token.outputs.token` instead of `secrets.GITHUB_TOKEN`.
      YAML re-parses clean, `biome` clean.
- [x] Triage and fix CodeRabbit's first review pass
      CodeRabbit posted 9 actionable comments on PR #1. Fixed the
      clear-cut ones: (1) `draft-pr.yml` interpolated `github.ref_name`
      directly into the shell script (`BRANCH="${{ github.ref_name }}"`) — a
      real GitHub Actions injection risk; moved it into `env: BRANCH:` and
      read `$BRANCH` at runtime instead. (2) Added `persist-credentials:
      false` to all 4 checkout steps across `ci.yml`/`draft-pr.yml` so the
      token isn't left in git config during later `pnpm install` script
      execution. (3) `git.ts`'s `ensureBranch()` silently continued past a
      failed `checkout -b`/fallback `checkout`, assuming any `-b` failure
      meant "branch already exists" — now throws with the real git stderr
      if either checkout actually fails, instead of proceeding on the wrong
      branch. (4) `git-api.ts`'s `fetchGitStatus()` didn't check
      `response.ok` before parsing, so a `{ error: ... }` failure response
      would overwrite the store with `undefined`s — now throws on non-OK,
      matching the pattern `commitChanges` already used in the same file.
      (5) `decisions.md`'s "Per-feature branch workflow" rationale said
      branch protection "isn't configured," contradicting the later
      decision that added it — reworded to say it gates merges, not pushes.
      (6) Merged a duplicate `## 2026-06-27` heading in `progress.md` into
      the section above it. Also caught and fixed the plan-level issue
      CodeRabbit flagged: this plan's `Status` was `done` instead of
      `review`, violating `AGENTS.md`'s own rule that only an explicit
      "Approve & close" sets `done` — reverted to `review`. Skipped
      CodeRabbit's suggestion to call `ensureBranch()` on every phase launch
      (not just `phaseIndex === 0`) — that contradicts this plan's own
      earlier scoping decision and needs a real discussion, not a drive-by
      fix. `tsc`/`biome`/`vitest` all clean (35 tests), all 4 workflow YAMLs
      re-parse clean.
- [x] Call `ensureBranch()` on every phase, not just phase 0
      Reopened the disagreement flagged in the phase above: after weighing
      it, decided CodeRabbit's edge case is real (a plan resumed mid-flight
      after someone manually switched branches would silently run on the
      wrong one) and the fix is free — `ensureBranch()` is already
      idempotent, a no-op when already on the right branch. Changed
      `agent.ts`'s `start()` from `if (phaseIndex === 0) { ensureBranch(plan)
      }` to an unconditional `ensureBranch(plan)` call before every phase
      launch. Supersedes the original "first phase only" scoping decision.
      `tsc`/`biome`/`vitest` all clean (35 tests).
- [x] Scope the npm package as `@dendelion/paper-camp`
      Confirmed `@dendelion` is a scope the user already has `read-write`
      access to (same one `@dendelion/paper-ui` publishes under), and
      `@dendelion/paper-camp` is unclaimed. Renamed `package.json`'s `name`
      to `@dendelion/paper-camp` — the `bin` field stays `{ "paper-camp":
      "./dist/cli/index.js" }` unchanged, so the installed CLI command name
      doesn't change even though the package identity does. Updated
      `.github/release-please-config.json`'s `package-name` to match.
      Scoped packages default to private on npm, so added `--access public`
      to `publish.yml`'s `npm publish` call — without it the first publish
      would have silently tried to create a private package and failed (or
      succeeded as private, which isn't what's wanted for an open-source
      CLI). Also added `persist-credentials: false` to `publish.yml`'s
      checkout for consistency with the hardening applied to the other
      workflows in phase 22. `tsc`/`biome`/`vitest`/`build` all clean (35
      tests), `pnpm-lock.yaml` doesn't need updating (it doesn't store the
      root package's own name).
- [x] Scope the Scout app token to least privilege
      CodeRabbit's re-review flagged that `draft-pr.yml`'s Scout installation
      token inherited the app's full installation permissions instead of a
      narrow grant. Added `permission-contents: read` and
      `permission-pull-requests: write` to the `create-github-app-token` step
      — the only two things this job actually does (`gh pr list`/`gh pr
      create`). `biome` clean.
- [x] Add `fetch-depth: 0` to `publish.yml`'s checkout
      `publish.yml` was the only workflow checkout missing `fetch-depth: 0`,
      diverging from the standard bootstrap every other workflow uses (CI's
      three jobs, draft-pr). Added for consistency — publish-time logic may
      want full git history/tags available.
- [x] Exclude `package.json` from Biome's formatter
      Every release-please PR that touched `package.json` was failing the
      Quality/Lint check: Biome's JSON formatter collapses short arrays onto
      one line, but release-please's own JSON writer always re-serializes
      arrays multi-line when it bumps `version`, so the two disagreed on
      every single release. Biome 1.9.4 doesn't yet support the
      `json.formatter.expand` option that would reconcile the two styles
      (that's a Biome 2.x feature) — excluding `package.json` from the
      formatter in `biome.json`'s `files.ignore` is the practical fix until
      an upgrade. Verified by pushing directly to the open release-please
      branch (`release-please--branches--main--components--paper-camp`),
      which then passed Quality/Lint.
- [x] Fix `draft-pr.yml` creating a duplicate PR after merge
      `gh pr list --head "$BRANCH"` defaults to `--state open`, so once a
      branch's PR merged, a later push to that same branch (e.g. a follow-up
      fix commit) found no "existing" PR and opened a duplicate (PR #3,
      opened after PR #1 had already merged). Added `--state all` to the
      existing-PR check. Verified live: re-pushed to the closed
      `feat/feat-22-github-ci-cd-automation` branch and confirmed the
      workflow logged "PR #3 already exists ... skipping" instead of
      creating a fourth PR.
- [x] Fix `publish.yml` never triggering after a release
      Noticed zero `publish.yml` runs ever, despite `v0.2.0` having been
      published. Root cause: `release.yml` ran `release-please-action` with
      the default `GITHUB_TOKEN`, and GitHub's anti-recursion guard blocks
      events triggered by `GITHUB_TOKEN` from starting new workflow runs —
      so the `release: types: [published]` event fired but was silently
      forbidden from triggering `publish.yml`. Switched `release.yml` to mint
      a Scout app installation token (`permission-contents: write`,
      `permission-pull-requests: write`) via `create-github-app-token`,
      passed as release-please-action's `token` input instead of
      `GITHUB_TOKEN` — same fix pattern already used for `draft-pr.yml`.
      YAML re-parses clean, `biome` clean.

### Log
- 2026-06-27: I want to have 3 steps in PR visible for each check - Quality, Tests and Consistency
- 2026-06-27: Phase 4 — Adopted per-feature branch workflow: documented branch-naming convention in AGENTS.md (`<kind>/<lowercase-id>-<kebab-title>`), added `.github/workflows/create-pr.yml` (auto-creates a draft PR on first push to any `feat/*`/`fix/*`/`refactor/*`/`chore/*`/`docs/*` branch, idempotent), updated `ci.yml` to also trigger on pushes to feature branches (not just `main`+PRs), and resolved the IDEA-4 impact question (agents write to whichever branch is checked out — no behavioral change needed, merge conflicts from two branches touching `plans.md` accepted until IDEA-20). `main` stays pushable for agent progress writes, tiny fixes, and config changes. All decisions recorded in `decisions.md`.
- 2026-06-27: Audit found two missing phases: (1) `ci.yml` has one job → PRs show one check, not three; split into Quality/Tests/Consistency jobs per log entry. (2) `release-please-config.json` still on `"default"` versioning so `refactor` doesn't trigger releases despite the phase-2 decision.
- 2026-06-27: Asked whether branch creation can be automated for "start a plan's first phase" since this is our own app, not a third party — we can wire it directly into the agent-launch code path. Also want a check on plan approval: if the plan has no branch yet, create one then, and commit with a proper `type(scope)` name whose body lists all the phase titles. Appended two phases for this (not implementing yet, just scoping them).
- 2026-06-27: Clarified the trigger is the first phase actually starting, not the plan merely reaching `in-progress` status with nothing started. Also want plan-switching blocked once a branch exists for an unfinished plan — show the user a message to finish the current feature first. Appended a phase for the block; not implementing yet.
- 2026-06-27: Also want the branch name shown in the commit section at the top of the Stack panel's card, so it's obvious which branch a commit is about to land on. Appended a phase for it.
- 2026-06-27: After seeing approval auto-commit in action, decided against it — only auto-create the branch (if missing); commit manually instead. Also asked whether the `feat/feat-22-...` double-prefix branch name is OK; confirmed it's the deliberate tradeoff from the original branch-naming decision (redundant but keeps the plan ID visually obvious in a plain `git branch` listing).
- 2026-06-27: Reported a real CI failure: `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` then "this version of pnpm requires at least Node.js v22.13". Root cause was `pnpm/action-setup@v4`'s unpinned `version: latest` resolving to pnpm 11 against workflows pinned to Node 20. Pinned pnpm via `package.json`'s `packageManager` field instead.
- 2026-06-27: Reported a second CI failure right after — `Cannot find module '@dendelion/paper-ui'` cascading across every file. Root cause was the `link:../paper-ui` dependency, which only resolves on the dev machine. Confirmed the deeper problem (this would break a real `npm install` too, since the package is already published to npm), and chose to publish the pending paper-ui work as `0.2.0` and switch paper-camp to depend on the registry version, with `pnpm link` documented for local co-development.
- 2026-06-27: Noticed duplicated CI jobs — once for `push`, once for `pull_request` — on the same feature-branch commit. Root cause was `ci.yml` triggering on both events for feature branches; fixed by dropping the feature-branch `push` trigger now that `draft-pr.yml` guarantees a PR exists from the first push onward.
- 2026-06-27: Asked about adding automated PR review beyond the local Claude-based `/code-review` skill, specifically a tool different from Claude to double-check code style/rule fit. Compared CodeRabbit, Greptile, Qodo Merge, Sourcery; picked CodeRabbit (free for public repos, lowest setup friction, low false-positive rate) over Greptile (pricier/noisier) and Qodo Merge (more configurable but self-hosted). Appended a phase; not implementing yet.
- 2026-06-27: Noticed draft PRs are authored by `github-actions[bot]` and wants a custom-named bot identity instead. Discussed GitHub App vs. dedicated bot account; went with a GitHub App. Named it **Scout** after rejecting "Ranger" and a few other camp-themed options (Sherpa, Lookout, Quartermaster, Trailblazer, Camp Scribe). User is creating the App now; appended a phase to wire it into `draft-pr.yml` once the App ID/private key are available.
- 2026-06-28: Asked to check CodeRabbit's review comments on the live PR and think through how PR review fits the plan-status methodology. Triaged 9 comments; fixed the clear-cut ones (injection risk, error-swallowing in `ensureBranch`, unchecked response in `fetchGitStatus`, persist-credentials hardening, a self-contradicting `decisions.md` paragraph, a duplicate `progress.md` heading), and separately fixed the `Status: done` → `review` mismatch CodeRabbit also caught. Recommendation: treat CodeRabbit's findings as a pre-approval checklist, not a `review`-status gate — `review` still just means "phases done," and skimming/triaging bot comments happens before clicking Approve & close, not before.
- 2026-06-28: Reopened the one disagreement with CodeRabbit — decided a "quick check we're on the right branch" before every phase is worth it, not just at phase 0. Reversed the earlier "first phase only" decision; appended a phase.
- 2026-06-28: Decided the npm package should be scoped, not bare `paper-camp`. Confirmed `@dendelion` (the scope `paper-ui` already publishes under) is available and accessible; scoped it as `@dendelion/paper-camp`.
- 2026-06-28: Checked CodeRabbit's remaining unresolved comments via the GraphQL review-threads API (most of the earlier 9 were stale — already fixed but not auto-resolved). Found and fixed two real ones (Scout token over-broad permissions, `publish.yml` missing `fetch-depth: 0`) and confirmed a third (`app-store.ts`'s `fetchGitStatus` handling) was already correct, just a stale comment predating an earlier fix.
- 2026-06-28: Reported a CI failure on the release-please PR branch — root cause was Biome's JSON formatter disagreeing with release-please's own array serialization on every release. Fixed by excluding `package.json` from Biome's formatter.
- 2026-06-28: Reported that Scout opened a second, duplicate PR for the same branch after PR #1 had already merged. Root cause was `gh pr list`'s default `--state open` filter going blind after a merge; fixed with `--state all`.
- 2026-06-28: Noticed the Publish job never ran anywhere despite a release existing. Root cause was `release.yml` creating the GitHub Release with the default `GITHUB_TOKEN`, which GitHub's anti-recursion guard blocks from triggering downstream workflows. Fixed by switching to a Scout app token, the same pattern already used for `draft-pr.yml`.
