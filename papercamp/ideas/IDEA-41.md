---
id: IDEA-41
title: Settings and affordance polish
status: idea
created: 2026-07-02
---

Loose ends from the same design review that fit neither [[IDEA-34]] (layout) nor [[IDEA-33]] (component swaps): places where controls don't look like what they do, or behave inconsistently.

- **Label the agent matrix.** The per-task rows in `settings-page.tsx` (Phase run / Plan draft / Idea extend / Commit suggest) offer three unlabeled selects — agent, model, effort — that must be decoded by their values; add column headers or per-select labels.
- **One persistence model.** Project name and port require an explicit Save while the agent/model selects save on change; unify on save-on-change with a `Toast` confirmation (the component shipped with the [[IDEA-32]] bump; [[IDEA-33]] wires the ToastProvider) or Save everywhere.
- **Actions should look like actions.** The Phases-header controls in `plan-detail.tsx` ("Run all phases", "Audit phases against code", "Add as phases") are ghost `Button`s that read as plain text labels next to the phases heading; give them real button affordances.
- **Retire the color-override classes.** `btn-green` / `btn-orange` / `btn-violet` (`utilities.css`) restyle paper-ui `Button` from the outside; replace them with proper variants or one semantic wrapper so intent (go / stop / log) is named once.
- **No more `window.confirm`.** Backlog delete in `plans-sidebar.tsx` uses the native confirm dialog; use paper-ui `Modal` like the rest of the app.

Small, independently shippable items — good gap-fillers between the bigger layout and navigation passes.
