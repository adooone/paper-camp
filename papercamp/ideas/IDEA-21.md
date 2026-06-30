---
id: IDEA-21
title: Batch plan-doc freshness audit
---

### IDEA-21: Batch plan-doc freshness audit

The existing "Phase convergence audit" (`AuditPhasesButton`, see `plans.md`'s "Phase convergence audit" section) already solves this for one plan at a time: an AI pass that compares a single plan's recorded phases against the actual code and append-only adds whatever's missing, never rewriting or checking off existing lines. What's missing is the sweep version — going through every `review`/`done` plan and surfacing drift across the whole project in one pass, instead of remembering to click audit on each plan individually.

**Shape:** reuse the same convergence-audit prompt and append-only guarantee, just looped over every closed/closing plan instead of one. Two plausible entry points, not mutually exclusive:

- A CLI command (`paper-camp audit` or similar) that iterates `plans.md`'s `review`/`done` entries, runs the existing audit logic against each, and prints a combined report of which plans got new gap-phases appended.
- An "Audit all" button in the dashboard (Plans list or Stack panel) doing the same, surfaced as activity feed entries per plan touched.

**Why not a CI job:** each plan costs one real AI call, so running this on every push would be slow and burn tokens auditing plans that haven't changed since their last audit. Better triggered manually on a cadence (weekly, or before a release/`Approve & close` sweep) than wired into `ci.yml`.

**Open question:** how to avoid re-auditing plans that haven't changed since their last clean audit — likely needs a per-plan "last audited" marker (a log line, or a field) so a full sweep skips anything untouched since.
