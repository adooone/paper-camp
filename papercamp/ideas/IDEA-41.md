---
id: IDEA-41
title: Settings and affordance polish
type: fix
status: review
created: 2026-07-02
updated: 2026-07-06
tags:
  - app
  - ui
  - settings
---

Loose ends from the same design review that fit neither [[IDEA-34]] (layout) nor [[IDEA-33]] (component swaps): places where controls don't look like what they do, or behave inconsistently.

- **Label the agent matrix.** The per-task rows in `settings-page.tsx` (Phase run / Plan draft / Idea extend / Commit suggest) offer three unlabeled selects — agent, model, effort — that must be decoded by their values; add column headers or per-select labels.
- **One persistence model.** Project name and port require an explicit Save while the agent/model selects save on change; unify on save-on-change with a `Toast` confirmation (the component shipped with the [[IDEA-32]] bump; [[IDEA-33]] wires the ToastProvider) or Save everywhere.
- **Actions should look like actions.** The Phases-header controls in `plan-detail.tsx` ("Run all phases", "Audit phases against code", "Add as phases") are ghost `Button`s that read as plain text labels next to the phases heading; give them real button affordances.
- **Retire the color-override classes.** `btn-green` / `btn-orange` / `btn-violet` (`utilities.css`) restyle paper-ui `Button` from the outside; replace them with proper variants or one semantic wrapper so intent (go / stop / log) is named once.
- **No more `window.confirm`.** Backlog delete in `plans-sidebar.tsx` uses the native confirm dialog; use paper-ui `Modal` like the rest of the app.

Small, independently shippable items — good gap-fillers between the bigger layout and navigation passes.

Five small, independently shippable fixes for controls that don't look like what
they do or behave inconsistently. In `settings-page.tsx`, each `AgentTaskRow`
offers three side-by-side controls — agent `Select`, model `Select`/`Input`,
effort `Select` — whose only label is the row name, so the values must be decoded
by eye; a header row above the task rows (Task / Agent / Model / Effort) fixes
that. The same page mixes two persistence models: project name and port need an
explicit Save `Button` while the agent rows save on change with a transient
"Saved" span. Unify on save-on-change with a `Toast` confirmation — the
ToastProvider is already wired in `router.tsx` ([[FEAT-35]] landed it), so the
Save buttons and every inline "Saved" span go away. The env-variables table stays
on explicit Save: it's a batch edit with duplicate-key validation, where
save-on-change doesn't fit.

The other three items drifted since the idea was written and the entity views
merged. The Phases-header tools are now `AuditPhasesButton` / `ReconcileButton` /
`AddReviewPhasesButton` in `entity-detail.tsx` (and "Run all phases" moved to the
sidebar Plan card, `plan-actions-column.tsx`) — all ghost `Button`s that read as
plain text next to the Phases heading; they become secondary so they look
pressable. The `btn-green` / `btn-orange` / `btn-violet` classes in
`utilities.css` recolor paper-ui `Button` from outside by targeting
`svg path:first-child` with `!important` — a selector the 0.6.0 SketchBorder
refactor already makes fragile — across six usages in `plan-actions-column.tsx`,
`entity-detail.tsx`, and `reconcile-diff-panel.tsx`; one semantic wrapper
component names the go / stop / log intent once and the classes get deleted
(check `~/dev/paper-ui` first for whether 0.6.0's variants or `colors` palette
can express the fills natively). And the last `window.confirm` — the delete-idea
confirm, now in `plans-page.tsx`, not `plans-sidebar.tsx` — becomes a paper-ui
`Modal` confirm like the rest of the app.

### Phases
- [x] Label the agent matrix
      Add a header row (Task / Agent / Model / Effort) above the `AgentTaskRow`s
      in `settings-page.tsx`, aligned with the row layout, so the three selects
      no longer need decoding by their values.
- [x] Unify settings persistence on save-on-change
      Make project name and port save on blur/change in `settings-page.tsx`,
      confirmed by a `Toast` (ToastProvider already wired in `router.tsx`);
      remove the two Save buttons and all transient "Saved" spans, with the
      agent rows adopting the same Toast. The env table keeps its batch Save.
- [x] Give the phases-header tools button affordance
      Switch `AuditPhasesButton`, `ReconcileButton`, and `AddReviewPhasesButton`
      (rendered in `entity-detail.tsx`'s Phases header) from ghost to secondary
      so they read as actions, not labels.
- [x] Retire the color-override classes
      Replace the six `btn-green` / `btn-orange` / `btn-violet` usages
      (`plan-actions-column.tsx`, `entity-detail.tsx`,
      `reconcile-diff-panel.tsx`) with one semantic wrapper that names the
      go / stop / log intent once, and delete the classes from `utilities.css`;
      check `~/dev/paper-ui` for a native variant/`colors` route first.
- [x] Replace window.confirm with a Modal
      Swap the delete-idea `window.confirm` in `plans-page.tsx` for a paper-ui
      `Modal` confirm dialog, following `create-idea-modal.tsx`'s idiom.
- [x] Type-check and visual pass
      `tsc --noEmit`, `biome check`, tests, and a browser pass over Settings
      (headers, toasts) and the plan detail / delete-confirm flows.
