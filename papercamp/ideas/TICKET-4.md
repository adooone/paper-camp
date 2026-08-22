---
id: TICKET-4
title: GitHub import and scaffold-by-PR
type: feat
kind: ticket
status: idea
idea: IDEA-195
created: 2026-08-21
tags:
  - github
  - scaffold
  - plan-only
subject: Multi-project
---

What makes plan-only real — a sequencing step on [[IDEA-195]].

Reading and writing a corpus over the GitHub API already shipped with [[IDEA-193]] (PR #184): `src/app/services/github/client.ts` does the Contents API calls and `corpus.ts` parses, creates and saves entities. What is missing is everything that gets a repo *into* that state — recognising whether paper-camp is installed, installing it if not, and registering the result as a project.

### Phases
- [ ] Detect whether paper-camp is already installed
      Probe for `papercamp/config.json` to choose between importing an existing corpus and scaffolding a fresh one.
- [ ] Scaffold paper-camp into a repo by PR
      Commit the init contents — docs, config, empty corpus — to a branch and open a PR, needing no AI and no local install.
- [ ] Import a repo as a plan-only project
      Add the runtime-less registry entry a GitHub import produces, deferring registry semantics to [[IDEA-117]].

### Thread
- [x] 2026-08-21 [log] [agent] Run order: Sixth named sequencing step, the one that makes plan-only real, needed before IDEA-117's plan-only fallback is meaningful at scale
