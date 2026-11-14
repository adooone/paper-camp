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

**The same hands as a run.** The chat session is a full agent, not a
note-taker. It starts with `buildArgs`, the flags a phase run gets:
`--permission-mode auto`, the paper-camp MCP server under
`--strict-mcp-config`, and every tool, with `WebFetch` and `WebSearch`
allowed here (a conversation looks things up). Scout reads and edits the
code directly on the checked-out branch, runs `pnpm run check-types`,
biome and the tests when a change warrants it, and commits only when
asked, in the repository's commit format. Idea writes still go through
the MCP tools (`add_idea`, `append_note`, `update_phase`, `edit_idea`,
`append_clarification`) so `papercamp/` keeps its grammar. Each turn is
prefixed with a two-line status the daemon already knows: the current
branch with its dirty files, and the active runs with their ideas, so
Scout keeps off a tree a run is editing. The first turn's preamble is
short: the persona, that the project's `AGENTS.md` and `papercamp/` are
the map, what each MCP tool is for, and that code the user asks for is
changed here and now. The three-move classifier, the hand-built index and
`buildChatMovePrompt` go.

**A blocked tool is a question, not a dead end.** Under `auto` a tool
call the repo's allowlist does not cover is denied in a headless run
(the "denied by permission ask" the opencode adapter already surfaces,
and the equivalent `permission_denials` in claude-code's result). In the
chat that denial becomes a question card under the pending bubble naming
the tool and its target ("Run `pnpm test`?") with *Allow once*, *Always
allow* and *Skip*. *Always allow* appends the rule to the agent's own
permission file (`.claude/settings.json` `permissions.allow` for
claude-code, `opencode.json` `permission` for opencode), so phase runs
gain it too; either allow re-sends the turn with the choice. The daemon
never runs an agent with permissions bypassed.

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

**One chat per project, and nothing else.** Every conversation with
Scout happens in the project chat; the project picker is the only split.
The idea view, the toolbar card, the run row and the phone stop carrying
their own composer: `FeedbackSection` becomes the read-only thread
(notes, decisions, logs, parked questions and clarifications stay the
idea's record), `useFeedbackComposer`, `useSendFeedbackMessage` and the
toolbar's `scout-thread.tsx` composer go, and each of those places gets a
*Discuss in chat* link that opens the project chat with the idea's id
prefilled in the composer ("IDEA-331: "). The toolbar's Scout card shows
the project chat itself and sends its `MountContext` (route, component)
with each message so Scout knows where the user is standing. Scout acts on
an idea when the message names it: a reply about IDEA-331 is posted to its
thread with `append_note`, a phase reword is `update_phase`, a body change
is `edit_idea`, an answer to a parked question is `append_clarification`,
which marks the open question resolved so the phase re-runs with it as
today. Parked questions already appear in `chat.md`; they stay there and
are answered there. `POST /api/agent/feedback-message`, `feedback-undo`
and `feedback-summarize` are deleted with `feedback-reply.ts`,
`buildFeedbackReplyPrompt` and `buildFeedbackSummaryPrompt` (summarising a
thread is something you ask Scout); `feedback-promote` stays, it is a
deterministic thread action, not a conversation. The `feedback` activity
event type goes with the route; the phone and toolbar follow `chat`
events like the web page.

**Acceptance.** A plain question in the project chat shows the first
streamed words within 3 s and the composer unlocks under 300 ms after
send. The second message of a conversation sends under 2k new tokens to
the model. Asking "which file handles the chat routes" names
`src/app/server/routes/chat.ts` because Scout read it. "File an idea for
X" creates the idea through `add_idea` and the reply links it. "Rename
`probe-cache.ts` to `probe-store.ts`" changes the files and the Stack
panel's commit section shows them dirty. A command outside the allowlist
shows the permission card and runs on *Allow once*. The
running chat turn is a row in the Stack panel with a stop button. "IDEA-331: reword the second phase to …" edits that phase through
`update_phase` and the exchange is visible in the chat and as a note on
IDEA-331's thread. No view outside the chat offers a composer; the idea
view, toolbar card and run row each open the chat with the id prefilled.

### Phases
- [ ] The chat session runner
      `buildChatArgs` in `src/app/server/agents/claude-code.ts` (`buildArgs` without the `WebFetch`/`WebSearch` denial, plus `--include-partial-messages` and `--resume` when a session exists) and the opencode equivalent (`run --format json --session <id>`); `permission_denials` from the result and opencode's permission asks are reported as a `permission` chat event with tool and target; `runChatTurn(root, text, context)` in `agent.ts` that reads and writes `.local/chat-session.json`, feeds the preamble on the first turn, replays the last ten `chat.md` messages when a resume fails, publishes `chat` stage, chunk and tool events, records the task like any other (no `chat` filter in `getStatus`), and returns the final text. Adapter and runner tests with a fake agent.
- [ ] Project chat on the session
      `POST /api/chat` appends the user message, starts the turn and acks; the reply is appended to `chat.md` on `done`, a failure as an agent message with the error; `/api/chat/retry` re-sends the last user message; `DELETE /api/chat` clears `chat.md` and the session file; the git shortcut stays first. Delete `chat-reply.ts`, `buildChatMovePrompt` and their tests; route tests for ack timing, retry and clear.
- [ ] The web page streams
      `use-chat-thread.ts` unlocks the composer on ack and renders the streamed reply and tool lines under the pending bubble (the components IDEA-330 added for idea threads), `use-chat-stage.ts` follows the new stages, a `permission` event renders the question card with *Allow once*, *Always allow* (`POST /api/chat/allow` appends the rule to the agent's permission file) and *Skip*, each re-sending the turn with the choice; the chat task shows in the Stack panel with stop. Hook and view tests.
- [ ] One composer: the idea surfaces open the chat
      Delete `POST /api/agent/feedback-message`, `feedback-undo`, `feedback-summarize`, `feedback-reply.ts`, `buildFeedbackReplyPrompt`, `buildFeedbackSummaryPrompt`, the `feedback` activity event and `useSendFeedbackMessage`/`useFeedbackComposer`; `FeedbackSection` renders the read-only thread with promote kept; the idea view, `run-row-detail.tsx` and the toolbar's `scout-thread.tsx` get a *Discuss in chat* link that opens the project chat with `IDEA-N: ` prefilled, and the toolbar's Scout card shows the project chat and sends its `MountContext` with `POST /api/chat`; extend the MCP server where a shape is missing (`append_clarification` resolving the open question, `add_idea` with `kind: fix` and a parent). Route, hook and MCP tests.
- [ ] Docs and the skill know the chat
      `USAGE.md` gets a Chat section (what the project chat is, what Scout can do, how the allowlist and the permission card work, cost per turn, how to clear); the paper-camp skill tells an agent that chat writes arrive through the MCP tools; `docs/` gains the session file's shape.
