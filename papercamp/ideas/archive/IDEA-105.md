---
id: IDEA-105
title: Plain-language the confusing UI text
type: fix
status: done
created: 2026-07-29
updated: 2026-08-02
released: v0.13.0
tags:
  - app
  - ui
subject: Simplicity pass
---

Many titles and labels don't say plainly what they are. Text-only pass, no behaviour change. From the audit, worst first:

- Roadmap tabs "Tree / Map" → "Outline / Board"; "Add candidate…" → "Add option…"
- Nav "Ideas" (the main plans view) → "Plans"
- "Provenance" → "History"
- "Views" toggle → "Show"
- "Add /code-review findings" (raw slash command) → "Add code-review findings"
- toast "Kept the reconciled version" → "Kept the merged version"
- "Splitting the review…" → "Separating review feedback…"
- create-idea "Note — never needs a plan" → "Just a note (no plan needed)"

(The "graduate into an open question" / "promote into a decision" / Clarifications labels are handled by [[IDEA-104]].)

### Phases
- [x] Relabel the Roadmap tabs and add-item control
      "Tree / Map" → "Outline / Board", "Add candidate…" → "Add option…".
- [x] Rename the "Ideas" nav entry to "Plans"
      The main plans view only — leave entity ids and routes untouched.
- [x] Rename "Provenance" → "History" and the "Views" toggle → "Show"
- [x] Fix the agent action label and status/toast strings
      "Add /code-review findings" → "Add code-review findings", toast "Kept the reconciled version" → "Kept the merged version", "Splitting the review…" → "Separating review feedback…".
- [x] Reword the create-idea note option
      "Note — never needs a plan" → "Just a note (no plan needed)".
- [x] Type-check and full pass
      Confirm nothing keys off the changed display strings; behaviour unchanged.
