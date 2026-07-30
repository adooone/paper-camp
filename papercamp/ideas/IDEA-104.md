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

### Phases
- [x] Model decisions and questions as notes on the idea entity
      Reuse the existing notes/clarifications machinery so a decision or question is a lightweight note bound to its idea, shown and closed there.
- [x] Migrate existing `decisions.md`/`open-questions.md` content onto their ideas
      Fold each entry onto the idea it bounds; drop cross-cutting rules that already live in `AGENTS.md`/`docs/CODE_STYLE.md`.
- [x] Retire the global files, decision search, and consistency checks
      Remove `decisions.md`/`open-questions.md`, the decision search, and the `blocked-plan-active`/`dangling-*` consistency checks that relied on them.
- [ ] Remove the separate capture modals
      Delete the standalone decision/question capture modals now that notes carry them inline.
- [ ] Simplify the entity UI
      Drop "Graduate this into an open question", the Clarifications-vs-Open-questions split, and "Promote straight into a decision".
- [ ] Type-check and full pass
