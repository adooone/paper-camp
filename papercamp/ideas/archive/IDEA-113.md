---
id: IDEA-113
title: Feedback as a single chat thread
type: feat
status: done
created: 2026-07-31
updated: 2026-08-02
released: v0.13.0
tags:
  - app
  - ui
  - agent
  - plans
subject: Conversational feedback
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
