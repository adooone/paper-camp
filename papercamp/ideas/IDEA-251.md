---
id: IDEA-251
title: Project chat
type: feat
status: idea
created: 2026-09-10
tags:
  - app
  - server
subject: Mobile control desk
order: 3
---

Every conversation with the agent today is bound to one entity: the
feedback composer on an idea posts to `/api/agent/feedback-message` with
that idea's id, the reply edits that idea, and a question the agent parks
waits in that idea's thread. There is no place to say "make an idea for
X", "the log view is clipped again", or "what is running and why did it
fail" without first finding the entity the sentence is about. On a desk
that is a detour; on a phone ([[IDEA-250]]) it is the whole reason to open
the app, so the project needs one conversation that is not about any one
entity yet.

**One thread per project.** `papercamp/chat.md` holds the project's
conversation in the same `### Thread` grammar the ideas use, read and
appended through the daemon: `GET /p/<slug>/api/chat` returns the thread
and `POST /p/<slug>/api/chat` appends a message and answers with the
agent's reply, the same round trip as `feedback-message`. The file is
git-ignored like `run-order.md`: the chat is a scratchpad, and everything
durable it produces — an idea, a fix, a thread note, an answer — already
lives on the entity the reply links.

**The reply is an action, not prose.** The chat agent runs with the
`papercamp` MCP tools and a prompt that names its three moves. A message
describing work calls `add_idea` and replies with the new id as a link,
drafted to the same standard as the composer's suggestions. A message
about an existing idea, run, or log entry — named by id, by title, or by
being the one running — is appended to that entity's thread through the
feedback path, so the reply and any edit land where the desk already
shows them, and the chat reply links there. A question is answered from
the corpus, the run log, and `/api/agent/status`, with links. Nothing is
written silently: every action the reply took is named in it.

**Parked questions surface here.** When a run parks on a question, the
question is also posted to the chat as a `question` message carrying the
entity id; answering it in the chat resolves the entity's question exactly
as answering on the idea does today, and the run resumes. The chat is the
one inbox for the agent's questions across the project.

**It stays short.** On every append the thread is trimmed to the last 50
messages, and to nothing older than 14 days, whichever leaves less; an
unanswered question is never trimmed. *Clear chat* in the tab's title row,
on the desk and on the phone, empties it at once except for unanswered
questions, with a one-line confirm. There is no export; what mattered is
on the entities.

**The desk gets the same tab.** The web client gains *Chat* in the header
next to Plans and Log, the thread rendered by the feedback composer's
components at page width, with the composer at the bottom. The status bar
counts unanswered questions in the chat as it counts unread log entries.

### Out of scope

Chat across projects; the thread is per project, and the hub does not
aggregate them. Streaming replies; the round trip returns when the reply
is ready, as feedback does. Editing or deleting single messages, and any
search over the chat.

### Phases
- [ ] Read, append, and trim `papercamp/chat.md`
      A core module over the `### Thread` grammar, git-ignored like `run-order.md`, trimming to 50 messages / 14 days on every append and never dropping an open question.
- [ ] Serve `GET` and `POST /p/<slug>/api/chat`
      Mirror the `/api/agent/feedback-message` round trip: persist the user message before the run, append the reply after.
- [ ] Give the chat agent its three moves
      One prompt over the `papercamp` MCP tools: `add_idea`, an append through the feedback path, or an answer from the corpus, the run log, and `/api/agent/status` — each named in the reply with links.
- [ ] Post parked questions to the chat and resolve them from it
      A parked question is also appended as a `question` message carrying its entity id; answering it there resolves the entity's question and resumes the run.
- [ ] Add the Chat tab to the web client
      Next to Plans and Log, the thread rendered by the feedback composer's components at page width with the composer at the bottom.
- [ ] Add *Clear chat* to the tab's title row
      One-line confirm, empties everything but unanswered questions.
- [ ] Count unanswered chat questions in the status bar
