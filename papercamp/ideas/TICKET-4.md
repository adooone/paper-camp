---
id: TICKET-4
title: GitHub import and scaffold-by-PR
type: feat
kind: ticket
idea: IDEA-195
status: idea
created: 2026-08-21
tags:
  - github
  - scaffold
  - plan-only
subject: Multi-project
---

What makes plan-only real — a sequencing step on [[IDEA-195]].

### Phases
- [ ] Read a repo's corpus over the GitHub API
      Parse `papercamp/ideas/` through the Contents API so the client reads and renders a project with no runtime dialled.
- [ ] Detect whether paper-camp is already installed
      Probe for `papercamp/config.json` to choose between importing an existing corpus and scaffolding a fresh one.
- [ ] Scaffold paper-camp into a repo by PR
      Commit the init contents — docs, config, empty corpus — to a branch and open a PR, needing no AI and no local install.
- [ ] Import a repo as a plan-only project
      Add the runtime-less registry entry a GitHub import produces, deferring registry semantics to [[IDEA-117]].
- [ ] Write corpus edits back through GitHub
      Create ideas, order the queue and record reviews as commits, so the whole planning half works with no runtime.
