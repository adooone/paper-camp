---
id: IDEA-62
title: AI-suggested idea drafts
type: feat
created: 2026-07-13
tags:
  - app
  - ideas
  - agent
---

Agents often surface "you might want to do X" while working, but there's nowhere to park those hunches short of creating a real idea file — which pollutes the corpus with unrefined, unowned entries. Add a lightweight staging area: a suggestions store agents can append to anytime, shown as its own section in the UI, where a suggestion only becomes a real idea when the user promotes it.

- **A suggestions store outside the idea corpus.** A new monolithic `papercamp/suggestions.md` (sibling to `decisions.md`/`open-questions.md`/`progress.md`, parsed by `core/parser`), holding one lightweight entry per line — a title plus a one-line description, no `id`, no `status`, not in `ideas/index.md`. It never counts as a plan/idea and is never promoted automatically; it's a holding pen.
- **Agents append to it, on trigger or ambiently.** A dated append-only grammar agents write into (like [[IDEA-43]]'s `### Log` grammar), plus a manual "Suggest ideas" action that launches an agent to scan the repo and the existing corpus and propose new entries — reusing the `prompts.ts` builder + agent-launch plumbing. Complements [[IDEA-36]] (a scheduled agent could append here) and [[IDEA-44]] (the overlap check already reasons over the idea corpus, so it can flag genuinely-new intentions as suggestions).
- **A "Suggested from AI" section under the list.** Below the worklist, render suggestions as plain cards that match idea rows visually but drop the id stamp and status — just a title. Backed by a new `/api/suggestions` read + a store slice.
- **Click → modal → "Move to ideas".** Clicking a card opens a small modal with the description and a **Move to ideas** button. That launches a refining agent (a new `prompts.ts` builder, sibling to the draft/extend prompts in [[IDEA-15]]) which expands the one-liner into a full idea: assigns an id via `assignEntityId`, writes `papercamp/ideas/IDEA-N.md`, regenerates the index, and removes the promoted line from `suggestions.md`. Dismissing a card just deletes its line.

The whole point is that suggestions stay cheap and disposable — no id allocation, no index churn, no status lifecycle — until a human decides one is worth the refinement pass that turns it into a real, owned idea.
