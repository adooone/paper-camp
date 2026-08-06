---
id: IDEA-118
title: Parked-decisions inbox — every agent question awaiting a human, one queue
type: feat
status: done
created: 2026-08-04
updated: 2026-08-06
tags:
  - multi-project
  - agents
  - app
subject: Multi-project
---

Agents park on thread questions ("open the PR or will you handle release?" — IDEA-115 did exactly this) and those threads are only discovered by visiting the right idea at the right time. A dedicated inbox view lists every unresolved agent question / decision request across the corpus, ordered by age, each resolvable inline.

Valuable single-project; becomes the flagship screen of the multi-project hub ([[IDEA-117]]) where it aggregates across corpora. It's the pull-based complement of Horizon 2's **Notifications** bullet — the push tells you something parked, the inbox is where parked things wait.

### Phases
- [x] Collect open agent questions across the corpus
      Add a core reader that scans every entity's thread for `kind: 'question'` / `state: 'open'` items, returning each with its owning idea and age.
- [x] Serve the queue over the API
      Expose a read route that returns the parked questions oldest-first, each carrying enough context (idea id/title, parked phase, question text) to resolve without opening the idea.
- [x] Build the inbox view
      A route listing every parked question as an age-ordered queue, with an empty state when nothing is waiting.
- [x] Resolve inline, reusing the resume flow
      Answer or dismiss a question from the inbox through the existing feedback-message path so the parked run resumes on reply.
- [x] Surface the unresolved count in the nav
      Badge the inbox nav entry with the number of open questions so parked work is visible without opening the screen.
- [x] Test the reader and resolve path
      Cover the cross-entity collection, oldest-first ordering, and that resolving from the inbox flips the question and triggers resume.

### Thread
- [x] 2026-08-06 [decision] Inbox rows render one line per question — idea ID stamp + question text + age, thin separators, no cards or chat bubbles. Clicking a row expands it in place with its context messages and the reply composer, one row at a time; the ID stamp opens the idea. This view replaces the Plans page's Open questions block, which [[IDEA-134]] removes.
