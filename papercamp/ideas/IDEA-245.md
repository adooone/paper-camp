---
id: IDEA-245
title: A plan commit is not main activity
type: fix
kind: fix
status: idea
idea: IDEA-116
created: 2026-09-08
tags:
  - core
subject: The format as the product
order: 13
---

IDEA-243 read as in progress on 2026-09-08 with no branch, no PR, no
checked phase, and no agent running. `deriveStatus` in `status.ts` has a
rule for trunk-style work: with no PR, an idea whose id appears in a commit
on the default branch is in progress. The commit it matched was the plan
draft itself — `docs(ideas): Auto-fix before the fix agent — plan` — which
the app commits to `main` the moment a plan is drafted. Every idea drafted
on `main` therefore shows in progress before any phase has run, and the
label the rule was meant to give real trunk work now means nothing.

**Corpus-only commits do not count.** `resolveIdsWithMainActivity` in
`git-log.ts` reads each commit's file list alongside its message
(`--name-only`) and ignores a commit whose every path starts with
`papercamp/`. Plan drafts, archive moves, thread notes, and fix spawns are
all corpus writes; a commit that touches anything outside the corpus is
work. The rule in `deriveStatus` is unchanged; only its input is.

### Phases
- [ ] Ignore corpus-only commits when resolving main activity
      Read `--name-only` with the message in `resolveIdsWithMainActivity` and skip commits whose paths all fall under `papercamp/`, with a test for a plan-draft commit and one for a mixed commit.
