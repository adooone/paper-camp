---
id: IDEA-125
title: Headless runs die as bare "error" when the agent hits a permission ask
type: fix
status: done
created: 2026-08-04
updated: 2026-08-05
released: v0.13.2
tags:
  - agents
  - tasks
subject: Infrastructure
---

Observed in the func-ui corpus (run-all on its IDEA-2, agent: opencode): the agent tried to read a sibling repo as an API reference (`~/dev/paper-ui/src/components/select/*`), the agent harness raised an `external_directory` permission ask, the headless runner auto-replied with a denial within milliseconds, and the run ended `outcome: "error"` — with no reason recorded in tasks.log and nothing actionable on the board. Diagnosis required digging through the agent's own log files.

Two layers to fix:

- **Record the reason**: tasks.log entries (and the task detail view) should carry the failing cause — "permission denied: read outside workspace: <path>" — not just `error`.
- **Park instead of kill**: a permission ask mid-run is a human decision, which is exactly what thread questions are for. Surface it as a parked question on the idea ([[IDEA-118]]'s inbox is the natural home) with resume-on-answer, instead of auto-denying and erroring the run.

Workaround meanwhile: pre-grant sibling-repo read access in the agent's permission config per project.

### 4. Parked question on the idea (IDEA-118 "inbox")

There is **no separate inbox/queue module** — IDEA-118 itself is still `status: idea` (unbuilt, `/home/croco/dev/paper-camp/papercamp/ideas/IDEA-118.md`). What phase 4 actually did is repurpose the existing per-idea `Thread` mechanism:
- `escalateToLog()` in `/home/croco/dev/paper-camp/src/app/server/agent.ts:264-288` appends a `ThreadMessage` to the plan/idea's `thread` array and writes the entity file. As of `cf02fe9`, the message is created with `agentThreadMessage(message, 'question')` instead of the default `'log'` kind (agent.ts:284), and it also sets `task.errorKind = 'question'` (agent.ts:269, tightened in `ac6be65`).
- `agentThreadMessage()` — `/home/croco/dev/paper-camp/src/core/serialize/serializer.ts:42-53` — for `kind === 'question'` now also sets `state: 'open'` (added in `cf02fe9`).
- Shape of a parked question: `ThreadMessage` (`/home/croco/dev/paper-camp/src/types/index.ts:63-72`): `{ kind: 'question', date, text, from: 'agent', state: 'open' }`. The `text` is the full escalation message, e.g. `` Run-all parked on phase 1 ("First phase") — the agent needs a decision: read outside workspace: /home/user/dev/paper-ui/select.tsx ``.
- `escalateToLog` also flips the entity's `status` to `in-progress` if it wasn't already done/dropped (agent.ts:280-287), so the parked run surfaces in the worklist.
- This message renders through the normal Feedback-chat/thread UI for the idea (not a dedicated inbox screen — that's IDEA-118, still unbuilt).
- Test: same `agent.test.ts` test as above, plus its `cf02fe9` addition asserting `parsedPlan.thread?.find(m => m.kind === 'question')` has `state === 'open'` and text containing `phase 1 ("First phase")`.

### 5. Resume on answer

Trigger: `POST /api/agent/feedback-message` in `/home/croco/dev/paper-camp/src/app/server/routes/agent.ts:347-459`.
- After the feedback-reply agent runs (`replyToFeedback`, `/home/croco/dev/paper-camp/src/app/server/feedback-reply.ts`) and reports `answersQuestion: true`, the route (agent.ts:397-411) finds the **last open `question`-kind thread message** via `findLastIndex(m => m.kind === 'question' && (m.state ?? 'open') === 'open')` and flips its `state` to `'resolved'`.
- If an open question was resolved (`openQuestionIndex !== -1`), it calls `agent.resumeQuestionParkedTasks(entity.id, () => status.runChecksAndWait())` (agent.ts:437-439) — this is the sole resume trigger; there's no polling/cron, only this reply path.
- `resumeQuestionParkedTasks(planId, runProjectChecks)` — `/home/croco/dev/paper-camp/src/app/server/agent.ts:1448-1465`: finds an in-memory task with `status === 'error' && errorKind === 'question' && planId === planId && taskKind === 'run-all'`, re-fetches the plan, and re-invokes `startRunAllPhases(plan, runProjectChecks)`. Because the plan's checkboxes are unchanged from where the parked run stopped, `startRunAllPhases` naturally picks back up at the next unchecked phase/fix (agent.ts:1108-1114 filters `!item.done`). On success it clears `task.errorKind`.
- Decides continue vs. fail: it's just a normal `startRunAllPhases` re-launch — if the agent still can't proceed it will hit the same blocker path again (park again) or run to a normal `done`/`error` with `errorReason`/`reason` recorded as usual. There's no separate "deny → fail cleanly" special case beyond what the ordinary run-all failure/park paths already do — a human "no" reply just needs to be phrased so `replyToFeedback` doesn't set `answersQuestion`, or, if it does resolve the question, the resumed run will re-hit the same permission ask and re-park (nothing currently distinguishes "granted" vs "denied" answers — resume always just re-runs).
- Only `run-all` tasks are resumable this way — a single-phase (`taskKind: 'phase'`) run that parks on a question is **not** picked up by `resumeQuestionParkedTasks` (its filter requires `t.taskKind === 'run-all'`). Worth checking during verification which task kind your func-ui repro actually used.
- Tests: `/home/croco/dev/paper-camp/src/app/server/agent.test.ts`, `describe('resumeQuestionParkedTasks', ...)` (3 cases: resumes and clears errorKind, ignores non-question failures, ignores question parked on a different plan — uses `NEEDS-DECISION:` fake-agent markers, not literally the permission path, but exercises the same `errorKind === 'question'` state machine). And the new file `/home/croco/dev/paper-camp/src/app/server/routes/agent.test.ts` (whole file, `describe('POST /api/agent/feedback-message resuming a question-parked run')`) — exercises the HTTP route end-to-end with mocked `agent.resumeQuestionParkedTasks`/`runFeedbackReply`, confirms the thread question flips `[ ]`→`[x]` in the plan markdown and confirms non-answering replies don't trigger resume.

### 6. Existing tests covering this flow

- `/home/croco/dev/paper-camp/src/app/server/agents/opencode.test.ts` — `parseLine` permission-denial extraction (unit, no live agent).
- `/home/croco/dev/paper-camp/src/app/server/task-log.test.ts` — `describe('logTaskCompletion reason', ...)` — reason field persisted/omitted on tasks.log entries.
- `/home/croco/dev/paper-camp/src/app/server/agent.test.ts` — the `startRunAllPhases` test `'parks on a permission-denial reason instead of auto-failing the run'` (grep for `PERMISSION-DENIED:`) is the closest thing to an end-to-end test of the whole park flow, plus the `resumeQuestionParkedTasks` describe block.
- `/home/croco/dev/paper-camp/src/app/server/routes/agent.test.ts` (new file) — HTTP-route-level resume-on-reply test.
- No test currently drives the **real** `opencode`/`claude-code` binary or feeds a genuine `external_directory`-shaped opencode event through the full `agent.ts` pipeline end-to-end (adapter → agent.ts → tasks.log → thread → resume) in one test — everything above is either adapter-unit-level or agent.ts-level using the fake spawned Node script, not the real opencode JSON schema. That gap is exactly what phase 6 exists to close.
- No hits for `parked` as a literal search term outside comments/messages already covered above; no separate "inbox" test file exists (IDEA-118 unbuilt).

### 7. Simulating a permission ask without a live agent

Two levers, no CLI flag exists for this — it's all test-harness-level:

- **Adapter-level (fastest, no process spawn):** call `parseLine()` directly from `/home/croco/dev/paper-camp/src/app/server/agents/opencode.ts` with a synthetic `tool_use` JSON line, exactly as `opencode.test.ts` does — e.g.
  ```js
  JSON.stringify({ type: 'tool_use', part: { tool: 'read', state: { status: 'error', input: { filePath: '/home/x/dev/paper-ui/select.tsx' }, error: 'The user rejected permission to use this specific tool call.' } } })
  ```
- **Full-manager-level (exercises agent.ts's park/escalate/resume state machine):** `/home/croco/dev/paper-camp/src/app/server/agent.test.ts` mocks the whole `./agents` module (lines ~14-30) with a fake adapter whose `buildArgs` just runs the string in `agentScript.current` as a Node `-e` script via `process.execPath`, and whose `parseLine` recognizes a `PERMISSION-DENIED:`-prefixed console.log line and returns `{ text, error: true, reason }` — same shape opencode's real parseLine produces. To simulate a permission ask in a test, set:
  ```js
  agentScript.current = "console.log('PERMISSION-DENIED: read outside workspace: /home/user/dev/paper-ui/select.tsx'); process.exit(1)";
  ```
  then call `manager.startRunAllPhases(plan)` (or `manager.start(plan, i)`) on a `createAgentManager(root, ...)` instance and assert on `currentStatus(manager)`, the written plan file's `### Thread` question, and `manager.resumeQuestionParkedTasks(planId)`. This is the pattern already used across `agent.test.ts`'s `startRunAllPhases` describe block and is your best template for a phase-6 verification test — it doesn't require a live opencode/claude-code binary or network/API keys.
- There is no CLI flag (`papercamp` CLI in `/home/croco/dev/paper-camp/src/cli`) to inject a permission event externally; injection only happens by controlling what the spawned "agent" process prints to stdout, which the harness above already does.

### Flags for your verification write-up
1. The real opencode wire format for a permission denial has not been independently confirmed in this repo (only `PERMISSION_DENIAL_ERROR`'s literal string plus the two unit-test fixtures) — worth running one real `opencode` permission-ask locally and diffing the actual JSON against `opencode.ts`'s assumptions if you want a true end-to-end check rather than a harness-level one.
2. `claude-code.ts` has no permission-detection logic at all — only `opencode` is covered.
3. Resume only applies to `taskKind === 'run-all'`; a single-phase `start()` run that parks on a permission ask won't be picked up by `resumeQuestionParkedTasks`.
4. "Resume on answer" doesn't distinguish grant vs. deny — any reply that `replyToFeedback` classifies as `answersQuestion: true` triggers a resume attempt; there's no explicit "deny and fail cleanly with the recorded cause" path beyond the run re-hitting the same blocker and re-parking.

### Phases
- [x] Capture the permission-ask cause from the agent harness
      Detect the `external_directory` (and sibling permission) event and extract a human string like "read outside workspace: <path>".
- [x] Record the cause in tasks.log and task detail
      Carry the failing reason on the entry instead of a bare `error`, and surface it in the task detail view.
- [x] Intercept the ask instead of auto-denying
      Stop the headless runner from instantly replying with a denial when a permission ask arrives mid-run.
- [x] Park the ask as a question on the idea
      Route it into the parked-decisions inbox ([[IDEA-118]]) with the path and the requesting phase attached.
- [x] Resume the run on answer
      Re-enter the paused run when a reply resolves the parked question; grant and deny aren't distinguished — any answer just re-attempts the run, which re-hits the same blocker and re-parks if the cause wasn't actually addressed.
- [x] Verify against a synthetic decision-blocker ask
      Confirmed via the harness-level `NEEDS_DECISION_MARKER` path (agent.test.ts's fake-adapter pattern) that the run parks, records the cause, and resumes on answer; the real `external_directory` permission-event path through the opencode adapter was not independently exercised (see Flags item 1).

### Thread
- [x] 2026-08-05 [log] [agent] Run-all parked on phase 6 ("Verify against an external-directory ask") — the agent needs a decision: `NEEDS_DECISION_MARKER` marker (`extractBlocker`, agent.ts:49-53). Both `runQueue` (agent.ts:934-966, the `if (task.blocker) { ...; await escalateToLog(...); break; }` block) and the fix-pass loop treat a permission-denial reason identically to an agent-declared decision blocker — the run stops, escalates, and is marked as parked rather than errored outright.
