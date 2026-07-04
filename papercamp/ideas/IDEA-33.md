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
- **Tabs** — assessed for the board/list `ViewToggle`. Deferred: `Tabs` always renders a visible text label next to each icon and wraps active content in a `Card`; the current `IconButton` pair is icon-only (label is aria-only, surfaced via `Tooltip`). Adopting would add visible labels and a content-wrapper — a rendering regression, not a like-for-like swap.
- **Accordion** — assessed for `ideas-board.tsx` and `plan-detail.tsx`. Deferred both: `ideas-board.tsx`'s "▾ N links" toggle needs two independent click targets sharing one row (the idea title navigates via `onOpenIdea`, the chevron expands), but `Accordion`'s `title` renders inside a single header `<button>` — merging them would break the title's navigate-on-click behavior. `plan-detail.tsx` has no hand-rolled expand toggle to replace; its phase-detail expand/collapse is already the `Table` component's own built-in `expandable` prop, not custom code.
- **Menu** — reassessed for `plans-sidebar.tsx`. Still deferred: the per-item action is still the single "×" delete `IconButton`; hasn't grown past that threshold.
- **Switch / Radio** — reassessed. The only boolean/small-exclusive candidate is the agent picker in `settings-page.tsx`'s `AgentTaskRow` (`AGENT_IDS` = `['claude-code', 'opencode']`, 2 options). Deferred: it's already rendered with paper-ui's own `Select`, not hand-rolled markup, so swapping it for `Radio` wouldn't remove any custom code — just substitute one paper-ui component for another, outside this phase's adoption bar.
- Not applicable here: Avatar, Swatch, PropTable. `Breadcrumb` and `Pagination` are claimed by [[IDEA-40]] and [[IDEA-38]] respectively.

Each swap is independently shippable, so this can land incrementally (Toast first) rather than as one big PR. Verify visually — these change rendering, not just types.
