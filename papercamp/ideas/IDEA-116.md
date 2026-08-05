---
id: IDEA-116
title: Direct-to-main work can never reach review/done in derived status
type: feat
status: idea
created: 2026-08-04
tags:
  - app
  - status
subject: Planning surface
---

Status derivation combines the idea file with GitHub state (branch / PR), so work committed straight to main — no branch, no PR — leaves an idea stuck at planned/in-progress forever, even with every phase checked. Hit in the func-ui repo: a fully-built idea showed no status movement on the board, and the only way out was hand-editing frontmatter and moving the file to archive/.

Direct-to-main is a legitimate mode for solo/rapid projects; the tool should support completing an idea without a PR. Options, not mutually exclusive:

- Respect explicit frontmatter status (`review`/`done`) when no branch/PR signal exists, instead of overriding it.
- A "mark done" action in the dashboard that sets status and performs the archive move.
- Optionally derive progress from main-branch commits that reference the idea id in their messages.

### Phases
- [ ] Respect a stored review/done when no branch or PR signal exists
      In `deriveStatus`, when there's no entity branch and no merged PR, honor an explicit frontmatter `review`/`done` instead of pinning the entity at planned/in-progress.
- [ ] Add a "Mark done" dashboard action for PR-less completion
      A control that sets `status: done` and runs the existing archive move, so a fully-built direct-to-main idea can be closed without ever cutting a branch or opening a PR.
- [ ] Derive progress from main-branch commits referencing the idea id
      Scan `main`'s commit messages for the `IDEA-N` id and let that advance derivation, so work landed straight on main registers without a branch.
- [ ] Type-check and test the new derivation and action paths
      `tsc` and `biome` clean; cover the no-git-signal override, the mark-done archive flow, and the commit-scan path.

### Log
- 2026-08-04 — Filed from func-ui after IDEA-1 there had to be completed by hand-editing files.
