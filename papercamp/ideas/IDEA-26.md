---
id: IDEA-26
title: Plan reconcile pass and audit gating
---

## IDEA-26: Plan reconcile pass and audit gating

FEAT-25 exposed two gaps in how plans stay in sync with reality:

1. **The audit button shows on every status.** `AuditPhasesButton` renders unconditionally (`plan-detail.tsx:293`, only disabled on `agentBusy`/missing id). But the convergence audit is *drift-detection for complete plans* — on an `in-progress` plan it just keeps appending "missing" phases, because the feature genuinely isn't built yet. Off-label and noisy.
2. **Nothing can fix stale content in a plan.** The audit is deliberately **append-only** (see `decisions.md` — append-only so re-running can never corrupt or reword an existing plan), so it can only *add* phases, never *correct* them. When a plan's prose/phases go stale — FEAT-25's `plans.md` references, a superseded approach, a renamed/removed code symbol — there's no mechanism to reconcile it; it has to be hand-edited.

The fix is to recognize these as **two complementary passes** and give each its proper trigger:

**Audit (existing, append-only) → "what work is MISSING?"**
Gate its button to `review`/`done` only — the states where drift-detection belongs. Small change: wrap the `AuditPhasesButton` at `plan-detail.tsx:293` in a `status === 'review' || status === 'done'` check.

**Reconcile / Actualise (new) → "is the plan still ACCURATE vs the current code + decisions?"**
An AI pass that rewrites stale references, superseded approaches, and renamed/removed code symbols in the body and phase *descriptions* — most useful for `in-progress` plans whose future work must point at current reality.

**Reconcile design + safety (the crux).** `decisions.md` chose append-only specifically to stop an AI from corrupting a plan, so a rewrite pass has to earn that trust back:
- **Hard guardrails:** never touch `id`/frontmatter identity, never un-check or delete a `[x]` phase, never change the *set* of phases — only reword prose/descriptions and fix references. Preserve intent.
- **Human-in-the-loop:** because it edits (unlike audit), don't write in place silently. Produce the proposed rewrite as a **diff/preview** the user approves before it lands — mirroring the "a human reviews and promotes" pattern already used for agent-drafted plans.
- **Narrow prompt:** "update file paths, renamed/removed code symbols, and approaches that `decisions.md` has since superseded; leave everything else byte-identical."
- **Cheap deterministic pre-pass (optional):** a non-AI find/replace for known path renames (`plans.md` → `papercamp/plans/`) catches the common case with no model call; the AI reconcile handles deeper drift.
- **Trigger:** a "Reconcile" button gated to non-`done` plans (in-progress especially), complementing the audit button's `review`/`done` gating.

**Touchpoints:** `audit-phases-button.tsx` / `plan-detail.tsx:293` (gate), a new `buildReconcilePrompt` in `prompts.ts`, a new `'reconcile'` `TaskKind` + launch route, and a preview/diff approval UI. Surfaced by [[IDEA-21]] (the batch audit, FEAT-25); respects the append-only decision in `decisions.md` by keeping audit untouched and making reconcile review-gated instead.
