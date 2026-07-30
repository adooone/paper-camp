---
id: IDEA-109
title: Compact Deliver section, more room for the agent stack
type: feat
status: review
created: 2026-07-30
updated: 2026-07-30
tags:
  - app
  - ui
  - stack
subject: App UI
---

The Stack's Commit section grows with the file list and carries a message box that's never used, crowding out the agent stack. Rework it into a compact, fixed-height **Deliver** card:

- Rename the section "Commit" → "Deliver".
- Merge the separate Status card in: the check stamps (Quality/Tests/Consistency/Docs) sit at the top of the card.
- Drop the file list. Show just "N files changed" as a link to the diffs view ([[IDEA-110]]); until that exists, the count alone.
- Drop the commit message body — keep the title input and the commit action.

Result: a small, fixed-height card, so the freed vertical space goes to the **Agent stack**, which should render more than its current cap of 3 items. Touches `stack-panel.tsx`, `status-section.tsx`, `commit-section.tsx`, `agent-section.tsx`. (Push stays a separate manual action, unchanged.)

### Phases
- [x] Rename Commit to Deliver and fold in the check stamps
      In `commit-section.tsx`, retitle the section "Deliver" and move the Quality/Tests/Consistency/Docs stamps from `status-section.tsx` to the top of the card; retire the standalone Status card in `stack-panel.tsx`.
- [x] Replace the file list with an "N files changed" count
      Drop the per-file list; render just the changed-file count. Link it to the future diffs view ([[IDEA-110]]) when present, otherwise show the count as plain text.
- [x] Drop the commit message body, keep the title input
      Remove the unused message textarea; keep the title input and the commit action wired as-is.
- [x] Give the freed space to the agent stack
      In `agent-section.tsx`, raise the 3-item render cap so more agent-stack items show, and ensure the compact fixed-height Deliver card lets that space flow to the stack.
- [x] Type-check and full pass
