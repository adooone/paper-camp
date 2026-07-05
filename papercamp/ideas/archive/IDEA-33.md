---
id: IDEA-33
title: Adopt paper-ui 0.5.0 components
type: feat
status: done
created: 2026-07-03
updated: 2026-07-03
tags:
  - app
  - ui
---

Adopted paper-ui 0.5.0 components: Toast surfacing action failures (the headline), plus Spinner, Skeleton, Tooltip, CopyButton, and Divider replacing hand-rolled code.

### Phases
- [x] Wire Toast and surface action failures
      Mount `ToastProvider` at the app root and call `useToast` from every `useActionFeedback` consumer's `run()` path so `errorMessage` finally renders — the Draft/Extend buttons (and the other action callers) currently swallow failures silently. Exercise a failing action end-to-end to confirm the toast actually appears. Highest-value swap; ship it first.
- [x] Swap the custom loaders for Spinner and Skeleton
      Replace the hand-rolled `.spinner` class with paper-ui Spinner (`utilities.css`, `plan-detail.tsx`) and `PlanCardSkeleton` with Skeleton (`plan-card-skeleton.tsx`, `list-view.tsx`), deleting the custom CSS and component once nothing references them.
- [x] Replace title attributes with Tooltip
      Convert the ~15 `title=` tooltip attributes (view-toggle, plan-detail, the draft/extend/clarify/audit buttons, …) to the Tooltip component. Sweep for stragglers with a grep for `title=` on interactive elements before closing the phase.
- [x] Adopt CopyButton and Divider
      Replace `components/copy-prompt-button.tsx` with CopyButton, and the hand-rolled `borderBottom` row dividers in `stack-panel.tsx` (×3) and `settings-page.tsx` (×5) with Divider, dropping the now-unused `rowDivider` token.
- [x] Evaluate the opportunistic adoptions
      Assess Tabs for `ViewToggle`, Accordion for the `ideas-board.tsx` / `plan-detail.tsx` expand toggles, Menu for `plans-sidebar.tsx` actions, and Switch/Radio for the boolean/small-exclusive agent-config `Select`s. Adopt each only where it removes custom code with no rendering regression; record what was deferred and why so the idea's backlog stays honest.
- [x] Type-check and visual pass
      `tsc --noEmit` plus a browser eyeball of every touched surface: toasts fire on action failure, loaders and skeletons render, tooltips open, copy still copies, dividers match the old row separation. These swaps change rendering, not just types, so the visual half is the real gate.
