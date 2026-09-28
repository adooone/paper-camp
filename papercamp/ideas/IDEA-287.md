---
id: IDEA-287
title: Small questions with answers to pick
type: feat
status: idea
created: 2026-09-28
tags:
  - app
  - server
  - core
  - agents
subject: Planning surface
order: 3
---

A parked question is a paragraph. The agent writes one `NEEDS-DECISION:`
line, the prompt sets no length, and the line carries its reasoning, its
file paths, and its options in a single 900-character run — the one on
IDEA-286 today names two source files, a regex, a helper and three
alternatives before it gets to the question mark. It is pasted into the
thread as one message and into the chat as another, and the person it is
addressed to forwards it to another agent to have it explained. The
decision is usually small; the text is not.

**The protocol asks for a shape, not a line.** Every prompt that carries
`NEEDS-DECISION:` asks for a block:

```
NEEDS-DECISION: <one question, at most 140 characters, ending in ?>
OPTION: <at most 80 characters> — <one consequence, at most 100>
OPTION: …            (two to four, the first is the recommendation)
CONTEXT: <at most three sentences; no file paths unless the choice is about a file>
```

`extractDecision` in `agent.ts` parses the block into `{ question,
options: [{ label, consequence }], context }`, tolerating an old-style
single line by treating the whole line as `question`. A block whose
question exceeds the limit or names no option is still parked, and the
run log says the agent broke the shape, so the prompt can be tightened
rather than the person burdened.

**The thread stores the shape.** A `[question]` message's text is the
one-line question; its options and context follow as indented
continuation lines, `option:` and `context:`, the grammar `foldContinuation`
already reads, so `ThreadMessage` gains `options?` and `context?` and an
old thread parses unchanged. The chat mirror carries the same lines.

**The card renders the shape.** In the thread and in the chat, a parked
question is a `Card` with a muted phase line, the question in body size,
a *Why it matters* `Disclosure` holding the context, the options as
pressable rows with the first stamped *Recommended* and each consequence
under its label, and a text field under them. Pressing an option sends
its label through `feedback-message` as the decision, exactly as a typed
answer does; the option chosen is recorded on the message so the card
shows it after. The bell's notification shows the question line only.

**One decision per park.** The prompt says: if two decisions block the
phase, ask the first; the run parks again for the second after the
answer, since a person answers one short question far faster than one
long one. It also says which things are never decisions — anything the
idea body already settles, anything a file or a test can answer — and to
re-read the idea before parking.

### Out of scope

Answering a question without a person. Changing what parks a run.
Questions the user writes.

### Phases
- [ ] Ask every decision prompt for the block
      Give each prompt that carries `NEEDS-DECISION:` the four-line shape with
      its limits, the one-decision-per-park rule, and what is never a decision.
- [ ] Parse the block in `extractDecision`
      Return question, options and context, treat an old single line as the
      question, and log a broken shape without un-parking the run.
- [ ] Carry options and context through the thread
      Write and read `option:` and `context:` continuation lines, add the fields
      to `ThreadMessage`, and mirror the same lines into the chat.
- [ ] Render the question card
      Card with the question, a *Why it matters* disclosure, pressable options
      with the first stamped *Recommended*, and a text field; pressing one sends
      its label through `feedback-message` and records the choice on the message.
- [ ] Trim the bell to the question line
