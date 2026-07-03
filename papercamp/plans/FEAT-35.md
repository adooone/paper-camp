---
id: FEAT-35
title: Adopt paper-ui 0.5.0 components
kind: feat
status: review
created: 2026-07-03
idea: IDEA-33
updated: 2026-07-03
tags:
  - app
  - ui
---

paper-ui 0.5.0 roughly doubled the library's component list, and paper-camp hand-rolls several things it now provides. With the [[IDEA-32]]/FEAT-34 bump landed (pinned `0.5.0`), this plan replaces that custom code with the real components. The headline is Toast: `useActionFeedback`'s `errorMessage` is rendered nowhere, so Draft/Extend (and other) action failures are silently swallowed — wiring `ToastProvider` at the app root and calling `useToast` from every `run()` caller closes a standing bug, not just polish. The remaining direct swaps are grounded in actual files: the custom `.spinner` class (`utilities.css`, `plan-detail.tsx`) becomes Spinner, `plan-card-skeleton.tsx` becomes Skeleton, ~15 `title=` attributes become Tooltip, `copy-prompt-button.tsx` becomes CopyButton, and the hand-rolled `borderBottom` row dividers (plus the `rowDivider` token) in `stack-panel.tsx` (×3) and `settings-page.tsx` (×5) become Divider.

Beyond the direct swaps, a few adoptions are opportunistic — take them only where they remove custom code, defer otherwise: Tabs for the board/list `ViewToggle`, Accordion for the collapsible expand toggles in `ideas-board.tsx` / `plan-detail.tsx` (`stack-panel.tsx` already uses the real Accordion for its changed-files list), Menu for `plans-sidebar.tsx` per-item actions only if they grow past the single "×" delete, and Switch/Radio for settings modeled as `Select` where the choice is boolean or small-exclusive. Out of scope: `Breadcrumb` and `Pagination` are claimed by [[IDEA-40]] and [[IDEA-38]], and NavigationIsland is obsolete since FEAT-33 ([[IDEA-34]]) moved global navigation into paper-ui `Layout`'s header. Each swap is independently shippable, so this lands incrementally (Toast first) rather than as one big PR — and since every phase changes rendering, verification is `tsc` plus a visual pass in the running app (per AGENTS.md "verify UI changes visually"), not just a type-check.

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
