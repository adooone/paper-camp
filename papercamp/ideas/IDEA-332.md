---
id: IDEA-332
title: Scout chat as a live agent session
type: feat
status: planned
created: 2026-11-14
updated: 2026-11-14
tags:
  - server
  - app
  - chat
  - agent
subject: Planning surface
---

Chat is the one surface where Scout talks back, and it is the weakest one.
Measured on 2026-11-14 against the 0.47.0 daemon: a plain question in the
project chat ("what's running, which ideas are open") took 10.0 s end to
end and cost $1.02; a question inside an idea's thread took 16.5 s and
$0.97. Each message re-sent about 50k tokens, of which 11k came from the
cache. The web composer stays locked for the whole round trip, nothing
streams, and the chat task is hidden from the Stack panel (`getStatus`
filters `taskKind === 'chat'`), so a slow reply looks like nothing is
happening.

**Why.** Every message is a fresh `claude -p` call (`runReadOnlyPrompt`,
`src/app/server/agent.ts`) fed a prompt built by hand in
`buildChatMovePrompt` and `buildFeedbackReplyPrompt`
(`src/app/features/plans/prompts/prompts.ts`): the whole idea index, the
full body of every open idea, the last ten runs, the thread. The thread
changes every turn, so the prompt never caches. Scout is told not to use
tools and has no memory beyond `chat.md`'s last fifty messages. It may
only answer with one of three JSON shapes (`chat-reply.ts`: file an
idea, forward to an idea's thread, reply), and inside an idea only with a
reply plus an optional phase or body edit (`feedback-reply.ts`). It cannot
open a file, cannot read `AGENTS.md`, cannot look at a test or a route,
although the daemon runs it from the repository root with the paper-camp
MCP server one flag away: phase runs already get `--mcp-config` with
`--strict-mcp-config`, `--permission-mode`, `--disallowedTools` and
`--resume` from `buildArgs` in `src/app/server/agents/claude-code.ts`, and
`agent.ts` already keeps and resumes `sessionId`s for phase and fix runs.

**Scout is a session.** Each project chat is one long-lived agent
session, started on the first message and resumed on every later one, the
same `--resume` the phase runner uses. The session id, agent and model
live in `papercamp/.local/chat-session.json`; *Clear chat* deletes the
file and `chat.md` together. A resume that fails (expired session, agent
switched in `defaultAgents.chat`) starts a fresh session and replays the
last ten `chat.md` messages as the first turn's context. A turn sends the
new message only; the model carries the rest, so a turn costs the turn.

**Tools instead of moves.** The session runs from the repository root
with read-only code tools (`Read`, `Grep`, `Glob`) and the paper-camp MCP
server, and nothing else: `Bash`, `Edit`, `Write`, `NotebookEdit`,
`WebFetch` and `WebSearch` are disallowed. Filing an idea is `add_idea`,
posting to an idea's thread is `append_note`, answering a parked question
is `append_clarification`, rewording a phase is `update_phase`: Scout
chooses the tool, the MCP server does the write, and `chat.md` records the
exchange. The first turn's preamble is short: the persona, that the
project's `AGENTS.md` and `papercamp/` are the map, what each MCP tool is
for, and that code changes are never made here but handed to a run. The
three-move classifier, the hand-built index and `buildChatMovePrompt` go.

**Instant ack, streamed reply, visible task.** `POST /api/chat` answers
`{ ok: true }` once the user message is on `chat.md` and the turn has
started. The turn streams through the activity stream as `type: 'chat'`
events: `stage` (`reading`, `thinking`, `replying`, `done`, `failed`),
`chunk` with the reply text so far (the `--include-partial-messages`
stream IDEA-330 already parses), and `tool` lines ("Reading
src/app/server/git.ts", "Filed IDEA-333") from the stream-json tool
events. The reply is appended to `chat.md` when the turn ends. The chat
task appears in the agent status list and the Stack panel like any other
task, with stop. The git phrasing shortcut (`tryHandleGitChatRequest`)
stays in front of the session.

**One session for the idea threads too.** A message sent from an idea
view or the toolbar goes to the same project session, prefixed with the
idea it was sent from ("In IDEA-331: …"). Scout answers in that idea's
thread through the MCP tools and the daemon keeps the `feedback` events
(`reading`, `thinking`, `replying`, `done`, `failed`, `chunk`) the phone
and toolbar listen to. Phase and body edits become `update_phase` and
`edit_idea` calls; an answered parked question is `append_clarification`,
which resumes the parked run as today; a fix request becomes a phase on
that idea, as the prompt already demands. `feedback-reply.ts` and
`buildFeedbackReplyPrompt` go with `chat-reply.ts`.

**Acceptance.** A plain question in the project chat shows the first
streamed words within 3 s and the composer unlocks under 300 ms after
send. The second message of a conversation sends under 2k new tokens to
the model. Asking "which file handles the chat routes" names
`src/app/server/routes/chat.ts` because Scout read it. "File an idea for
X" creates the idea through `add_idea` and the reply links it. The
running chat turn is a row in the Stack panel with a stop button. A
message typed in IDEA-331's view appears on IDEA-331's thread with
Scout's reply under it, and the phone and toolbar receive the same
`feedback` events as before.

### Phases
- [ ] The chat session runner
      `buildChatArgs` in `src/app/server/agents/claude-code.ts` (`-p --output-format stream-json --verbose --include-partial-messages --mcp-config … --strict-mcp-config --allowedTools Read,Grep,Glob,mcp__paper-camp__* --disallowedTools Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch`, `--resume` when a session exists) and the opencode equivalent (`run --format json --session <id>` with a permission config denying edit and bash through `OPENCODE_CONFIG_CONTENT`); `runChatTurn(root, text, context)` in `agent.ts` that reads and writes `.local/chat-session.json`, feeds the preamble on the first turn, replays the last ten `chat.md` messages when a resume fails, publishes `chat` stage, chunk and tool events, records the task like any other (no `chat` filter in `getStatus`), and returns the final text. Adapter and runner tests with a fake agent.
- [ ] Project chat on the session
      `POST /api/chat` appends the user message, starts the turn and acks; the reply is appended to `chat.md` on `done`, a failure as an agent message with the error; `/api/chat/retry` re-sends the last user message; `DELETE /api/chat` clears `chat.md` and the session file; the git shortcut stays first. Delete `chat-reply.ts`, `buildChatMovePrompt` and their tests; route tests for ack timing, retry and clear.
- [ ] The web page streams
      `use-chat-thread.ts` unlocks the composer on ack and renders the streamed reply and tool lines under the pending bubble (the components IDEA-330 added for idea threads), `use-chat-stage.ts` follows the new stages, the chat task shows in the Stack panel with stop. Hook and view tests.
- [ ] Idea threads ride the session
      `applyFeedbackMessage` files the message on the idea's thread and sends it to the project session with the idea prefix; the daemon maps the session's `chat` events to `feedback` events for that `planId`; Scout's edits arrive through `update_phase`, `edit_idea` and `append_clarification` (extend the MCP server where a shape is missing, e.g. `add_idea` with `kind: fix` and a parent); the clarification path still resumes a parked run. Delete `feedback-reply.ts`, `buildFeedbackReplyPrompt` and `buildFeedbackSummaryPrompt`; route and MCP tests.
- [ ] Docs and the skill know the chat
      `USAGE.md` gets a Chat section (what the project chat is, what Scout can and cannot do, cost per turn, how to clear); the paper-camp skill tells an agent that chat writes arrive through the MCP tools; `docs/` gains the session file's shape.
