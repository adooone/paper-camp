---
id: IDEA-320
title: One home for local state
type: refactor
status: idea
idea: IDEA-319
created: 2026-10-28
tags:
  - stack
  - git
  - multi-project
subject: Multi-project
---

The daemon writes about a dozen files into `papercamp/` next to the plan.
Some are the plan (shared, committed). Others belong to one machine: logs,
caches, a pairing secret, a usage gauge. Today the only thing keeping them
out of git is `DAEMON_GITIGNORE_ENTRIES` in `src/core/scaffold/scaffold.ts`,
a hand-written list that has three problems:

- **It's applied only by `paper-camp init`.** A file added to Paper Camp
  later is never ignored in projects that already exist. `capacity.json`
  was never on the list.
- **It never untracks anything.** A file committed before it joined the
  list stays tracked forever.
- **It edits the project's own `.gitignore`.** The lines land wherever the
  last `papercamp/` line happened to be.

The seven projects on this machine, on 2026-10-28:

| Project | Committed but should be local | Other drift |
| --- | --- | --- |
| radio | `.pairing.json`, `run-order.md` | public repo, so the dev-server token is on GitHub |
| func-ui | `run-order.md` | |
| paper-camp-mobile | `capacity.json` until today | |
| paper-camp | | `chat.md` ignored here, committed in radio, folk-ui and mobile |
| folk-ui, sbjectv.shop, fo.band | | |

`capacity.json` caused the stuck rebase in IDEA-319. It also sits in the
wrong place: it holds the account's five-hour and weekly limits, which are
the same for every project. Only paper-camp-mobile has the file at all,
because that is where the last probe happened to run.

**Three homes, decided by who owns the file.**

| Home | What lives there | In git |
| --- | --- | --- |
| `papercamp/` | the plan: `ideas/`, `config.json`, `suggestions.md`, `chat.md`, `about.md`, `assets/` | yes |
| `papercamp/.local/` | this checkout's state: `tasks.log`, `notifications.log`, `task-logs/`, `pr-map.json`, `pr-reviews.json`, `night.json`, `run-order.md`, `pairing.json` (dev server) | never |
| `~/.config/paper-camp/` | this machine and account: `projects.json`, `pairing.json`, `daemon.json`, and now `capacity.json` | not a repo |

**`papercamp/.local/` ignores itself.** Paper Camp creates
`papercamp/.local/.gitignore` containing `*`. Nothing in that folder can be
committed, whatever the project's root `.gitignore` says. A new state file
in a future version only has to be written under `.local/` to be safe. No
list is kept anywhere and nobody edits the project's `.gitignore`. Git
also skips the folder in `status`, so it can never make the tree dirty.

**One path helper.** `campFile(root, name)` splits into `planFile` and
`localFile`, plus `machineFile` for the config dir. A test fails if any
write under `papercamp/` goes through `planFile` for a name outside the plan
list. That stops the next `capacity.json` at review time.

**Shared files that churn merge without conflicts.** `chat.md` is part of
the plan, so it stays committed everywhere, which settles the drift in
paper-camp. Paper Camp writes a managed block into the project's
`.gitattributes` with `papercamp/chat.md merge=union`. Both sides' lines
are then kept on pull, with no conflict to resolve. Idea files keep the
rule-based merge from IDEA-319.

**Migration runs on its own.** The first time the upgraded daemon mounts a
project, it does four things:
1. Moves the local files into `.local/`.
2. Removes the old ones from the index (`git rm --cached`), leaving the
   files on disk.
3. Drops the old `DAEMON_GITIGNORE_ENTRIES` lines from `.gitignore` and
   writes the `.gitattributes` block.
4. Makes one commit, `chore(papercamp): Move local state to papercamp/.local`.

`capacity.json` moves to the config dir. If more than one project has a
copy, the newest `capturedAt` wins. A project mid-rebase or with staged
changes is skipped and retried on the next mount.

**A committed secret gets rotated.** If the migration finds `.pairing.json`
in git history, it mints a new token and reports it on the git card. On
GitHub, the old token stays readable in history.

**Every project stays checked.** `paper-camp doctor`, plus a row on each
project's git card, reports:
- any tracked file outside the plan list,
- a missing `.local/.gitignore`,
- a missing `.gitattributes` block.

Each has a one-tap fix that runs the migration again. The projects page
shows a count across all mounted projects, so drift is visible without
opening each one.

Out of scope: moving state outside the checkout (for example to
`~/.local/state`). Keeping `.local/` per checkout lets two worktrees of one
project hold separate logs and run orders, and the files stay easy to find.

Done when all seven projects track nothing under `papercamp/` beyond the
plan list. Also: a fresh `paper-camp init`, an upgrade and a doctor run
leave the same layout; the daemon writing capacity, logs and run order
leaves `git status` clean; radio's committed token is rotated; and two
clones appending to `chat.md` pull without a conflict.

### Phases
- [ ] Path helpers and the self-ignoring `.local/` folder
      Split `campFile` into plan, local and machine helpers, move every daemon write onto them, create `papercamp/.local/.gitignore`, move `capacity.json` to the config dir, and add the test that rejects plan writes outside the plan list.
- [ ] Migration on mount
      Move files, untrack them, clean the old `.gitignore` lines, write the `.gitattributes` union block, commit once, skip projects that are mid-rebase or have staged changes, and rotate a committed pairing token.
- [ ] Doctor and drift on the git card
      `paper-camp doctor` checks and fixes the layout; each git card shows drift with a fix, and the projects page shows the total.
