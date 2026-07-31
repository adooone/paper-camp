---
id: IDEA-113
title: Feedback as a single chat thread
type: feat
status: review
created: 2026-07-31
updated: 2026-07-31
tags:
  - app
  - ui
  - agent
  - plans
subject: Conversational feedback
order: 7
---

The Feedback view on an idea becomes one chat thread with a single message box and a single send. Posting a message is the only action — there is no Apply, no Split, and no pre-sorting by the author. Every message goes to the agent, which decides what it is and acts on it. This closes the answer gap [[IDEA-104]] left: questions already live on the idea, but nothing let you answer one.

- Sending a message runs a one-shot agent with the whole thread plus the current idea and its plan as context. There is no live daemon; each run is fresh but sees the full history, so it reads as a continuous conversation.
- The agent classifies each message and acts in the same run, then posts a short reply saying what it did: answers its own open question; edits the plan (add or reword a phase, correct body prose); records a stray thought or review remark with no edit; or spins off a follow-up idea when the message is out of scope for this one.
- When the agent needs input it asks its question as a message in the thread. The user's next message answers it. No blocking state and no separate resolve step.
- Plan edits auto-apply — they are git-tracked, and the agent's reply carries a one-tap Undo that reverts that run's edits. No approve-or-discard preview gate.
- Answers to the agent's questions are persisted onto the idea entity (as a clarification/decision), so the next run and any other agent see them. The thread is the interface; the idea file stays the source of truth.
- Removes the Apply notes and Split review buttons, the Add comment vs Add review split, and the anchored margin-note pins with their Rework-from-notes flow. The idea's `log`, `review`, `notes`, and `clarifications` fold into one thread on the entity.

Findings that surface after this plan is built don't rewrite its finished phases — they append to a separate `### Fixes` group below Phases. An open Fix reopens the idea so run-all works through Fixes just like phases, keeping post-build follow-ups distinct from the original build.

### Phases
- [x] Fold log, review, notes, and clarifications into one thread on the idea entity
      Migrate existing entries into the single ordered thread so no history is lost.
- [x] Rebuild the Feedback view as a chat thread with one message box and one send
      Build the view entirely from Paper UI library components — render each message with the Card component, not custom message UI.
- [x] Run a one-shot agent on send with the full thread, idea, and plan as context, and post its reply into the thread
- [x] Have the agent classify and act in the same run — answer its own question, edit the plan or body, record with no edit, or spin off a follow-up idea
- [x] Persist answers to the agent's questions onto the idea as clarifications/decisions
- [x] Carry a one-tap Undo on each agent reply that reverts that run's git-tracked edits
- [x] Remove the old flows — Apply, Split, comment/review split, margin-note pins, and Rework-from-notes
- [x] Rebuild the feedback message rendering on Paper UI Card components
      Render each thread message with the Paper UI Card component and drop the custom message bubbles, so the whole view is built from Paper UI primitives.
- [x] Add a `### Fixes` section to the idea grammar
      Parse and serialize a checkbox list after `### Phases` in the core parser, serializer, sections, and entity types — same grammar as phases, no history lost on round-trip.
- [x] Land post-build feedback edits in Fixes, and reopen the plan
      When a feedback-chat edit adds work to an already-implemented plan, append it to Fixes (not Phases) and set status back to in-progress.
- [x] Run-all works open Fixes after the phases
      Once the phases are done, run-all implements each open Fix with a per-fix commit, then returns the plan to review when none remain.
- [x] Render a separate "Fixes" container below Phases in the entity detail
      Group Fixes in their own labelled container under the Phases list, with its own progress, visually distinct from the original build.

### Thread
- [x] 2026-07-31 [log] fix docs check
- [x] 2026-07-31 [log] [agent] This idea is only about turning Feedback into a single chat thread, so a failing docs check isn't something I can fix from here — it's outside this idea's scope. If you want it tracked, tell me which check is failing (and where) and I'll spin it off as its own idea; otherwise this note is now recorded in the thread.
- [x] 2026-07-31 [log] chat messages should use cards components to render. Not custom ones. All the UI should be constructed from the Paper UI library components.
- [x] 2026-07-31 [log] [agent] Good constraint — I've reworded the chat-view phase to require Paper UI Card components for message rendering and to build the whole view from Paper UI library primitives rather than custom UI. This is git-tracked; the Undo on this reply reverts the edit.
- [x] 2026-07-31 [log] Run-all parked on phase 11 ("Run-all works open Fixes after the phases") — the agent needs a decision: ` blocker, check timeout/exit, verify the checkbox actually flipped (`didTaskProgress`), run project checks with a bounded (`FIX_ATTEMPT_CAP = 2`) fix-pass retry loop (`runFixPass`, line 789), then call `onPhaseCommit(plan, phase, i)` (line 1006–1009) to commit.
  - After the loop, if nothing failed: `onRunComplete(plan)` (lines 1022–1034) is called once — this is where "review" gets set.
- `createAgentManager(root, onAuditComplete?, onPhaseCommit?, onRunComplete?, state?)` (line 192) — the callbacks are injected, not hardcoded, so agent.ts stays pure/testable.

**`/home/croco/dev/paper-camp/src/app/server/agent-hooks.ts`** — the real callback implementations wired in `api.ts`:
- `commitPhase(plan, phase)` (line 40) — `git.stageAll()` + `git.commit` with title `${kind}(${scope}): ${phase.text}`, `Refs: ${planId}`, `noVerify: true`. This is `onPhaseCommit`.
- `setRunReview(plan)` (line 50) — re-reads the entity file, and if status isn't already `review`/`done`/`dropped`, rewrites frontmatter `status: review` and commits `mark ${planId} review`. This is `onRunComplete`.

**`/home/croco/dev/paper-camp/src/app/server/api.ts`** (lines 96–103) wires it: `createAgentManager(root, hooks.stampAuditDate, hooks.commitPhase, hooks.setRunReview, agentState)`.

**Route**: `/home/croco/dev/paper-camp/src/app/server/routes/agent.ts` lines 272–283, `POST /api/agent/launch-run-all` → `agent.startRunAllPhases(plan, () => status.runChecksAndWait())`.

**UI trigger**: `RunAllPhasesButton` in `run-all-phases-button.tsx` → `useAppStore().launchRunAll` (agent-slice.ts:156) → `agent-api.ts:82 launchRunAll(planId)` → the route above.

### 2. "Phases are done" / stop condition / review status

- Stop/done condition for the loop itself: `unchecked.length === 0` up front returns an error ("No unchecked phases to run"); mid-loop it stops on blocker/timeout/exit-fail/no-progress/red-checks-after-fix-cap, breaking with `failed++`.
- "All done, set review" happens only if the whole `unchecked` loop completes without any `failed` (`agent.ts` lines 1019–1036): calls `onRunComplete(plan)` → `setRunReview` in agent-hooks.ts, which writes `status: review` (guarded so it never downgrades an existing `review`/`done`/`dropped`) and commits.
- Separately, **derived status** (`/home/croco/dev/paper-camp/src/core/status/status.ts`, `deriveStatus`, lines 19–39) recomputes the UI-visible status from PR state + `allChecked(phases)` (line 13–15: `entity.phases.length > 0 && entity.phases.every(p => p.done)`). This **only checks `phases`, not `fixes`** — important: even once run-all adds a fixes-loop, this function needs updating or a plan with all fixes done but a still-open PR will keep deriving to `review`/`in-progress` correctly, but `allChecked` itself doesn't know about fixes at all today.

### 3. Fixes section — entity/plan types, parser/serializer, phase-10 code

- **Type**: `EntityEntry.fixes?: PhaseItem[]` (`/home/croco/dev/paper-camp/src/types/index.ts` line 258) — "Post-build findings, same checkbox grammar as `phases`, appended below Phases." **`PlanEntry` (line 162) has no `fixes` field**, and `entityToPlan` (`/home/croco/dev/paper-camp/src/core/readers.ts` lines 85–103) does **not** map `e.fixes` onto the returned `PlanEntry` — this is a gap: `startRunAllPhases` receives a `PlanEntry`, which today can't see fixes at all.
- **Section def**: `/home/croco/dev/paper-camp/src/core/sections.ts` lines 136–142, `FIXES_SECTION` — same `headingRe: /^#{2,3}\s+Fixes\s*$/i`, same `parsePhaseEntries`/`formatPhaseLines('### Fixes', ...)` as `PHASES_SECTION` (lines 130–134). No separate Fix type/grammar — fixes literally reuse `PhaseItem`.
- **Parser**: `/home/croco/dev/paper-camp/src/core/parse/parser.ts` line 244 (`extractSection(bodyAfterLegacy, FIXES_SECTION)`), line 271 (`...(fixes.length > 0 && { fixes })`).
- **Serializer**: `/home/croco/dev/paper-camp/src/core/serialize/serializer.ts` line 232 writes `{ entries: input.fixes, section: FIXES_SECTION }` after Phases (line 231).
- **`entityFileInput`** helper (`/home/croco/dev/paper-camp/src/app/server/helpers.ts` line 60) carries `fixes: entry.fixes` through round-trips by default.
- **Phase-10 code (landing edits + reopening)**: `applyFeedbackEdit` in `/home/croco/dev/paper-camp/src/app/server/feedback-reply.ts` (lines 92–124) — if `entity.status` is `review`/`done` (`implemented`), a new `op: 'add'` phase edit is pushed onto `fixes` instead of `phases` (lines 100–107, 120). The route that calls it, `/home/croco/dev/paper-camp/src/app/server/routes/agent.ts` `/api/agent/feedback-message` handler (~lines 356–410): `const reopen = overrides.fixes?.some((p) => !p.done) ?? false;` then writes `...(reopen ? { status: 'in-progress' } : {})` (lines 382–411) and appends `(reopened this idea to re-run)` to the reply text.
- **Plan-level idea doc**: `/home/croco/dev/paper-camp/papercamp/ideas/IDEA-113.md` — phase 9 (landing Fixes + reopen) is `[x]`; phase 10 "Run-all works open Fixes after the phases" (line 44) is the target: *"Once the phases are done, run-all implements each open Fix with a per-fix commit, then returns the plan to review when none remain."* Phase 11 (rendering a Fixes UI container) is also still open.

### 4. Fix item type vs Phase item type

There is no separate `FixItem` type — `fixes?: PhaseItem[]` reuses `PhaseItem` (`done: boolean; text: string; description?: string; source?: 'review'`) verbatim, both in `EntityEntry` and in the parse/serialize/section layer. Distinguishing "phase vs fix" is purely which array/section it lives in, not the item's shape.

### 5. Status transitions in-progress/review/done — where defined, current triggers

- **Canonical enum**: `PlanStatus`/`EntityStatus` in `/home/croco/dev/paper-camp/src/types/index.ts` line 1 (`'idea' | 'planned' | 'in-progress' | 'review' | 'done' | 'dropped'`).
- **Derivation** (what the UI actually shows, not necessarily what's on disk): `deriveStatus` in `/home/croco/dev/paper-camp/src/core/status/status.ts` (lines 19–39):
  - `dropped` stored always wins.
  - If there's a PR: `merged`→`done`, `closed`→`dropped`, else `allChecked(phases) ? 'review' : 'in-progress'` — driven purely by phase checkboxes, PR presence/state, not by any stored status.
  - No PR / lookup unresolved: falls back to stored `status` or a phases-presence guess (`planned`/`idea`).
- **Stored writes** (frontmatter `status:` field), i.e. what actually persists to disk and triggers real transitions today:
  - `setRunReview` in `agent-hooks.ts` (line 50) — run-all's completion hook, writes `review` (never overwrites an existing terminal status).
  - The `/api/agent/feedback-message` route in `routes/agent.ts` — writes `in-progress` when a feedback edit reopens a plan by adding an open Fix (the phase-10-adjacent "reopen" trigger).
  - Elsewhere: plan-draft/audit flows, and human-driven edits via the plans PATCH endpoint, also write `status` directly (not explored in depth here, but same `entityFileInput`/`writeEntityFile` pattern).

## How to extend for "loop over open Fixes after phases, per-fix commit, then review"

Concretely, extending `startRunAllPhases` needs:
1. `entityToPlan` (`core/readers.ts`) currently drops `e.fixes` — either add `fixes?: PhaseItem[]` to `PlanEntry` and map it through, or have the route/agent.ts read fixes separately when building the run-all task.
2. In `agent.ts`, after the existing phases loop completes with `failed === 0`, add a second loop over `unchecked fixes` (same shape as the phases loop: `admit`, prompt build, run agent, verify checkbox flip, run checks/fix-pass, commit) — likely a new `buildFixItemPrompt` (distinct from `buildFixPassPrompt`, which is for check-failures, not for implementing a Fix item) that references `### Fixes` instead of `### Phases`.
3. `didTaskProgress`'s `task.phaseIndex !== undefined` branch (line 349) checks `plan.phases[task.phaseIndex]?.done`; a fixes pass needs an analogous `task.fixIndex` field on `AgentTask` and a parallel check against `plan.fixes[i]?.done`.
4. `onPhaseCommit`'s commit message building (`agent-hooks.ts` `commitPhase`) is generic enough (`phase.text`) to reuse for a fix item, or add a sibling `commitFix`/reuse with a `Fixes` label.
5. `onRunComplete`/`setRunReview` should only fire once both phases and fixes are exhausted — i.e. gate the "all done" branch (agent.ts ~line 1019) on `failed === 0 && unchecked fixes also empty after the fix loop`, not just after the phases loop.
6. `allChecked` in `core/status/status.ts` (line 13) should likely also fold in `fixes` if you want `deriveStatus` to stay consistent with run-all's own "done" signal (currently it ignores fixes entirely, so a PR-driven derivation could show `review` before fixes are actually done, or vice versa) — worth deciding deliberately since IDEA-113's phase 10 text says "then returns the plan to review when none remain," implying fixes-completeness should factor into the review transition the same way phases do.
