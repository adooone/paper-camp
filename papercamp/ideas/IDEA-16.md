---
id: IDEA-16
title: Ideas UX improvement
---

## IDEA-16: Ideas UX improvement

A grab-bag of UX fixes for the Ideas/Stack flow, flagged from actually using the app rather than from a single feature gap.

- **Hide completed ideas from the sidebar.** The sidebar currently lists every `IdeaEntry` regardless of status; once an idea has a linked plan that's `done`, it should drop out of the default list rather than sitting alongside the still-open ones.
- **Simpler idea-creation form.** Replace however ideas get created today with a plain form: `title` + `body`, nothing else — matching the minimal shape `ideas.md` entries actually need to start.
- **"Extend with AI" button on an idea.** Inside an open idea, a button that launches an agent task to explore the current codebase/features and rewrite the idea's body into something more specific (concrete approaches, file references) based on the user's original input — same agent-task machinery [[IDEA-4]]/[[IDEA-15]] already use, just scoped to rewriting one idea's prose instead of drafting a plan or executing a phase.
- **Visual feedback is missing across the board.** Several recently-shipped features (buttons, agent actions) give no indication anything happened — no loading state, no success/failure confirmation. Every user-triggered action needs visible feedback for its in-flight and completed states, not just a correct end result; this is a recurring gap to watch for in future phases, not a one-off fix.
- **Agent section in Stack should show all agent activity, not just the active plan's phase.** Today "Agent" in the Stack panel only reflects [[IDEA-4]]'s one-task-at-a-time phase execution. It should surface agent work more broadly — including tasks like [[IDEA-15]]'s plan-drafting or this idea's "Extend with AI" — not just plan-phase runs, and the underlying one-task-at-a-time constraint ([[IDEA-4]]'s "one active task at a time for v1" decision) is worth revisiting once more than one kind of agent task exists.
- **Cap the Ideas board's Done column at 4 visible rows.** Show only the 4 most-recently-done ideas; a 5th row reads "[N more ideas]" as a link instead of a card, where `N` is the remaining done count. Clicking it navigates to a separate done-ideas list view showing the full set.
