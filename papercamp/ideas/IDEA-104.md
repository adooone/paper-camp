---
id: IDEA-104
title: Decisions and questions live on the idea
type: feat
status: idea
created: 2026-07-29
updated: 2026-07-29
tags:
  - app
  - core
  - plans
subject: Simplicity pass
---

`decisions.md` and `open-questions.md` are global corpora nobody reviews — and decisions aren't even fed to agents despite the idea claiming so. Their only real value is a decision or question *attached to the idea it bounds*.

Fold both onto the entity: a decision or question about a feature is a lightweight note on that idea (reuse the existing notes/clarifications machinery), shown and closed where it binds. Retire the global files, the decision search, the `blocked-plan-active`/`dangling-*` consistency checks, and the separate capture modals. Cross-cutting project rules already live in `AGENTS.md`/`docs/CODE_STYLE.md` — keep them there, not in a growing list.

Also clears the confusing entity UI this created: "Graduate this into an open question that outlives this entity", the Clarifications-vs-Open-questions split, "Promote straight into a decision". Supersedes the browse/search half of [[IDEA-96]] and [[IDEA-97]].
