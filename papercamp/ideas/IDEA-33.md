---
id: IDEA-33
title: Adopt paper-ui 0.5.0 components
---

## IDEA-33: Adopt paper-ui 0.5.0 components

0.5.0 roughly doubled paper-ui's component list, and paper-camp has hand-rolled several things the library now provides. The version bump has landed ([[IDEA-32]] / FEAT-34, pinned `0.5.0`), so this is unblocked: replace the custom code with the real components. This is a UI-quality/consistency pass, kept separate from the migration so the bump PR stayed a clean "renders identically on 0.5.0" change.

**Direct swaps (replace existing custom code, grounded in actual files):**

| paper-camp today | → paper-ui 0.5.0 | Where |
|---|---|---|
| `useActionFeedback` errors rendered nowhere (silent Draft/Extend failures) | **Toast** (`ToastProvider` + `useToast`) | app root + every `run()` caller — **highest-value; closes a standing bug** |
| custom `.spinner` class | **Spinner** | `utilities.css`, `plan-detail.tsx` |
| custom `PlanCardSkeleton` | **Skeleton** | `plan-card-skeleton.tsx`, `list-view.tsx` |
| ~15 `title=` tooltip attributes | **Tooltip** | view-toggle, plan-detail, draft/extend/clarify/audit buttons, … |
| custom `copy-prompt-button.tsx` | **CopyButton** | `components/copy-prompt-button.tsx` |
| hand-rolled `borderBottom` row dividers (+ the `rowDivider` token) | **Divider** | `stack-panel.tsx` (×3), `settings-page.tsx` (×5) |

**Toast is the headline.** Wiring `ToastProvider` at the app root and calling `useToast` from every `useActionFeedback` consumer finally surfaces action failures — the Draft/Extend buttons (and others) currently swallow `errorMessage` because nothing renders it. Do this one first; the rest are polish.

**Opportunistic — adopt only where it removes custom code, otherwise defer:**
- ~~**NavigationIsland**~~ — obsolete: FEAT-33 ([[IDEA-34]]) moved global navigation into paper-ui `Layout`'s header and removed the floating island entirely; nothing left to adopt.
- **Tabs** — the board/list `ViewToggle` (icon-button toggle) could become Tabs.
- **Accordion** — the collapsible expand toggles in `ideas-board.tsx` / `plan-detail.tsx` (`stack-panel.tsx` already uses the real `Accordion` for its changed-files list).
- **Menu** — per-item action dropdowns in `plans-sidebar.tsx` if actions grow past the single "×" delete.
- **Switch / Radio** — settings currently modeled as `Select` where the choice is boolean/small-exclusive (agent config rows).
- Not applicable here: Avatar, Swatch, PropTable. `Breadcrumb` and `Pagination` are claimed by [[IDEA-40]] and [[IDEA-38]] respectively.

Each swap is independently shippable, so this can land incrementally (Toast first) rather than as one big PR. Verify visually — these change rendering, not just types.
