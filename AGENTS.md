# Agent instructions for paper-camp

This file is the source of truth for how AI assistants should work in this repository.

## Do one phase at a time

When a user asks you to work on a plan (each entity — an *idea* with its plan as a `### Phases` section — is its own file at `papercamp/ideas/<ID>.md`), complete **only the phase they explicitly asked for** unless they tell you otherwise. Do not automatically continue into later phases.

If the boundary between phases is unclear, or if you are unsure whether the user wants the next phase done, ask before continuing.

## Update the plan as you go

Mark the completed phase `[x]` in the entity's file (`papercamp/ideas/<ID>.md`) and keep its `status:` frontmatter field honest (`in-progress` / `review` / `done`).

When all phases of a plan are complete, set its `Status` to `review` — not `done`. The `review` status means a human (or a later agent) needs to approve the work before it's closed. Plans that reach `done` should only get there via an explicit "Approve & close" action, never because the last phase was checked off automatically.

## UI code style and UX principles

For `src/app` code, also follow `docs/CODE_STYLE.md` (how the code is written) and
`docs/UX_PRINCIPLES.md` (how the UI should feel to use — layout stability, visual
hierarchy, motion). Read both before making UI changes.

## Working with the paper-ui sibling repo

The dashboard is built on `@dendelion/paper-ui`, which lives in a sibling repo at
`~/dev/paper-ui` and is published to npm. `package.json` declares it as a
normal registry range (`"@dendelion/paper-ui": "^0.2.0"`) — this is required
for CI and for anyone installing `paper-camp` for real; a `link:../paper-ui`
relative path only resolves on this dev machine and breaks everywhere else
(this is exactly the bug that broke the CI quality check and would have
broken `npm publish` too).

- **For active co-development with paper-ui**, override the registry
  resolution locally without touching `package.json`: run
  `pnpm link ../paper-ui` from `paper-camp`'s root once. This symlinks
  `node_modules/@dendelion/paper-ui` to the sibling repo for your local
  checkout only — it's invisible to git, CI, and anyone else's install. Run
  `pnpm install` (no args) to go back to the registry-resolved version.
- **paper-camp imports from `dist/`, not `src/`** either way. paper-ui's
  `package.json` points `main`/`module`/`types` at `dist/index.{js,mjs,d.ts}`.
  If you edit anything under `~/dev/paper-ui/src` while linked, it has **no
  effect** in paper-camp until you run `pnpm run build` inside `~/dev/paper-ui`.
- **Publishing a new paper-ui version:** in `~/dev/paper-ui`, write a
  changeset (`.changeset/*.md`, sized correctly — new components/exports are
  `minor`, behavior-preserving fixes are `patch`), run `pnpm run version`
  (needs a `GITHUB_TOKEN` env var for the changelog generator — `gh auth
  token` works), verify with `pnpm run check-types && pnpm run build`, commit,
  then `pnpm publish --access public`. Bump paper-camp's `package.json` range
  afterward and `pnpm install`.
- **Check the real source, not just the `.d.ts`.** Before assuming what a
  paper-ui prop does, read the component under `~/dev/paper-ui/src/components/`
  (and its showcase entry under `~/dev/paper-ui/src/showcase/`) rather than
  guessing from the type signature alone.
- **When changing paper-ui itself,** follow `~/dev/paper-ui/AGENTS.md`/
  `CODE_STYLE.md` (one component per file, `cn()` for classNames, SCSS modules
  for styles — no hardcoded hex in `.tsx`), then run `pnpm run check-types` and
  `pnpm run build` there before switching back to paper-camp.
- **Adding to paper-ui's public API** (new component, new exported prop) means
  updating both `src/components/<name>/index.ts` *and* the top-level
  `src/index.ts` barrel — both re-export the public types, and it's easy to
  update one and forget the other.

## Verifying UI changes visually

Use the Claude in Chrome MCP tools (`mcp__Claude_in_Chrome__*`) to actually look
at a UI change before reporting it done, not just `tsc`/lint.

- **Check for an already-running dev server first** — `lsof -i :3333` (or
  `pgrep -af vite.app.config`). This repo is usually already running under
  `pnpm dev` in another session. Don't start a second instance; if port 3333 is
  taken, your new one will silently bind 3334 and nothing will be reachable
  through it.
- **`localhost`/`127.0.0.1` will not load in the browser the MCP tools drive** —
  that browser runs on the user's machine, not in this sandbox, so loopback
  addresses point nowhere useful. Use the box's Tailscale hostname instead:
  `http://deimos:3333/` (check `pnpm dev`'s own "Network:" log lines if the
  hostname ever changes). A direct `navigate` to a sub-route (e.g. `/plans`)
  can hit a SPA-routing error page on first load — navigate to `/` first, then
  click through the app's own nav.
- After navigating, `browser_batch` a `screenshot` and actually look at it; check
  `read_console_messages` for thrown errors before calling a change verified.

## Branch workflow

Work on a plan (feature, fix, refactor, etc.) happens on a feature branch, not
directly on `main`. A draft PR is auto-created on first push.

- **Branch naming:** `<type>/<lowercase-id>-<kebab-title>`
  - `type` is one of: `feat`, `fix`, `refactor`, `chore`, `docs` (the entity's
    `type` frontmatter field, matching commitlint's `type-enum`; entities
    without a type yet default to `feat`)
  - `id` is the lowercase lifetime entity id (e.g., `idea-43`) — it never
    changes, even when the entity's type does
  - Title is the entity's short title in kebab-case
  - Example: `feat/idea-43-unify-the-ideas-and-plans-worklist`
  - Pre-migration branches keep their legacy `feat/feat-22-…` names; only new
    branches use entity ids

- **When to create a branch:** Before starting any plan's first phase. The
  branch lives for the plan's entire lifecycle — from `in-progress` through
  `review`.

- **PRs:** A `.github/workflows/draft-pr.yml` workflow auto-creates a **draft**
  PR on the first push to any feature branch. The PR stays draft until human
  review is ready. CI runs on the PR via the existing `ci.yml`. The PR is
  authored by the **Scout** GitHub App (`scout[bot]`), not
  `github-actions[bot]` — `draft-pr.yml` mints a short-lived installation
  token via `actions/create-github-app-token`, using the `SCOUT_APP_ID`/
  `SCOUT_PRIVATE_KEY` repo secrets.

- **`main` stays pushable.** Direct pushes to `main` are allowed but
  *conventionally* reserved for:
  - Agent writes to `papercamp/ideas/` and `papercamp/progress.md` during phase execution
    (these are the only agent writes that land directly on `main`)
  - Tiny fixes and config changes
  - Merging feature branch PRs

  All substantive plan work should use a branch and merge via PR.

- **Agents and branches:** When an agent executes a plan phase, it works on
  whatever branch is currently checked out. If the agent was started from a
  branch (e.g. via the Stack panel while that branch is active), its writes to
  the entity's file under `papercamp/ideas/` and to `papercamp/progress.md` land on that
  branch. When the PR merges, those changes come along with the rest of the
  branch. Per-file entity storage means two branches working different
  plans touch different files and no longer conflict on merge; `papercamp/progress.md`
  remains a shared append-only log, so concurrent appends there can still
  conflict.

- **Naming enforcement:** The branch naming convention is not enforced by CI
  (no branch-name lint). It is a convention agents are expected to follow,
  enforced by code review.

## Commit messages

Format: `<type>(<scope>): <description>`

- `type` is one of `feat`, `fix`, `chore`, `docs`, `refactor` (commitlint's
  `type-enum`, matches plan `Kind`).
- `scope` is a **subsystem area**, not the plan number — chosen from the fixed
  list in `.commitlintrc.json`'s `scope-enum`: `core`, `cli`, `app`, `server`,
  `agent`, `plans`, `ideas`, `docs`, `settings`, `stack`, `ui`, `ci`, `config`,
  `deps`, `repo` (plus `release`/`main` for the release bot). Pick the area the
  change most affects — usually the plan's primary tag. This keeps the release
  changelog readable (`* **ci:** Add CI workflow`) instead of a context-free
  list of numbers. Adding a new area means editing the `scope-enum`.
- **Plan traceability lives in a footer, not the scope.** Add a `Refs:` trailer
  with the entity ID for any commit tied to a plan (the branch name already
  encodes it too):

  ```
  feat(ci): Add CI workflow for tests and lint

  Refs: IDEA-43
  ```

- `description` follows this repo's existing style: capitalized, like a
  changelog entry (e.g. `feat(ci): Add CI workflow for tests and lint`), not
  the lowercase imperative style some Conventional Commits guides use.
- Enforced by `.commitlintrc.json` + the `consistency` CI check: scope is
  required (`scope-empty`) and must be a known area (`scope-enum`), and
  `subject-case` is disabled so the capitalized style stays valid.
