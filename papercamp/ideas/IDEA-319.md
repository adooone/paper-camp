---
id: IDEA-319
title: Git that heals itself from the app
type: fix
status: idea
created: 2026-10-28
updated: 2026-10-29
tags:
  - git
  - app
  - stack
subject: Run & monitor
---

On 2026-10-28 `paper-camp-mobile` stopped pulling and pushing. Local `main`
and `origin/main` had drifted apart, 7 commits against 23, and four rebases
in one evening were each aborted. The way out was a terminal session. The
app should handle this case itself.

What went wrong, in order:

1. **Two machines committed to one `main` and never met.** The laptop
   pushed 23 commits over two days, among them the `paper-camp pair` code
   pairing (`d570eb8`). The daemon on the devbox ran IDEA-2 phases on its
   two-day-old `main` without fetching first. One phase built code pairing a
   second time (`28eda4b`) in the same two files, `PairScreen.tsx` and
   `machines.ts`. That duplicate was the only conflict in real code.
2. **Every run commits bookkeeping.** Capacity snapshots, run stats and
   chat thread lines each landed as their own commit on `main`: six of the
   seven local commits. Each one touched `IDEA-2.md` or `capacity.json`,
   so every one of them had to be replayed and could conflict.
3. **`capacity.json` is tracked, and the daemon keeps rewriting it.** A
   probe writes it every few minutes. During the repair it rewrote the file
   mid-way, and `git rebase` refused to start with *You have unstaged
   changes*. `reconcileOnto` treats that as a non-conflict error and gives
   up. The user sees a sync that fails for no visible reason.
4. **`resolve-conflict` reported done when nothing was resolved.** The
   reflog shows the agent's rebase reached `rebase --continue` twice and
   then ran `rebase --abort`. `tasks.log` still records `outcome: done`, so
   the app showed success while the branch was still split.
5. **The idea chat can't touch git.** When asked *can you pull and push
   codebase?*, the IDEA-2 chat answered that it had no git access and the
   user should use a terminal.

**Fetch before every run.** Before a phase, fix or run-all starts, the
daemon fetches and fast-forwards. If the branch has diverged, it reconciles
first (see below) or refuses to start and explains why. No agent should
build on a base that is days behind.

**Bookkeeping never blocks a sync.** Two parts:
- **Untrack volatile files.** Machine-local state, `capacity.json` first,
  moves out of git for good. IDEA-320 covers the layout and the migration
  across all projects.
- **Bundle the rest.** Run stats and chat lines are written to the idea
  file and committed together with the run's own commit, or batched into
  one bookkeeping commit per run, never one commit per write.

**`reconcileOnto` resolves Paper Camp files on its own.** Conflicts under
`papercamp/` follow known rules, so they need no agent:
- Frontmatter keeps the most advanced `status` and the newest `updated`.
- Phase checkboxes are OR'd: a box ticked on either side stays ticked.
- `run:` lines and `### Thread` entries are unioned.
- Append-only logs keep both sides' entries.

Dirty files under `papercamp/` are autostashed around the rebase. Only a
conflict in code goes to the agent.

**A duplicate commit is spotted, not merged.** When a local commit's
changes to code are already contained in upstream (the same files, and
upstream's version is a superset by intent), the agent prompt says so and
the agent is allowed to drop that commit's code changes, keeping only its
bookkeeping. Before any rewrite, a `backup/<branch>-<date>` ref is made so
the drop can be undone.

**Success means the repo state, not the agent's word.** After
`resolve-conflict` exits, the daemon checks that no rebase is in progress,
the tree is clean apart from ignored files, and the branch is ahead of or
level with upstream. Only then does the task record `done`, and it pushes.
Otherwise it records `error` with what is still wrong, and the git card
keeps offering the fix.

**Chat can ask for a sync.** A message such as *pull and push* in any idea
chat or the project chat routes to the same sync and fix-divergence actions
the git card has. It runs with the same confirmation, instead of the chat
saying it can't.

Out of scope: multi-branch workflows and PR-based flows. This idea covers
the single shared `main` that Paper Camp projects use today.

Done when the 2026-10-28 situation can be fixed from the app alone. The
test setup is two clones that both commit to `main`, a duplicate feature
commit in the same files, a daemon rewriting `capacity.json` during the
sync, and `IDEA-*.md` edited on both sides. One tap on the git card (or a
chat message) ends with both clones level with `origin/main`, the
duplicate dropped, and both sides' idea notes kept. A `resolve-conflict`
run that aborts records `error`, not `done`.

### Phases
- [x] Fetch before every run
      Fetch and fast-forward (or refuse with a reason) before phase, fix and run-all tasks. Untracking volatile state is IDEA-320.
      run: 6m30s · 146 in · 31k out · sonnet-5 · sess:17b087bd-5cbb-448d-a000-8b479c6e0503
- [x] One bookkeeping commit per run
      Run stats, capacity and thread lines ride the run's own commit or a single per-run bookkeeping commit.
      run: 7m21s · 102 in · 42.3k out · sonnet-5 · sess:17b087bd-5cbb-448d-a000-8b479c6e0503
- [ ] Rule-based merge for `papercamp/` files inside `reconcileOnto`
      Autostash dirty `papercamp/` files; resolve frontmatter, phase checkboxes, `run:` lines, thread entries and logs by rule; hand only code conflicts to the agent.
- [ ] Verified `resolve-conflict` outcome with backup ref and push
      Create a backup ref first, let the prompt drop code already contained upstream, check repo state after the agent exits, then record done and push, or error with the reason.
- [ ] Sync and fix-divergence from chat
      Route git requests in idea and project chat to the git card's actions, with the same confirmation.
