---
id: IDEA-113
title: Feedback as a single chat thread
type: feat
status: idea
created: 2026-07-31
updated: 2026-07-31
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

### Phases
- [x] Fold log, review, notes, and clarifications into one thread on the idea entity
      Migrate existing entries into the single ordered thread so no history is lost.
- [x] Rebuild the Feedback view as a chat thread with one message box and one send
- [x] Run a one-shot agent on send with the full thread, idea, and plan as context, and post its reply into the thread
- [x] Have the agent classify and act in the same run — answer its own question, edit the plan or body, record with no edit, or spin off a follow-up idea
- [ ] Persist answers to the agent's questions onto the idea as clarifications/decisions
- [ ] Carry a one-tap Undo on each agent reply that reverts that run's git-tracked edits
- [ ] Remove the old flows — Apply, Split, comment/review split, margin-note pins, and Rework-from-notes
